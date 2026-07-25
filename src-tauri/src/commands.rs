use serde_json::Value;
use tauri::{ipc::Channel, State};

use crate::{ipc::SidecarStatus, sidecar::Sidecar};

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
