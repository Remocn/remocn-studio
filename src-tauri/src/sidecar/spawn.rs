use std::{
    collections::HashSet,
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    process::Stdio,
};

use tauri::{AppHandle, Manager};
use tokio::process::{Child, Command};

use crate::ipc::{
    DATA_DIR_ENV, GRAB_SCRIPT_ENV, HOST_PID_ENV, LIBRARY_DIR_ENV, PLUGIN_DIR_ENV,
    PREVIEW_ENTRY_ENV, REMOCN_DIR_ENV, TEMPLATE_DIR_ENV,
};

const BUN_ENV: &str = "REMOCN_STUDIO_BUN";
const FALLBACK_DIRS: [&str; 5] = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
];

pub fn resolve_bun() -> Result<PathBuf, String> {
    if let Some(value) = env::var_os(BUN_ENV) {
        let explicit = PathBuf::from(value);
        if explicit.is_file() {
            return Ok(explicit);
        }
        return Err(format!(
            "{BUN_ENV} points at {}, which is not a file",
            explicit.display()
        ));
    }

    search_dirs()
        .into_iter()
        .map(|dir| dir.join("bun"))
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            "bun is not installed, or not where the app can find it — install it from https://bun.sh"
                .to_string()
        })
}

#[cfg(debug_assertions)]
pub fn resolve_script(_app: &AppHandle) -> Result<PathBuf, String> {
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../sidecar/index.ts");
    source
        .canonicalize()
        .map_err(|err| format!("no sidecar source at {}: {err}", source.display()))
}

#[cfg(not(debug_assertions))]
pub fn resolve_script(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::path::BaseDirectory;

    app.path()
        .resolve("sidecar/main.js", BaseDirectory::Resource)
        .map_err(|err| format!("the app bundle has no sidecar: {err}"))
}

#[cfg(debug_assertions)]
pub fn resolve_preview_entry(_app: &AppHandle) -> Result<PathBuf, String> {
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../preview/entry.tsx");
    source
        .canonicalize()
        .map_err(|err| format!("no preview entry at {}: {err}", source.display()))
}

#[cfg(not(debug_assertions))]
pub fn resolve_preview_entry(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::path::BaseDirectory;

    app.path()
        .resolve("preview/entry.tsx", BaseDirectory::Resource)
        .map_err(|err| format!("the app bundle has no preview entry: {err}"))
}

#[cfg(debug_assertions)]
pub fn resolve_grab_script(_app: &AppHandle) -> Result<PathBuf, String> {
    let source =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../node_modules/grab/dist/index.global.js");
    source
        .canonicalize()
        .map_err(|err| format!("no grab build at {}: {err}", source.display()))
}

#[cfg(not(debug_assertions))]
pub fn resolve_grab_script(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::path::BaseDirectory;

    app.path()
        .resolve("grab/index.global.js", BaseDirectory::Resource)
        .map_err(|err| format!("the app bundle has no grab build: {err}"))
}

#[cfg(debug_assertions)]
pub fn resolve_template_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../templates/remotion");
    source
        .canonicalize()
        .map_err(|err| format!("no project template at {}: {err}", source.display()))
}

#[cfg(not(debug_assertions))]
pub fn resolve_template_dir(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::path::BaseDirectory;

    app.path()
        .resolve("templates/remotion", BaseDirectory::Resource)
        .map_err(|err| format!("the app bundle has no project template: {err}"))
}

#[cfg(debug_assertions)]
pub fn resolve_plugin_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../agent");
    source
        .canonicalize()
        .map_err(|err| format!("no agent plugin at {}: {err}", source.display()))
}

#[cfg(not(debug_assertions))]
pub fn resolve_plugin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::path::BaseDirectory;

    app.path()
        .resolve("agent", BaseDirectory::Resource)
        .map_err(|err| format!("the app bundle has no agent plugin: {err}"))
}

#[cfg(debug_assertions)]
pub fn resolve_remocn_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../remocn");
    source
        .canonicalize()
        .map_err(|err| format!("no vendored remocn registry at {}: {err}", source.display()))
}

#[cfg(not(debug_assertions))]
pub fn resolve_remocn_dir(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::path::BaseDirectory;

    app.path()
        .resolve("remocn", BaseDirectory::Resource)
        .map_err(|err| format!("the app bundle has no vendored remocn registry: {err}"))
}

pub fn resolve_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("there is no app data directory: {err}"))?;

    std::fs::create_dir_all(&dir)
        .map_err(|err| format!("could not create {}: {err}", dir.display()))?;

    Ok(dir)
}

pub fn resolve_library_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = resolve_data_dir(app)?.join("library");

    std::fs::create_dir_all(&dir)
        .map_err(|err| format!("could not create {}: {err}", dir.display()))?;

    Ok(dir)
}

pub struct Launch<'a> {
    pub bun: &'a Path,
    pub data_dir: &'a Path,
    pub grab_script: Option<&'a Path>,
    pub library_dir: Option<&'a Path>,
    pub plugin_dir: Option<&'a Path>,
    pub preview_entry: Option<&'a Path>,
    pub remocn_dir: Option<&'a Path>,
    pub script: &'a Path,
    pub template_dir: Option<&'a Path>,
}

pub fn launch(paths: Launch<'_>) -> Result<Child, String> {
    let Launch {
        bun,
        data_dir,
        grab_script,
        library_dir,
        plugin_dir,
        preview_entry,
        remocn_dir,
        script,
        template_dir,
    } = paths;

    let mut command = Command::new(bun);

    if let Some(library) = library_dir {
        command.env(LIBRARY_DIR_ENV, library);
    }

    if let Some(entry) = preview_entry {
        command.env(PREVIEW_ENTRY_ENV, entry);
    }

    if let Some(grab) = grab_script {
        command.env(GRAB_SCRIPT_ENV, grab);
    }

    if let Some(template) = template_dir {
        command.env(TEMPLATE_DIR_ENV, template);
    }

    if let Some(plugin) = plugin_dir {
        command.env(PLUGIN_DIR_ENV, plugin);
    }

    if let Some(remocn) = remocn_dir {
        command.env(REMOCN_DIR_ENV, remocn);
    }

    // Debug runs the sidecar from the repo, so the repo's .env — the app's
    // own Pexels key lives there — travels on bun's own flag. The release
    // bundle has the key baked in by `bun build --env` instead.
    #[cfg(debug_assertions)]
    {
        let dotenv = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.env");
        if dotenv.exists() {
            command.arg(format!("--env-file={}", dotenv.display()));
        }
    }

    command
        .arg(script)
        .env("PATH", child_path(bun))
        .env(HOST_PID_ENV, std::process::id().to_string())
        .env(DATA_DIR_ENV, data_dir)
        .kill_on_drop(true)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(parent) = script.parent() {
        command.current_dir(parent);
    }

    #[cfg(unix)]
    command.process_group(0);

    command
        .spawn()
        .map_err(|err| format!("could not start {}: {err}", bun.display()))
}

fn search_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(home) = env::var_os("HOME") {
        dirs.push(PathBuf::from(home).join(".bun/bin"));
    }
    if let Some(path) = env::var_os("PATH") {
        dirs.extend(env::split_paths(&path));
    }
    dirs.extend(FALLBACK_DIRS.iter().map(PathBuf::from));

    let mut seen = HashSet::new();
    dirs.retain(|dir| seen.insert(dir.clone()));
    dirs
}

fn child_path(bun: &Path) -> OsString {
    let mut dirs = Vec::new();

    if let Some(parent) = bun.parent() {
        dirs.push(parent.to_path_buf());
    }
    dirs.extend(search_dirs());

    let mut seen = HashSet::new();
    dirs.retain(|dir| seen.insert(dir.clone()));

    env::join_paths(dirs).unwrap_or_default()
}
