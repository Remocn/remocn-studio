use std::{
    collections::HashSet,
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    process::Stdio,
};

use tauri::AppHandle;
use tokio::process::{Child, Command};

use crate::ipc::HOST_PID_ENV;

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
    use tauri::{path::BaseDirectory, Manager};

    app.path()
        .resolve("sidecar/main.js", BaseDirectory::Resource)
        .map_err(|err| format!("the app bundle has no sidecar: {err}"))
}

pub fn launch(bun: &Path, script: &Path) -> Result<Child, String> {
    let mut command = Command::new(bun);

    command
        .arg(script)
        .env("PATH", child_path(bun))
        .env(HOST_PID_ENV, std::process::id().to_string())
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
