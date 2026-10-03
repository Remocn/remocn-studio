use std::{
    collections::HashSet,
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    process::Stdio,
};

use tauri::{AppHandle, Manager};
use tokio::process::{Child, Command};

use crate::crash;
use crate::ipc::{
    APP_ENVIRONMENT_ENV, APP_VERSION_ENV, CRASH_CONSENT_ENV, DATA_DIR_ENV, HOST_PID_ENV,
    LIBRARY_DIR_ENV, PLUGIN_DIR_ENV, PREVIEW_ENTRY_ENV, REMOCN_DIR_ENV, TEMPLATE_DIR_ENV,
};

const BUN_ENV: &str = "REMOCN_STUDIO_BUN";
// Where an app started from Finder, the Dock or a desktop entry finds the
// agent CLIs, Node and package managers, since it inherits the session's
// minimal PATH. One list serves macOS and Linux; a dir that does not exist is
// never matched. The sidecar's `USER_BIN_DIRS` and `SYSTEM_BIN_DIRS` must name
// the same dirs; `sidecar/agent/cli.test.ts` reads this file to hold them
// together.
const HOME_BIN_DIRS: [&str; 9] = [
    ".local/bin",
    ".bun/bin",
    ".npm-global/bin",
    ".volta/bin",
    ".local/share/mise/shims",
    ".asdf/shims",
    ".local/share/pnpm",
    ".yarn/bin",
    "Library/pnpm",
];
const SYSTEM_BIN_DIRS: [&str; 5] = [
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

    if let Some(shipped) = shipped_bun() {
        return Ok(shipped);
    }

    search_dirs()
        .into_iter()
        .map(|dir| dir.join("bun"))
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            "this build ships no bun runtime and none is installed — build with `bun run bun:fetch` first, or install bun from https://bun.sh"
                .to_string()
        })
}

const SHIPPED_BUN: &str = "remocn-studio-bun";

fn shipped_bun() -> Option<PathBuf> {
    let beside = env::current_exe().ok()?.parent()?.join(SHIPPED_BUN);

    beside.is_file().then_some(beside)
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
    // What `settings.json` said when this session started. The sidecar has to
    // be told *something* at spawn — a crash in its first seconds is exactly
    // the kind nobody writes in about, and no webview has connected yet to
    // say anything. Changing the switch afterwards travels over the
    // `crash.consent` method instead of waiting for a relaunch.
    pub crash_consent: bool,
    pub data_dir: &'a Path,
    pub library_dir: Option<&'a Path>,
    pub plugin_dir: Option<&'a Path>,
    pub preview_entry: Option<&'a Path>,
    pub remocn_dir: Option<&'a Path>,
    pub script: &'a Path,
    pub template_dir: Option<&'a Path>,
    pub version: &'a str,
}

pub fn launch(paths: Launch<'_>) -> Result<Child, String> {
    let Launch {
        bun,
        crash_consent,
        data_dir,
        library_dir,
        plugin_dir,
        preview_entry,
        remocn_dir,
        script,
        template_dir,
        version,
    } = paths;

    let mut command = Command::new(bun);

    if let Some(library) = library_dir {
        command.env(LIBRARY_DIR_ENV, library);
    }

    if let Some(entry) = preview_entry {
        command.env(PREVIEW_ENTRY_ENV, entry);
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
        .env(
            CRASH_CONSENT_ENV,
            if crash_consent { "enabled" } else { "disabled" },
        )
        .env(APP_ENVIRONMENT_ENV, crash::environment_name())
        .env(APP_VERSION_ENV, version)
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

pub(crate) fn search_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        dirs.extend(HOME_BIN_DIRS.iter().map(|dir| home.join(dir)));
    }
    if let Some(nvm) = env::var_os("NVM_BIN").filter(|dir| !dir.is_empty()) {
        dirs.push(PathBuf::from(nvm));
    }
    if let Some(path) = env::var_os("PATH") {
        dirs.extend(env::split_paths(&path));
    }
    dirs.extend(SYSTEM_BIN_DIRS.iter().map(PathBuf::from));

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
