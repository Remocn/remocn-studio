//! Crash reporting for the core, and the consent every process reads.
//!
//! Three decisions are worth knowing before changing anything here.
//!
//! **Consent is read from `settings.json` directly, not through
//! `tauri-plugin-store`.** The store plugin persists plain JSON, and this has
//! to run *before* `tauri::Builder` — a panic while the app is being built is
//! exactly the kind of crash that reaches nobody today, and there is no
//! `AppHandle` to ask at that point. So the path is worked out from the
//! bundle identifier, which `generate_context!()` already knows.
//!
//! **There is no `tauri-plugin-sentry`.** Its job is to give the webview a
//! transport through Rust; this app's webview talks to Sentry itself, so the
//! plugin would carry a JS injection we do not want, a breadcrumb collector we
//! turn off anyway, and a minidump child process into an app that is careful
//! about its process group. What is left of it — `sentry::init` and the panic
//! hook — is the plain crate.
//!
//! **The whole thing is behind an off-by-default Cargo feature.** No workflow
//! in this repo compiles the Rust except the release job, so an unbuildable
//! dependency tree would first be discovered while cutting a release. Turning
//! `crash-reports` on is the last step of #268, once a DSN exists to point it
//! at and someone can watch an event arrive.

use std::{
    env,
    path::{Path, PathBuf},
};

use crate::ipc::AppEnvironment;

const SETTINGS_FILE: &str = "settings.json";
const CONSENT_KEY: &str = "crashReports";
const CONSENT_ON: &str = "enabled";

/// Mirrors `crashConsentOf` in `shared/crash.ts`: anything that is not the
/// word the settings store writes for "on" is a no. An absent file, an
/// unreadable one and a malformed one are all "the person has not said yes".
pub fn consent_in(data_dir: &Path) -> bool {
    let Ok(text) = std::fs::read_to_string(data_dir.join(SETTINGS_FILE)) else {
        return false;
    };

    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
        return false;
    };

    value.get(CONSENT_KEY).and_then(serde_json::Value::as_str) == Some(CONSENT_ON)
}

/// The same signal the updater reads, and the reason the sidecar is told at
/// all: in debug it runs from the repo, where a DSN in `.env` would otherwise
/// make a developer's own tree report as production.
pub fn environment() -> AppEnvironment {
    if cfg!(debug_assertions) {
        AppEnvironment::Development
    } else {
        AppEnvironment::Production
    }
}

pub fn environment_name() -> &'static str {
    match environment() {
        AppEnvironment::Development => "development",
        AppEnvironment::Production => "production",
    }
}

/// Where `AppHandle::path().app_data_dir()` would answer, worked out without
/// an app: `~/Library/Application Support/<identifier>` on macOS, and
/// `$XDG_DATA_HOME/<identifier>` or `~/.local/share/<identifier>` on Linux.
/// A platform this does not know answers `None` and the core then reads no
/// consent at all, which fails in the direction that sends nothing.
pub fn data_dir_for(identifier: &str) -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        return env::var_os("HOME").map(|home| {
            PathBuf::from(home)
                .join("Library/Application Support")
                .join(identifier)
        });
    }

    if cfg!(target_os = "linux") {
        return xdg_data_dir(identifier, |name| env::var_os(name));
    }

    None
}

/// A relative `$XDG_DATA_HOME` is invalid by the XDG specification and is
/// ignored, exactly as Tauri's own resolution through `dirs` ignores it.
fn xdg_data_dir(
    identifier: &str,
    var: impl Fn(&str) -> Option<std::ffi::OsString>,
) -> Option<PathBuf> {
    let base = var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .or_else(|| {
            var("HOME")
                .map(PathBuf::from)
                .filter(|home| home.is_absolute())
                .map(|home| home.join(".local/share"))
        })?;

    Some(base.join(identifier))
}

#[cfg(feature = "crash-reports")]
pub type Reporter = sentry::ClientInitGuard;

#[cfg(not(feature = "crash-reports"))]
pub type Reporter = ();

/// Starts the core's own reporting, and answers whether it did.
///
/// The guard has to outlive the app: dropping it flushes and shuts the
/// transport down, so `run()` holds it for the process's lifetime.
#[cfg(feature = "crash-reports")]
pub fn start(version: &str) -> Option<Reporter> {
    use std::borrow::Cow;

    // Compile-time, exactly as the sidecar's is baked by `bun build --env` and
    // the webview's by Next. Absent is the normal case until a Sentry project
    // exists, and it reads the same as a withheld consent: nothing starts.
    let dsn = option_env!("REMOCN_STUDIO_SENTRY_DSN")?;

    if dsn.is_empty() || environment() != AppEnvironment::Production {
        return None;
    }

    let home = env::var("HOME").unwrap_or_default();

    // Built by assignment rather than a struct literal: `ClientOptions` is
    // `#[non_exhaustive]`, so a literal is refused outside the crate that
    // declares it — `..Default::default()` does not buy an exemption.
    let mut options = sentry::ClientOptions::default();

    options.attach_stacktrace = true;
    // `Event<'static>` spelled out: the type carries a lifetime and
    // `before_send` is typed on the `'static` one, so an elided `Event` here
    // would be a fresh anonymous lifetime to unify rather than the one wanted.
    options.before_send = Some(std::sync::Arc::new(
        move |mut event: sentry::protocol::Event<'static>| {
            // A Rust stack frame carries the path the *build machine* compiled
            // from, not the person's; what can carry theirs is the panic
            // message, which is routinely a failed path. The home prefix is all
            // this needs to remove, and a plain replace is all it takes.
            if !home.is_empty() {
                if let Some(message) = event.message.take() {
                    event.message = Some(message.replace(&home, "<home>"));
                }
                for exception in &mut event.exception.values {
                    exception.value = exception
                        .value
                        .take()
                        .map(|value| value.replace(&home, "<home>"));
                }
            }
            Some(event)
        },
    ));
    // Explicit, though `apply_defaults` would derive the same value from
    // `debug_assertions`: the release, the environment and the consent all come
    // from one place in this app.
    options.environment = Some(Cow::Borrowed(environment_name()));
    // Breadcrumbs are the one part of an event that records what the person was
    // doing rather than what broke.
    options.max_breadcrumbs = 0;
    options.release = Some(Cow::Owned(format!("v{version}")));
    options.send_default_pii = false;
    // Set, and not left to be filled in: `sentry-contexts` — a default feature
    // of the crate — puts `hostname::get()` here when it is `None`, and a
    // personal Mac's hostname is its owner's name.
    options.server_name = Some(Cow::Borrowed("remocn-studio"));

    Some(sentry::init((dsn, options)))
}

#[cfg(not(feature = "crash-reports"))]
pub fn start(_version: &str) -> Option<Reporter> {
    None
}

/// The sidecar died after it had been serving. Reported as a message rather
/// than an exception: there is no stack to attach — the process that had one
/// is gone — and the reason line the supervisor already writes into
/// `sidecar.log` is the whole of what is known.
///
/// It carries no path, because `Session::reason` is built from an exit status
/// and a signal name. A launch that never became ready is deliberately not
/// reported: that is a missing bun or a missing script, which the environment
/// checklist already puts on screen for the person to act on.
#[cfg(feature = "crash-reports")]
pub fn note_sidecar_crash(reason: &str) {
    sentry::capture_message(
        &format!("the sidecar stopped unexpectedly: {reason}"),
        sentry::Level::Error,
    );
}

#[cfg(not(feature = "crash-reports"))]
pub fn note_sidecar_crash(_reason: &str) {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;

    fn with(vars: &'static [(&'static str, &'static str)]) -> impl Fn(&str) -> Option<OsString> {
        move |name| {
            vars.iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| OsString::from(value))
        }
    }

    const ID: &str = "com.remocn.remocn-studio";

    #[test]
    fn an_absolute_xdg_data_home_is_used() {
        let dir = xdg_data_dir(ID, with(&[("XDG_DATA_HOME", "/data"), ("HOME", "/home/a")]));
        assert_eq!(dir, Some(PathBuf::from("/data/com.remocn.remocn-studio")));
    }

    #[test]
    fn a_relative_xdg_data_home_is_ignored() {
        let dir = xdg_data_dir(ID, with(&[("XDG_DATA_HOME", "data"), ("HOME", "/home/a")]));
        assert_eq!(
            dir,
            Some(PathBuf::from(
                "/home/a/.local/share/com.remocn.remocn-studio"
            ))
        );
    }

    #[test]
    fn only_home_falls_back_to_local_share() {
        let dir = xdg_data_dir(ID, with(&[("HOME", "/home/a")]));
        assert_eq!(
            dir,
            Some(PathBuf::from(
                "/home/a/.local/share/com.remocn.remocn-studio"
            ))
        );
    }

    #[test]
    fn neither_reads_no_consent() {
        assert_eq!(xdg_data_dir(ID, with(&[])), None);
    }
}
