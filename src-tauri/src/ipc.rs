use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PROTOCOL: u32 = 6;
pub const STATUS_EVENT: &str = "sidecar://status";
pub const NOTIFY_EVENT: &str = "sidecar://notify";
pub const HOST_PID_ENV: &str = "REMOCN_STUDIO_HOST_PID";
pub const DATA_DIR_ENV: &str = "REMOCN_STUDIO_DATA_DIR";
pub const PREVIEW_ENTRY_ENV: &str = "REMOCN_STUDIO_PREVIEW_ENTRY";

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
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SidecarFrame {
    Ready {
        protocol: u32,
        pid: u32,
    },
    Stream {
        id: String,
        data: Value,
    },
    Result {
        id: String,
        data: Value,
    },
    Error {
        id: String,
        message: String,
    },
    Notify {
        channel: String,
        data: Value,
    },
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
