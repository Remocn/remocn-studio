use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PROTOCOL: u32 = 38;
pub const STATUS_EVENT: &str = "sidecar://status";
pub const NOTIFY_EVENT: &str = "sidecar://notify";
pub const QUIT_EVENT: &str = "app://quit-requested";
pub const DEEP_LINK_EVENT: &str = "app://deep-link";
pub const HOST_PID_ENV: &str = "REMOCN_STUDIO_HOST_PID";
pub const DATA_DIR_ENV: &str = "REMOCN_STUDIO_DATA_DIR";
pub const PREVIEW_ENTRY_ENV: &str = "REMOCN_STUDIO_PREVIEW_ENTRY";
pub const TEMPLATE_DIR_ENV: &str = "REMOCN_STUDIO_TEMPLATE_DIR";
pub const PLUGIN_DIR_ENV: &str = "REMOCN_STUDIO_PLUGIN_DIR";
pub const LIBRARY_DIR_ENV: &str = "REMOCN_STUDIO_LIBRARY_DIR";
pub const REMOCN_DIR_ENV: &str = "REMOCN_STUDIO_REMOCN_DIR";
// Mirrors `shared/crash.ts` and `shared/ipc.ts`. The sidecar cannot work any
// of these out for itself: in a release it is one bundled `main.js` with no
// package.json beside it, and in debug it runs from the repo, where a DSN in
// `.env` would otherwise make a developer's own tree report as production.
pub const CRASH_CONSENT_ENV: &str = "REMOCN_STUDIO_CRASH_REPORTS";
pub const APP_ENVIRONMENT_ENV: &str = "REMOCN_STUDIO_ENVIRONMENT";
pub const APP_VERSION_ENV: &str = "REMOCN_STUDIO_VERSION";

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HostFrame {
    Request {
        id: String,
        method: String,
        params: Value,
    },
    Cancel {
        id: String,
    },
    Result {
        id: String,
        data: Value,
    },
    Error {
        id: String,
        message: String,
    },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SidecarFrame {
    Ready { protocol: u32, pid: u32 },
    Stream { id: String, data: Value },
    Result { id: String, data: Value },
    Error { id: String, message: String },
    Notify { channel: String, data: Value },
    Request { id: String, method: String, params: Value },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SidecarPhase {
    Starting,
    Ready,
    Restarting,
    Down,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarStatus {
    pub attempt: u32,
    pub detail: Option<String>,
    pub log_path: Option<String>,
    pub phase: SidecarPhase,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarNotification {
    pub channel: String,
    pub data: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AppEnvironment {
    Development,
    Production,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioBuild {
    pub environment: AppEnvironment,
    pub os: String,
    pub version: String,
}
