use std::{process::ExitStatus, thread, time::Duration};

const GRACE: Duration = Duration::from_millis(120);

#[cfg(unix)]
pub fn interrupt(pid: u32) {
    let group = -(pid as i32);
    unsafe {
        libc::kill(group, libc::SIGTERM);
    }
}

#[cfg(unix)]
pub fn force(pid: u32) {
    let group = -(pid as i32);
    unsafe {
        libc::kill(group, libc::SIGKILL);
    }
}

#[cfg(not(unix))]
pub fn interrupt(_pid: u32) {}

#[cfg(not(unix))]
pub fn force(_pid: u32) {}

pub fn terminate_now(pid: u32) {
    interrupt(pid);
    thread::sleep(GRACE);
    force(pid);
}

#[cfg(unix)]
pub fn describe_exit(status: ExitStatus) -> String {
    use std::os::unix::process::ExitStatusExt;

    if let Some(code) = status.code() {
        return format!("exit code {code}");
    }
    match status.signal() {
        Some(signal) => format!("signal {signal}"),
        None => "an unknown status".to_string(),
    }
}

#[cfg(not(unix))]
pub fn describe_exit(status: ExitStatus) -> String {
    match status.code() {
        Some(code) => format!("exit code {code}"),
        None => "an unknown status".to_string(),
    }
}
