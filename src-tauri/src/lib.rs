mod commands;
mod ipc;
mod paste;
mod sidecar;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{Emitter, Manager, RunEvent, WindowEvent};

use ipc::QUIT_EVENT;
use sidecar::Sidecar;

static QUIT_CONFIRMED: AtomicBool = AtomicBool::new(false);

pub fn confirm_quit() {
    QUIT_CONFIRMED.store(true, Ordering::SeqCst);
}

fn asked_to_quit() -> bool {
    QUIT_CONFIRMED.load(Ordering::SeqCst)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::quit_studio,
            commands::sidecar_cancel,
            commands::sidecar_request,
            commands::sidecar_restart,
            commands::sidecar_status,
            paste::save_pasted_image,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !asked_to_quit() {
                    api.prevent_close();
                    let _ = window.emit(QUIT_EVENT, ());
                }
            }
        })
        .setup(|app| {
            app.manage(Sidecar::start(app.handle().clone()));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| match event {
        RunEvent::ExitRequested { api, .. } if !asked_to_quit() => {
            api.prevent_exit();
            let _ = app.emit(QUIT_EVENT, ());
        }
        RunEvent::Exit => app.state::<Sidecar>().shutdown(),
        _ => {}
    });
}
