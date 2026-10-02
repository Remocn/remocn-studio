use std::sync::OnceLock;

use serde_json::Value;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::{
    confirm_quit,
    ipc::{AppEnvironment, SidecarStatus, StudioBuild},
    sidecar::Sidecar,
};

#[tauri::command]
pub async fn sidecar_request(
    sidecar: State<'_, Sidecar>,
    id: String,
    method: String,
    params: Value,
    on_stream: Channel<Value>,
) -> Result<Value, String> {
    sidecar.request(id, method, params, on_stream).await
}

#[tauri::command]
pub fn sidecar_cancel(sidecar: State<'_, Sidecar>, id: String) -> Result<(), String> {
    sidecar.cancel(id)
}

#[tauri::command]
pub fn sidecar_status(sidecar: State<'_, Sidecar>) -> SidecarStatus {
    sidecar.status()
}

#[tauri::command]
pub fn sidecar_restart(sidecar: State<'_, Sidecar>) {
    sidecar.restart();
}

#[tauri::command]
pub fn quit_studio(app: AppHandle) {
    confirm_quit();
    app.exit(0);
}

#[tauri::command]
pub fn restart_studio(app: AppHandle) {
    confirm_quit();
    app.state::<Sidecar>().shutdown();
    app.restart();
}

#[tauri::command]
pub fn reveal_studio(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "the studio window is unavailable".to_string())?
        .show()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn path_exists(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || std::path::Path::new(&path).is_file())
        .await
        .unwrap_or(false)
}

#[tauri::command]
pub async fn studio_build(app: AppHandle) -> StudioBuild {
    let os = tauri::async_runtime::spawn_blocking(os_version)
        .await
        .unwrap_or_else(|_| "unknown".to_string());

    StudioBuild {
        environment: if cfg!(debug_assertions) {
            AppEnvironment::Development
        } else {
            AppEnvironment::Production
        },
        os,
        version: app.package_info().version.to_string(),
    }
}

static OS_VERSION: OnceLock<String> = OnceLock::new();

const OS_RELEASE: [&str; 2] = ["/etc/os-release", "/usr/lib/os-release"];

pub(crate) fn os_version() -> String {
    OS_VERSION
        .get_or_init(|| {
            OS_RELEASE
                .iter()
                .find_map(|path| std::fs::read_to_string(path).ok())
                .and_then(|text| os_name_in(&text))
                .unwrap_or_else(|| "unknown".to_string())
        })
        .clone()
}

/// `PRETTY_NAME`, else `NAME VERSION_ID`, from an os-release file's
/// shell-style assignments, whose values may be quoted.
fn os_name_in(text: &str) -> Option<String> {
    let field = |key: &str| {
        text.lines().find_map(|line| {
            let value = line.trim().strip_prefix(key)?.strip_prefix('=')?;
            let value = value.trim().trim_matches(|c| c == '"' || c == '\'');
            (!value.is_empty()).then(|| value.to_string())
        })
    };

    field("PRETTY_NAME").or_else(|| {
        let name = field("NAME")?;
        Some(match field("VERSION_ID") {
            Some(version) => format!("{name} {version}"),
            None => name,
        })
    })
}

#[cfg(test)]
mod os_tests {
    use super::os_name_in;

    #[test]
    fn the_pretty_name_wins() {
        let text = "NAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\n";
        assert_eq!(os_name_in(text).as_deref(), Some("Ubuntu 24.04.1 LTS"));
    }

    #[test]
    fn name_and_version_when_there_is_no_pretty_name() {
        let text = "NAME='Fedora Linux'\nVERSION_ID=41\n";
        assert_eq!(os_name_in(text).as_deref(), Some("Fedora Linux 41"));
    }

    #[test]
    fn nothing_usable_is_none() {
        assert_eq!(os_name_in("ID=arch\nPRETTY_NAME=\"\"\n"), None);
    }
}
