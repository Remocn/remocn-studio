mod app_icon;
mod commands;
mod crash;
mod integrations;
mod ipc;
mod legacy_account;
mod links;
mod paste;
mod sidecar;
mod terminal;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;

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
    // `generate_context!()` is bound rather than passed straight to `build`,
    // because the consent has to be read before the builder runs — a panic
    // while the app is being built is one of the crashes this exists to catch,
    // and there is no `AppHandle` yet to ask where the data directory is. The
    // identifier in the context is what locates it.
    let context = tauri::generate_context!();
    let version = context.package_info().version.to_string();

    // Held for the life of the process: dropping the guard flushes the queue
    // and shuts the transport down. `None` — no DSN, a development build, or
    // the feature off — means nothing was started at all, which is the shape
    // #268 asks for: not initialised-and-silent.
    let _crash_reporter = crash::data_dir_for(&context.config().identifier)
        .filter(|data_dir| crash::consent_in(data_dir))
        .and_then(|_| crash::start(&version));

    // Single-instance goes first, and with the `deep-link` feature it hands a
    // second launch's argv to the deep-link plugin before our callback runs —
    // which is how a link reaches a running app on Windows and Linux. macOS
    // delivers both the cold start and the running case as `RunEvent::Opened`,
    // which the deep-link plugin turns into the same `on_open_url`.
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            links::focus(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(integrations::Integrations::new())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            app_icon::set_app_icon,
            commands::path_exists,
            commands::quit_studio,
            commands::reveal_studio,
            commands::restart_studio,
            commands::sidecar_cancel,
            commands::sidecar_request,
            commands::sidecar_restart,
            commands::sidecar_status,
            commands::studio_build,
            integrations::commands::integrations_begin,
            integrations::commands::integrations_cancel,
            integrations::commands::integrations_catalogue,
            integrations::commands::integrations_check,
            integrations::commands::integrations_confirm,
            integrations::commands::integrations_list,
            integrations::commands::integrations_reconfigure,
            integrations::commands::integrations_remove,
            integrations::commands::integrations_set_disabled,
            links::take_deep_links,
            paste::save_pasted_image,
            paste::save_proxy,
            terminal::open_terminal,
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
            legacy_account::forget(app.handle());
            app.manage(links::DeepLinks::default());

            // The URLs that started the app, where the platform hands them over
            // before setup (Windows and Linux argv); on macOS a cold start
            // arrives through `on_open_url` once the run loop is up, so the
            // same listener covers both and the webview drains one queue.
            // A .deb or .rpm installs a desktop entry that claims the scheme;
            // an AppImage has none, so it registers one pointing at itself.
            // A debug build never does, so the scheme is not claimed by
            // whichever checkout last ran.
            #[cfg(target_os = "linux")]
            if app.env().appimage.is_some() {
                if let Err(err) = app.deep_link().register_all() {
                    eprintln!("deep links: the scheme was not registered: {err}");
                }
            }

            if let Ok(Some(urls)) = app.deep_link().get_current() {
                links::receive(app.handle(), urls.into_iter().map(|url| url.to_string()));
            }
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                links::receive(&handle, event.urls().into_iter().map(|url| url.to_string()));
            });
            app.manage(Sidecar::start(app.handle().clone()));

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(1500)).await;
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                }
            });
            Ok(())
        })
        .build(context)
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
