pub mod browser;
pub mod commands;
pub mod elevenlabs;
pub mod openrouter;
pub mod figma;
pub mod keychain;
pub mod lifecycle;
pub mod provider;
pub mod sound_http;
pub mod sounds;
pub mod store;

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex, MutexGuard,
    },
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Runtime};

use provider::{Checked, Registry};
use store::Record;

pub const USABLE_METHOD: &str = "integrations.usable";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConnectionState {
    Checking,
    Connected,
    NeedsAuthorization,
    Unavailable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub account: Option<String>,
    pub capabilities: Vec<String>,
    pub detail: Option<String>,
    pub disabled: bool,
    pub id: String,
    pub name: String,
    pub provider: String,
    pub state: ConnectionState,
}

#[derive(Debug, Clone)]
pub(crate) struct Standing {
    state: ConnectionState,
    detail: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Attempt {
    pub provider: String,
    pub secret: Option<String>,
    pub checked: Checked,
}

pub struct Integrations {
    standing: Mutex<HashMap<String, Standing>>,
    attempt: Mutex<Option<Attempt>>,
    counter: AtomicU64,
    pub registry: Registry,
    pub sounds: Arc<Mutex<sounds::Jobs>>,
    revisions: Mutex<HashMap<String, u64>>,
}

impl Default for Integrations {
    fn default() -> Self {
        Self {
            standing: Mutex::new(HashMap::new()),
            attempt: Mutex::new(None),
            counter: AtomicU64::new(0),
            registry: provider::shipped(),
            sounds: Arc::new(Mutex::new(sounds::Jobs::default())),
            revisions: Mutex::new(HashMap::new()),
        }
    }
}

impl Integrations {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn hold(&self, provider: &str, secret: Option<String>, checked: Checked) {
        *self.attempt.lock().unwrap_or_else(|err| err.into_inner()) = Some(Attempt {
            provider: provider.to_string(),
            secret,
            checked,
        });
    }

    pub fn held(&self) -> Option<Attempt> {
        self.attempt
            .lock()
            .unwrap_or_else(|err| err.into_inner())
            .clone()
    }

    pub fn drop_attempt(&self) {
        *self.attempt.lock().unwrap_or_else(|err| err.into_inner()) = None;
    }

    pub fn next_id(&self) -> String {
        let seq = self.counter.fetch_add(1, Ordering::SeqCst);
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|since| since.as_millis())
            .unwrap_or(0);

        format!("cn_{millis}_{seq}")
    }

    fn standing(&self) -> MutexGuard<'_, HashMap<String, Standing>> {
        self.standing.lock().unwrap_or_else(|err| err.into_inner())
    }

    pub fn revision(&self, id: &str) -> u64 {
        *self
            .revisions
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(id)
            .unwrap_or(&0)
    }

    pub fn invalidate(&self, id: &str) {
        let mut revisions = self
            .revisions
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *revisions.entry(id.to_string()).or_default() += 1;
    }

    pub fn mark(&self, id: &str, state: ConnectionState, detail: Option<String>) {
        self.invalidate(id);
        self.standing()
            .insert(id.to_string(), Standing { state, detail });
    }

    pub fn forget(&self, id: &str) {
        self.invalidate(id);
        self.standing().remove(id);
    }

    pub(crate) fn seen(&self, id: &str) -> Standing {
        self.standing().get(id).cloned().unwrap_or(Standing {
            state: ConnectionState::Checking,
            detail: None,
        })
    }
}

pub(crate) fn viewed(record: &Record, standing: Standing) -> Connection {
    Connection {
        account: record.account.clone(),
        capabilities: record.capabilities.clone(),
        detail: standing.detail,
        disabled: record.disabled,
        id: record.id.clone(),
        name: record.name.clone(),
        provider: record.provider.clone(),
        state: standing.state,
    }
}

pub fn connections<R: Runtime>(
    app: &AppHandle<R>,
    integrations: &Integrations,
) -> Result<Vec<Connection>, String> {
    let records = store::read(app)?;

    Ok(records
        .iter()
        .map(|record| viewed(record, integrations.seen(&record.id)))
        .collect())
}

pub fn usable<R: Runtime>(
    app: &AppHandle<R>,
    integrations: &Integrations,
) -> Result<Vec<Connection>, String> {
    Ok(connections(app, integrations)?
        .into_iter()
        .filter(|connection| connection.state == ConnectionState::Connected && !connection.disabled)
        .collect())
}

pub fn answer<R: Runtime>(
    app: &AppHandle<R>,
    integrations: &Integrations,
    method: &str,
    _params: Value,
) -> Result<Value, String> {
    match method {
        USABLE_METHOD => {
            let answer = usable(app, integrations)?;
            serde_json::to_value(answer)
                .map_err(|err| format!("The studio could not describe your connections: {err}"))
        }
        other => Err(format!(
            "The studio was asked for {other}, which it does not answer."
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(id: &str, disabled: bool) -> Record {
        Record {
            id: id.to_string(),
            provider: "elevenlabs".to_string(),
            name: format!("Connection {id}"),
            account: Some("studio@remocn.dev".to_string()),
            capabilities: vec!["audio".to_string()],
            disabled,
            secret_reference: Some(keychain::reference_for(id)),
        }
    }

    #[test]
    fn a_connection_nobody_checked_yet_is_being_checked() {
        let integrations = Integrations::new();
        let seen = integrations.seen("cn_1");

        assert_eq!(seen.state, ConnectionState::Checking);
        assert!(seen.detail.is_none());
    }

    #[test]
    fn a_connection_reads_as_what_the_last_check_left_it() {
        let integrations = Integrations::new();
        integrations.mark("cn_1", ConnectionState::Connected, None);
        integrations.mark(
            "cn_2",
            ConnectionState::NeedsAuthorization,
            Some("ElevenLabs rejected the key.".to_string()),
        );

        assert_eq!(integrations.seen("cn_1").state, ConnectionState::Connected);
        assert_eq!(
            integrations.seen("cn_2").detail,
            Some("ElevenLabs rejected the key.".to_string())
        );
    }

    #[test]
    fn a_forgotten_connection_goes_back_to_being_unchecked() {
        let integrations = Integrations::new();
        integrations.mark("cn_1", ConnectionState::Connected, None);
        integrations.forget("cn_1");

        assert_eq!(integrations.seen("cn_1").state, ConnectionState::Checking);
    }

    #[test]
    fn only_a_checked_and_enabled_connection_may_be_used() {
        let integrations = Integrations::new();
        integrations.mark("cn_connected", ConnectionState::Connected, None);
        integrations.mark("cn_disabled", ConnectionState::Connected, None);
        integrations.mark("cn_expired", ConnectionState::NeedsAuthorization, None);

        let records = vec![
            record("cn_connected", false),
            record("cn_disabled", true),
            record("cn_expired", false),
            record("cn_unchecked", false),
        ];

        let seen: Vec<Connection> = records
            .iter()
            .map(|one| viewed(one, integrations.seen(&one.id)))
            .filter(|one| one.state == ConnectionState::Connected && !one.disabled)
            .collect();

        assert_eq!(seen.len(), 1);
        assert_eq!(seen[0].id, "cn_connected");
    }

    #[test]
    fn what_a_connection_shows_the_agent_carries_no_secret() {
        let integrations = Integrations::new();
        integrations.mark("cn_1", ConnectionState::Connected, None);

        let one = viewed(&record("cn_1", false), integrations.seen("cn_1"));
        let encoded = serde_json::to_value(&one).expect("a connection should encode");

        assert!(!store::carries_secret(&encoded));
        assert!(encoded.get("secretReference").is_none());
    }
}
