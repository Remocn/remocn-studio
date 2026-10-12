use std::process::Command;
#[cfg(not(target_os = "macos"))]
use std::{
    path::{Path, PathBuf},
    process::Stdio,
};

#[cfg(target_os = "macos")]
const OPEN_WINDOW: &str = r#"tell application "Terminal" to do script """#;
#[cfg(target_os = "macos")]
const ACTIVATE: &str = r#"tell application "Terminal" to activate"#;

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn open_terminal() -> Result<(), String> {
    let status = Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(OPEN_WINDOW)
        .arg("-e")
        .arg(ACTIVATE)
        .status()
        .map_err(|err| format!("could not run osascript: {err}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Terminal did not open ({status})"))
    }
}

// The desktop's own choice first, then the Debian alternative, then the
// terminals people actually install, in rough order of how often a Linux
// developer runs them.
#[cfg(not(target_os = "macos"))]
const TERMINALS: [&str; 13] = [
    "xdg-terminal-exec",
    "x-terminal-emulator",
    "kitty",
    "alacritty",
    "foot",
    "ghostty",
    "wezterm",
    "kgx",
    "gnome-terminal",
    "konsole",
    "xfce4-terminal",
    "tilix",
    "xterm",
];

#[cfg(not(target_os = "macos"))]
const NOT_FOUND: &str = "No terminal was found. Set $TERMINAL to the one you use.";

/// `$TERMINAL` may carry flags (`kitty -1`); only its program is looked up,
/// and a `$TERMINAL` that names nothing installed falls through to the list
/// rather than failing, since the list may still have the person's terminal.
#[cfg(not(target_os = "macos"))]
fn choose(
    terminal: Option<&str>,
    find: impl Fn(&str) -> Option<PathBuf>,
) -> Result<PathBuf, String> {
    let named = terminal
        .and_then(|value| value.split_whitespace().next())
        .and_then(&find);

    named
        .or_else(|| TERMINALS.iter().find_map(|name| find(name)))
        .ok_or_else(|| NOT_FOUND.to_string())
}

#[cfg(not(target_os = "macos"))]
fn find_in(dirs: &[PathBuf], name: &str) -> Option<PathBuf> {
    if name.contains('/') {
        let path = PathBuf::from(name);
        return path.is_file().then_some(path);
    }

    dirs.iter()
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn open_terminal() -> Result<(), String> {
    let dirs = crate::sidecar::search_dirs();
    let terminal = std::env::var("TERMINAL").ok();
    let program = choose(terminal.as_deref(), |name| find_in(&dirs, name))?;
    let home = std::env::var_os("HOME").map(PathBuf::from);

    spawn_detached(&program, home.as_deref())
}

#[cfg(not(target_os = "macos"))]
fn spawn_detached(program: &Path, cwd: Option<&Path>) -> Result<(), String> {
    let mut command = Command::new(program);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Some(dir) = cwd {
        command.current_dir(dir);
    }

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    let mut child = command
        .spawn()
        .map_err(|err| format!("{} did not open: {err}", program.display()))?;

    // Reaped on a thread of its own so a closed terminal is not left a zombie
    // for as long as the studio runs.
    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(())
}

#[cfg(all(test, not(target_os = "macos")))]
mod tests {
    use super::*;

    fn installed(names: &'static [&'static str]) -> impl Fn(&str) -> Option<PathBuf> {
        move |name| {
            names
                .contains(&name)
                .then(|| PathBuf::from("/usr/bin").join(name))
        }
    }

    #[test]
    fn the_terminal_variable_comes_first() {
        let chosen = choose(Some("foot"), installed(&["kitty", "foot"])).unwrap();
        assert_eq!(chosen, PathBuf::from("/usr/bin/foot"));
    }

    #[test]
    fn flags_in_the_terminal_variable_are_not_part_of_the_program() {
        let chosen = choose(Some("kitty -1"), installed(&["kitty"])).unwrap();
        assert_eq!(chosen, PathBuf::from("/usr/bin/kitty"));
    }

    #[test]
    fn a_terminal_variable_naming_nothing_falls_through_to_the_list() {
        let chosen = choose(Some("nope"), installed(&["konsole"])).unwrap();
        assert_eq!(chosen, PathBuf::from("/usr/bin/konsole"));
    }

    #[test]
    fn the_list_is_tried_in_order() {
        let chosen = choose(
            None,
            installed(&["xterm", "alacritty", "x-terminal-emulator"]),
        )
        .unwrap();
        assert_eq!(chosen, PathBuf::from("/usr/bin/x-terminal-emulator"));
    }

    #[test]
    fn nothing_installed_is_a_sentence_naming_the_variable() {
        let error = choose(None, installed(&[])).unwrap_err();
        assert_eq!(error, NOT_FOUND);
        assert!(error.contains("$TERMINAL"));
    }

    #[test]
    fn a_path_in_the_variable_is_used_as_given() {
        let dirs = [PathBuf::from("/nowhere")];
        assert_eq!(find_in(&dirs, "/bin/sh"), Some(PathBuf::from("/bin/sh")));
        assert_eq!(find_in(&dirs, "/nowhere/terminal"), None);
    }
}
