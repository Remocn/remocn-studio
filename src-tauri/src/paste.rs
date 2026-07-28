use std::path::{Path, PathBuf};

use percent_encoding::percent_decode_str;
use tauri::{
    ipc::{InvokeBody, Request},
    AppHandle, Manager,
};

const FOLDER: &str = "pasted-images";
const NAME_HEADER: &str = "x-image-name";
const TYPE_HEADER: &str = "x-image-type";
const FALLBACK_STEM: &str = "image";
const ATTEMPTS: u32 = 10_000;

#[tauri::command]
pub fn save_pasted_image(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("the pasted image did not arrive as bytes".into());
    };

    let media_type = header(&request, TYPE_HEADER)
        .ok_or_else(|| "the pasted image came without a media type".to_string())?;
    let extension = extension_for(&media_type)
        .ok_or_else(|| format!("{media_type} is not an image this app can send"))?;

    let folder = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("there is no app data directory: {err}"))?
        .join(FOLDER);

    std::fs::create_dir_all(&folder)
        .map_err(|err| format!("could not create {}: {err}", folder.display()))?;

    let name = file_name(header(&request, NAME_HEADER).as_deref(), extension);
    let path = free_path(&folder, &name)?;

    std::fs::write(&path, bytes)
        .map_err(|err| format!("could not write {}: {err}", path.display()))?;

    Ok(path.to_string_lossy().into_owned())
}

fn header(request: &Request<'_>, name: &str) -> Option<String> {
    let raw = request.headers().get(name)?.to_str().ok()?;
    Some(percent_decode_str(raw).decode_utf8_lossy().into_owned())
}

fn extension_for(media_type: &str) -> Option<&'static str> {
    match media_type {
        "image/gif" => Some("gif"),
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        _ => None,
    }
}

fn media_type_for(extension: &str) -> Option<&'static str> {
    match extension.to_ascii_lowercase().as_str() {
        "gif" => Some("image/gif"),
        "jpeg" | "jpg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

fn file_name(given: Option<&str>, extension: &str) -> String {
    let sanitised = given.map(sanitise).unwrap_or_default();
    let wanted = media_type_for(extension);

    let (stem, kept) = match sanitised.rsplit_once('.') {
        Some((stem, found)) if !stem.is_empty() => (stem, media_type_for(found) == wanted),
        _ => (sanitised.as_str(), false),
    };

    if kept {
        return sanitised;
    }

    let stem = if stem.is_empty() { FALLBACK_STEM } else { stem };
    format!("{stem}.{extension}")
}

fn sanitise(given: &str) -> String {
    let last = given.rsplit(['/', '\\']).next().unwrap_or(given);
    let cleaned: String = last
        .chars()
        .filter(|char| !char.is_control() && *char != ':')
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();

    if trimmed.is_empty() {
        String::new()
    } else {
        trimmed.to_string()
    }
}

fn free_path(folder: &Path, name: &str) -> Result<PathBuf, String> {
    let candidate = folder.join(name);
    if !candidate.exists() {
        return Ok(candidate);
    }

    let (stem, extension) = match name.rsplit_once('.') {
        Some((stem, extension)) if !stem.is_empty() => (stem, extension),
        _ => (name, ""),
    };

    for attempt in 2..ATTEMPTS {
        let next = if extension.is_empty() {
            format!("{stem}-{attempt}")
        } else {
            format!("{stem}-{attempt}.{extension}")
        };

        let candidate = folder.join(next);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "there are already {ATTEMPTS} pasted images called {name}"
    ))
}
