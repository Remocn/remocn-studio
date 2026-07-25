mod commands;
mod ipc;
mod sidecar;

use tauri::{Manager, RunEvent};

use sidecar::Sidecar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::sidecar_cancel,
            commands::sidecar_request,
            commands::sidecar_restart,
            commands::sidecar_status,
        ])
        .setup(|app| {
            app.manage(Sidecar::start(app.handle().clone()));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if matches!(event, RunEvent::Exit) {
            app.state::<Sidecar>().shutdown();
        }
    });
}
