use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

use super::{openrouter, sound_http, store, ConnectionState, Integrations};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SoundRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub force_instrumental: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
    pub connection_id: String,
    pub duration_seconds: Option<f64>,
    pub format: String,
    pub name: String,
    pub text: String,
}

impl SoundRequest {
    pub fn is_music(&self) -> bool {
        self.kind.as_deref() == Some("music")
    }

    pub fn is_speech(&self) -> bool {
        self.kind.as_deref() == Some("speech")
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.is_speech() {
            return openrouter::validate_speech(self);
        }
        if self.model.is_some() || self.voice.is_some() {
            return Err("Model and voice apply only to narration.".to_string());
        }
        if !matches!(self.kind.as_deref(), None | Some("sound") | Some("music")) {
            return Err("Choose music or sound generation.".to_string());
        }
        if self.is_music() {
            if self.force_instrumental.is_none() || self.text.encode_utf16().count() > 4100 {
                return Err("Music needs an instrumental preference and a description up to 4,100 characters.".to_string());
            }
            if self.format != "mp3_44100_128" {
                return Err("Music uses MP3 at 44.1 kHz with 128 kbps.".to_string());
            }
        } else if self.force_instrumental.is_some() {
            return Err("Instrumental preference applies only to music.".to_string());
        }
        if self.connection_id.is_empty()
            || self.name.trim().is_empty()
            || self.text.trim().is_empty()
            || self.text.encode_utf16().count() > 5000
            || self.name.encode_utf16().count() > 5000
        {
            return Err("Choose a connection and provide a sound name and description (up to 5,000 characters).".to_string());
        }
        if self.duration_seconds.is_some_and(|duration| {
            !duration.is_finite()
                || !(if self.is_music() {
                    3.0..=600.0
                } else {
                    0.5..=30.0
                })
                .contains(&duration)
        }) {
            return Err(if self.is_music() {
                "Music must last between 3 and 600 seconds, or use automatic duration."
            } else {
                "A sound must last between 0.5 and 30 seconds, or use automatic duration."
            }
            .to_string());
        }
        if !matches!(self.format.as_str(), "mp3_44100_128" | "mp3_44100_192") {
            return Err("Choose MP3 at 44.1 kHz with 128 or 192 kbps.".to_string());
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Operation {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub id: String,
    pub request: SoundRequest,
    pub account: Option<String>,
    pub connection_name: String,
    pub created_at: u64,
    pub state: String,
    pub detail: Option<String>,
    pub file: Option<String>,
    pub provider_request_id: Option<String>,
    pub cost: Option<String>,
}

struct Prepared {
    record: store::Record,
    revision: u64,
    key: String,
}

#[derive(Default)]
pub struct Jobs {
    prepared: HashMap<String, Prepared>,
    running: HashSet<String>,
}

const MISSING: &str = "That sound operation is no longer available.";
const STALE: &str = "That connection changed after this sound was prepared. Prepare it again and approve the current connection.";

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "The studio could not find its data folder.".to_string())?
        .join("sound-operations");
    fs::create_dir_all(&root)
        .map_err(|_| "The studio could not create its sound operations folder.".to_string())?;
    Ok(root)
}

fn operation_dir(root: &Path, id: &str) -> Result<PathBuf, String> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    {
        return Err(MISSING.to_string());
    }
    Ok(root.join(id))
}

fn write_operation(root: &Path, operation: &Operation) -> Result<(), String> {
    let dir = operation_dir(root, &operation.id)?;
    let bytes = serde_json::to_vec(operation)
        .map_err(|_| "The studio could not describe this sound operation.".to_string())?;
    let save = || -> std::io::Result<()> {
        let mut file = File::create(dir.join("operation.tmp"))?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        fs::rename(dir.join("operation.tmp"), dir.join("operation.json"))?;
        File::open(dir)?.sync_all()
    };
    save().map_err(|_| {
        "The studio could not save the sound operation. No automatic paid retry will be made."
            .to_string()
    })
}

fn read_operation(root: &Path, id: &str) -> Result<Operation, String> {
    let dir = operation_dir(root, id)?;
    let bytes = fs::read(dir.join("operation.json")).map_err(|_| MISSING.to_string())?;
    let mut operation: Operation = serde_json::from_slice(&bytes)
        .map_err(|_| "The saved sound operation could not be read.".to_string())?;
    if operation.id != id {
        return Err(MISSING.to_string());
    }
    operation.request.validate()?;
    operation.file = if operation.state == "completed" {
        Some(
            dir.join(format!("{}.mp3", operation.id))
                .to_string_lossy()
                .to_string(),
        )
    } else {
        None
    };
    Ok(operation)
}

fn status(root: &Path, jobs: &Jobs, id: &str) -> Result<Operation, String> {
    let mut operation = read_operation(root, id)?;
    if operation.state == "generating" && !jobs.running.contains(id) {
        let file = operation_dir(root, id)?.join(format!("{id}.mp3"));
        if fs::read(&file)
            .ok()
            .is_some_and(|bytes| sound_http::validate_mp3(&bytes).is_ok())
        {
            operation.state = "completed".to_string();
            operation.file = Some(file.to_string_lossy().to_string());
            operation.detail = None;
        } else {
            operation.state = "uncertain".to_string();
            operation.detail = Some(sound_http::UNCERTAIN.to_string());
        }
        write_operation(root, &operation)?;
    } else if operation.state == "prepared" && !jobs.prepared.contains_key(id) {
        operation.state = "cancelled".to_string();
        operation.detail = Some(
            "This preparation expired when the studio restarted. Nothing was generated."
                .to_string(),
        );
        write_operation(root, &operation)?;
    }
    Ok(operation)
}

fn connection(
    app: &AppHandle,
    integrations: &Integrations,
    id: &str,
) -> Result<(store::Record, String), String> {
    let record = store::find(&store::read(app)?, id)
        .ok_or_else(|| "That connection no longer exists.".to_string())?;
    if !matches!(record.provider.as_str(), "elevenlabs" | "openrouter")
        || record.disabled
        || integrations.seen(id).state != ConnectionState::Connected
    {
        return Err("Check and enable this audio connection in Settings → Integrations before generating sound.".to_string());
    }
    let key = record
        .secret_reference
        .as_deref()
        .map(super::keychain::read)
        .transpose()?
        .flatten()
        .ok_or_else(|| "This audio connection needs an API key.".to_string())?;
    Ok((record, key))
}

pub async fn answer(app: AppHandle, method: &str, params: Value) -> Result<Value, String> {
    let integrations = app.state::<Integrations>();
    let root = root(&app)?;
    let jobs = Arc::clone(&integrations.sounds);
    if method == "sounds.prepare" {
        let request: SoundRequest = serde_json::from_value(params)
            .map_err(|_| "The sound parameters could not be read.".to_string())?;
        request.validate()?;
        let (record, key) = connection(&app, &integrations, &request.connection_id)?;
        let revision = integrations.revision(&request.connection_id);
        let client = sound_http::client()?;
        if record.provider == "openrouter" {
            openrouter::validate_request(&request)?;
            openrouter::account(&client, openrouter::BASE, &key).await?;
        } else {
            if request.is_speech() {
                return Err("Choose an OpenRouter connection for narration.".to_string());
            }
            let account = sound_http::account(&client, sound_http::BASE, &key).await?;
            sound_http::check_format(&request, &account)?;
        }
        if revision != integrations.revision(&request.connection_id) {
            return Err(STALE.to_string());
        }
        let operation = Operation {
            provider: Some(record.provider.clone()),
            model: Some(if record.provider == "openrouter" {
                openrouter::model(&request).to_string()
            } else if request.is_music() {
                sound_http::MUSIC_MODEL.to_string()
            } else {
                sound_http::MODEL.to_string()
            }),
            id: format!("sound_{}", integrations.next_id()),
            request,
            account: record.account.clone(),
            connection_name: record.name.clone(),
            created_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            state: "prepared".to_string(),
            detail: None,
            file: None,
            provider_request_id: None,
            cost: None,
        };
        let mut held = jobs
            .lock()
            .map_err(|_| "Sound operations are unavailable.".to_string())?;
        fs::create_dir(operation_dir(&root, &operation.id)?)
            .map_err(|_| "The studio could not reserve this sound operation.".to_string())?;
        write_operation(&root, &operation)?;
        held.prepared.insert(
            operation.id.clone(),
            Prepared {
                record,
                revision,
                key,
            },
        );
        return serde_json::to_value(operation).map_err(|_| MISSING.to_string());
    }
    if method == "sounds.recover" {
        let held = jobs.lock().map_err(|_| MISSING.to_string())?;
        let entries =
            fs::read_dir(&root).map_err(|_| "Sound operations could not be listed.".to_string())?;
        let operations: Vec<_> = entries
            .flatten()
            .filter_map(|entry| entry.file_name().to_str().map(str::to_string))
            .filter_map(|id| status(&root, &held, &id).ok())
            .collect();
        return serde_json::to_value(operations).map_err(|_| MISSING.to_string());
    }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Reference {
        id: String,
    }
    let Reference { id } = serde_json::from_value(params).map_err(|_| MISSING.to_string())?;
    let mut held = jobs.lock().map_err(|_| MISSING.to_string())?;
    let mut operation = status(&root, &held, &id)?;
    match method {
        "sounds.status" => {}
        "sounds.imported" => {
            if operation.state == "completed" {
                operation.state = "imported".to_string();
                operation.file = None;
                write_operation(&root, &operation)?;
                let _ = fs::remove_file(operation_dir(&root, &id)?.join(format!("{id}.mp3")));
            }
        }
        "sounds.cancel" => {
            if operation.state == "prepared" {
                operation.state = "cancelled".to_string();
                operation.detail =
                    Some("Sound generation was declined. Nothing was sent.".to_string());
                write_operation(&root, &operation)?;
                held.prepared.remove(&id);
            } else if operation.state == "generating" {
                operation.detail = Some("Waiting was cancelled after dispatch. The provider may use credits; check this operation for its result.".to_string());
                write_operation(&root, &operation)?;
            }
        }
        "sounds.commit" if operation.state == "prepared" => {
            let client = sound_http::client()?;
            let current = connection(&app, &integrations, &operation.request.connection_id);
            let revision = integrations.revision(&operation.request.connection_id);
            let prepared = claim(&root, &mut held, &mut operation, current, revision)?;
            let task_operation = operation.clone();
            let task_root = root.clone();
            let task_jobs = Arc::clone(&jobs);
            let task_app = app.clone();
            tauri::async_runtime::spawn(async move {
                let result = if prepared.record.provider == "openrouter" {
                    openrouter::generate(
                        &client,
                        openrouter::BASE,
                        &prepared.key,
                        &task_operation.request,
                    )
                    .await
                } else {
                    sound_http::generate(
                        &client,
                        sound_http::BASE,
                        &prepared.key,
                        &task_operation.request,
                    )
                    .await
                };
                finish(&task_root, &task_jobs, task_operation, result);
                let _ = task_app.emit(
                    crate::ipc::NOTIFY_EVENT,
                    crate::ipc::SidecarNotification {
                        channel: "sounds.changed".to_string(),
                        data: serde_json::json!({}),
                    },
                );
            });
        }
        "sounds.commit" => {}
        _ => return Err("The studio does not recognize this sound operation.".to_string()),
    }
    serde_json::to_value(operation).map_err(|_| MISSING.to_string())
}

fn claim(
    root: &Path,
    jobs: &mut Jobs,
    operation: &mut Operation,
    current: Result<(store::Record, String), String>,
    revision: u64,
) -> Result<Prepared, String> {
    if operation.state != "prepared" {
        return Err("This sound has already been dispatched or cancelled.".to_string());
    }
    let prepared = jobs
        .prepared
        .remove(&operation.id)
        .ok_or_else(|| STALE.to_string())?;
    if prepared.revision != revision
        || current.as_ref().map_or(true, |(record, key)| {
            record != &prepared.record || key != &prepared.key
        })
    {
        operation.state = "cancelled".to_string();
        operation.detail = Some(STALE.to_string());
        write_operation(root, operation)?;
        return Err(STALE.to_string());
    }
    operation.state = "generating".to_string();
    write_operation(root, operation)?;
    jobs.running.insert(operation.id.clone());
    Ok(prepared)
}

fn finish(
    root: &Path,
    jobs: &Mutex<Jobs>,
    mut operation: Operation,
    result: Result<sound_http::Audio, String>,
) {
    let Ok(mut held) = jobs.lock() else {
        return;
    };
    match result {
        Ok(audio) => {
            let dir = root.join(&operation.id);
            let save = || -> std::io::Result<()> {
                let mut file = OpenOptions::new()
                    .create_new(true)
                    .write(true)
                    .open(dir.join("sound.part"))?;
                file.write_all(&audio.bytes)?;
                file.sync_all()?;
                fs::rename(
                    dir.join("sound.part"),
                    dir.join(format!("{}.mp3", operation.id)),
                )?;
                File::open(&dir)?.sync_all()
            };
            match save() {
                Ok(()) => {
                    operation.state = "completed".to_string();
                    operation.file = Some(
                        dir.join(format!("{}.mp3", operation.id))
                            .to_string_lossy()
                            .to_string(),
                    );
                    operation.cost = audio.cost;
                    operation.provider_request_id = audio.request_id;
                    operation.detail = None;
                }
                Err(_) => {
                    operation.state = "uncertain".to_string();
                    operation.detail = Some("The provider generated audio, but the local audio write failed. Credits may have been used. No generation retry will be made.".to_string());
                }
            }
        }
        Err(reason) => {
            operation.state = if reason.contains("may have") {
                "uncertain"
            } else {
                "failed"
            }
            .to_string();
            operation.detail = Some(reason);
        }
    }
    let _ = write_operation(root, &operation);
    held.running.remove(&operation.id);
}

#[cfg(test)]
mod tests {
    use super::super::provider::{fake::Vault, Secrets};
    use super::*;

    fn fixture() -> (PathBuf, Jobs, Operation, store::Record) {
        let root = std::env::temp_dir().join(format!(
            "sound-jobs-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("sound_test")).unwrap();
        let record = store::Record {
            id: "cn_test".to_string(),
            provider: "elevenlabs".to_string(),
            name: "Mine".to_string(),
            account: None,
            capabilities: vec!["audio".to_string()],
            disabled: false,
            secret_reference: Some("test-ref".to_string()),
        };
        let operation = Operation {
            provider: None,
            model: None,
            id: "sound_test".to_string(),
            request: sound_http::tests::request(),
            account: None,
            connection_name: "Mine".to_string(),
            created_at: 1,
            state: "prepared".to_string(),
            detail: None,
            file: None,
            provider_request_id: None,
            cost: None,
        };
        let vault = Vault::default();
        vault.store("test-ref", "test-secret").unwrap();
        let mut jobs = Jobs::default();
        jobs.prepared.insert(
            operation.id.clone(),
            Prepared {
                record: record.clone(),
                revision: 1,
                key: vault.read("test-ref").unwrap().unwrap(),
            },
        );
        write_operation(&root, &operation).unwrap();
        (root, jobs, operation, record)
    }

    #[test]
    fn dispatch_is_persisted_once_and_contains_no_credential() {
        let (root, mut jobs, mut operation, record) = fixture();
        let current = Ok((record, "test-secret".to_string()));
        assert!(claim(&root, &mut jobs, &mut operation, current.clone(), 1).is_ok());
        assert_eq!(
            read_operation(&root, &operation.id).unwrap().state,
            "generating"
        );
        assert!(claim(&root, &mut jobs, &mut operation, current, 1).is_err());
        let serialized = fs::read_to_string(root.join("sound_test/operation.json")).unwrap();
        assert!(!serialized.contains("test-secret"));
        assert!(!serialized.contains("test-ref"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_stale_key_connection_or_revision_cannot_be_committed() {
        for change in 0..3 {
            let (root, mut jobs, mut operation, mut record) = fixture();
            let mut key = "test-secret".to_string();
            if change == 0 {
                record.disabled = true;
            }
            if change == 1 {
                key = "replacement".to_string();
            }
            assert!(claim(
                &root,
                &mut jobs,
                &mut operation,
                Ok((record, key)),
                if change == 2 { 2 } else { 1 }
            )
            .is_err());
            assert_eq!(
                read_operation(&root, &operation.id).unwrap().state,
                "cancelled"
            );
            assert!(jobs.running.is_empty());
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn concurrent_claims_grant_only_one_dispatch() {
        let (root, jobs, operation, record) = fixture();
        let jobs = Arc::new(Mutex::new(jobs));
        let workers: Vec<_> = (0..8)
            .map(|_| {
                let root = root.clone();
                let jobs = Arc::clone(&jobs);
                let record = record.clone();
                let mut operation = operation.clone();
                std::thread::spawn(move || {
                    claim(
                        &root,
                        &mut jobs.lock().unwrap(),
                        &mut operation,
                        Ok((record, "test-secret".to_string())),
                        1,
                    )
                    .is_ok()
                })
            })
            .collect();
        let granted = workers
            .into_iter()
            .map(|worker| usize::from(worker.join().unwrap()))
            .sum::<usize>();
        assert_eq!(granted, 1);
        assert_eq!(
            read_operation(&root, &operation.id).unwrap().state,
            "generating"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn imported_receipt_does_not_recover_deleted_library_audio() {
        let (root, jobs, mut operation, _) = fixture();
        operation.state = "imported".to_string();
        write_operation(&root, &operation).unwrap();
        fs::write(
            root.join("sound_test/sound_test.mp3"),
            sound_http::tests::mp3(),
        )
        .unwrap();
        let recovered = status(&root, &jobs, &operation.id).unwrap();
        assert_eq!(recovered.state, "imported");
        assert!(recovered.file.is_none());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_restart_never_repeats_a_dispatched_request() {
        let (root, mut jobs, mut operation, record) = fixture();
        claim(
            &root,
            &mut jobs,
            &mut operation,
            Ok((record, "test-secret".to_string())),
            1,
        )
        .unwrap();
        let recovered = status(&root, &Jobs::default(), &operation.id).unwrap();
        assert_eq!(recovered.state, "uncertain");
        assert!(recovered.detail.unwrap().contains("may have"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn complete_download_survives_a_lost_completion_record() {
        let (root, mut jobs, mut operation, record) = fixture();
        claim(
            &root,
            &mut jobs,
            &mut operation,
            Ok((record, "test-secret".to_string())),
            1,
        )
        .unwrap();
        fs::write(
            root.join("sound_test/sound_test.mp3"),
            sound_http::tests::mp3(),
        )
        .unwrap();
        let recovered = status(&root, &Jobs::default(), &operation.id).unwrap();
        assert_eq!(recovered.state, "completed");
        assert!(recovered.file.unwrap().ends_with("sound_test.mp3"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failure_to_persist_refuses_dispatch_and_paths_cannot_escape() {
        let (root, mut jobs, mut operation, record) = fixture();
        fs::remove_dir_all(root.join(&operation.id)).unwrap();
        assert!(claim(
            &root,
            &mut jobs,
            &mut operation,
            Ok((record, "test-secret".to_string())),
            1
        )
        .is_err());
        assert!(jobs.running.is_empty());
        assert!(operation_dir(&root, "../elsewhere").is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
