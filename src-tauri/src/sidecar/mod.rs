mod logs;
mod signal;
mod spawn;

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicI32, Ordering},
        Arc, Mutex, MutexGuard,
    },
    time::Duration,
};

use serde_json::Value;
use tauri::{ipc::Channel, AppHandle, Emitter, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{ChildStderr, ChildStdin, ChildStdout},
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot, watch, Notify,
    },
    time::{sleep, timeout_at, Instant},
};

use crate::ipc::{
    HostFrame, SidecarFrame, SidecarNotification, SidecarPhase, SidecarStatus, NOTIFY_EVENT,
    PROTOCOL, STATUS_EVENT,
};
use logs::SidecarLog;

const MAX_ATTEMPTS: u32 = 4;
const READY_TIMEOUT: Duration = Duration::from_secs(20);
const RESTART_GRACE: Duration = Duration::from_millis(500);

struct Pending {
    done: oneshot::Sender<Result<Value, String>>,
    stream: Channel<Value>,
}

struct Session {
    reason: String,
    was_ready: bool,
}

struct Inner {
    app: AppHandle,
    child: AtomicI32,
    log: SidecarLog,
    outbound: Mutex<Option<UnboundedSender<HostFrame>>>,
    pending: Mutex<HashMap<String, Pending>>,
    restart_requested: AtomicBool,
    shutdown: AtomicBool,
    status: watch::Sender<SidecarStatus>,
    wake: Notify,
}

pub struct Sidecar {
    inner: Arc<Inner>,
}

impl Sidecar {
    pub fn start(app: AppHandle) -> Self {
        let dir = app
            .path()
            .app_log_dir()
            .unwrap_or_else(|_| std::env::temp_dir());
        let log = SidecarLog::open(&dir);

        let (status, _) = watch::channel(SidecarStatus {
            attempt: 0,
            detail: None,
            log_path: Some(log.path().display().to_string()),
            phase: SidecarPhase::Starting,
            pid: None,
        });

        let inner = Arc::new(Inner {
            app,
            child: AtomicI32::new(0),
            log,
            outbound: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            restart_requested: AtomicBool::new(false),
            shutdown: AtomicBool::new(false),
            status,
            wake: Notify::new(),
        });

        let supervisor = Arc::clone(&inner);
        tauri::async_runtime::spawn(supervise(supervisor));

        Self { inner }
    }

    pub fn status(&self) -> SidecarStatus {
        self.inner.status.borrow().clone()
    }

    pub async fn request(
        &self,
        id: String,
        method: String,
        params: Value,
        stream: Channel<Value>,
    ) -> Result<Value, String> {
        self.inner.wait_ready().await?;

        let (done, answer) = oneshot::channel();
        {
            let mut pending = self.inner.pending();
            if pending.contains_key(&id) {
                return Err(format!("request {id} is already in flight"));
            }
            pending.insert(id.clone(), Pending { done, stream });
        }

        let sent = self.inner.send(HostFrame::Request {
            id: id.clone(),
            method,
            params,
        });

        if let Err(reason) = sent {
            self.inner.pending().remove(&id);
            return Err(reason);
        }

        answer
            .await
            .unwrap_or_else(|_| Err("the sidecar stopped before it answered".to_string()))
    }

    pub fn cancel(&self, id: String) -> Result<(), String> {
        self.inner.send(HostFrame::Cancel { id })
    }

    pub fn restart(&self) {
        let inner = Arc::clone(&self.inner);
        inner.log.host("a restart was requested");
        inner.restart_requested.store(true, Ordering::SeqCst);
        inner.wake.notify_one();

        tauri::async_runtime::spawn(async move {
            let pid = inner.child.load(Ordering::SeqCst);
            if pid == 0 {
                return;
            }
            signal::interrupt(pid as u32);
            sleep(RESTART_GRACE).await;
            if inner.child.load(Ordering::SeqCst) == pid {
                signal::force(pid as u32);
            }
        });
    }

    pub fn shutdown(&self) {
        if self.inner.shutdown.swap(true, Ordering::SeqCst) {
            return;
        }

        self.inner.log.host("the app is quitting");
        self.inner.wake.notify_one();

        let pid = self.inner.child.swap(0, Ordering::SeqCst);
        if pid > 0 {
            signal::terminate_now(pid as u32);
        }
    }
}

impl Inner {
    fn pending(&self) -> MutexGuard<'_, HashMap<String, Pending>> {
        self.pending.lock().unwrap_or_else(|err| err.into_inner())
    }

    fn outbound(&self) -> MutexGuard<'_, Option<UnboundedSender<HostFrame>>> {
        self.outbound.lock().unwrap_or_else(|err| err.into_inner())
    }

    fn send(&self, frame: HostFrame) -> Result<(), String> {
        match self.outbound().as_ref() {
            Some(outbound) => outbound
                .send(frame)
                .map_err(|_| "the sidecar closed its input".to_string()),
            None => Err("the sidecar is not running".to_string()),
        }
    }

    fn publish(&self, phase: SidecarPhase, detail: Option<String>, attempt: u32) {
        let pid = match self.child.load(Ordering::SeqCst) {
            value if value > 0 => Some(value as u32),
            _ => None,
        };

        let status = SidecarStatus {
            attempt,
            detail,
            log_path: Some(self.log.path().display().to_string()),
            phase,
            pid,
        };

        // `send` drops the value when no receiver is alive, and receivers only
        // exist while `wait_ready` is waiting — so a phase published before the
        // first request would be lost and the status would read `starting`
        // forever. `send_replace` always stores it.
        self.status.send_replace(status.clone());
        let _ = self.app.emit(STATUS_EVENT, status);
    }

    fn stream(&self, id: &str, data: Value) {
        if let Some(pending) = self.pending().get(id) {
            let _ = pending.stream.send(data);
        }
    }

    fn settle(&self, id: &str, answer: Result<Value, String>) {
        if let Some(pending) = self.pending().remove(id) {
            let _ = pending.done.send(answer);
        }
    }

    fn fail_pending(&self, reason: &str) {
        let waiting: Vec<Pending> = self.pending().drain().map(|(_, pending)| pending).collect();
        for pending in waiting {
            let _ = pending.done.send(Err(reason.to_string()));
        }
    }

    async fn wait_ready(&self) -> Result<(), String> {
        let mut updates = self.status.subscribe();
        let deadline = Instant::now() + READY_TIMEOUT;

        loop {
            let (phase, detail) = {
                let status = updates.borrow_and_update();
                (status.phase, status.detail.clone())
            };

            match phase {
                SidecarPhase::Ready => return Ok(()),
                SidecarPhase::Down => {
                    return Err(detail.unwrap_or_else(|| "the sidecar is not running".to_string()))
                }
                SidecarPhase::Starting | SidecarPhase::Restarting => {}
            }

            match timeout_at(deadline, updates.changed()).await {
                Ok(Ok(())) => {}
                Ok(Err(_)) => return Err("the sidecar supervisor is gone".to_string()),
                Err(_) => return Err("the sidecar did not come up in time".to_string()),
            }
        }
    }
}

async fn supervise(inner: Arc<Inner>) {
    let mut tries: u32 = 0;

    loop {
        if inner.shutdown.load(Ordering::SeqCst) {
            break;
        }

        tries += 1;
        inner.restart_requested.store(false, Ordering::SeqCst);
        inner.publish(SidecarPhase::Starting, None, tries);

        let session = run_session(&inner).await;
        inner.child.store(0, Ordering::SeqCst);
        inner.log.host(&session.reason);
        inner.fail_pending(&session.reason);

        if inner.shutdown.load(Ordering::SeqCst) {
            break;
        }

        if session.was_ready {
            tries = 0;
        }

        if tries >= MAX_ATTEMPTS {
            inner.publish(SidecarPhase::Down, Some(session.reason), tries);
            while !inner.shutdown.load(Ordering::SeqCst)
                && !inner.restart_requested.swap(false, Ordering::SeqCst)
            {
                inner.wake.notified().await;
            }
            tries = 0;
        } else {
            inner.publish(SidecarPhase::Restarting, Some(session.reason), tries);
            sleep(backoff(tries)).await;
        }
    }

    inner.publish(
        SidecarPhase::Down,
        Some("the app is closing".to_string()),
        0,
    );
}

async fn run_session(inner: &Arc<Inner>) -> Session {
    let bun = match spawn::resolve_bun() {
        Ok(path) => path,
        Err(reason) => return stillborn(reason),
    };

    let script = match spawn::resolve_script(&inner.app) {
        Ok(path) => path,
        Err(reason) => return stillborn(reason),
    };

    let data_dir = match spawn::resolve_data_dir(&inner.app) {
        Ok(path) => path,
        Err(reason) => return stillborn(reason),
    };

    inner
        .log
        .host(format!("starting {} {}", bun.display(), script.display()));

    let mut child = match spawn::launch(&bun, &script, &data_dir) {
        Ok(child) => child,
        Err(reason) => return stillborn(reason),
    };

    inner
        .child
        .store(child.id().unwrap_or_default() as i32, Ordering::SeqCst);

    let (Some(stdin), Some(stdout), Some(stderr)) =
        (child.stdin.take(), child.stdout.take(), child.stderr.take())
    else {
        return stillborn("the sidecar was started without pipes".to_string());
    };

    let (outbound, inbox) = unbounded_channel::<HostFrame>();
    *inner.outbound() = Some(outbound);

    let was_ready = Arc::new(AtomicBool::new(false));
    let writer = tauri::async_runtime::spawn(write_frames(stdin, inbox, Arc::clone(inner)));
    let logger = tauri::async_runtime::spawn(copy_stderr(stderr, Arc::clone(inner)));
    let reader = tauri::async_runtime::spawn(read_frames(
        stdout,
        Arc::clone(inner),
        Arc::clone(&was_ready),
    ));

    let exit = child.wait().await;

    *inner.outbound() = None;
    let _ = reader.await;
    let _ = writer.await;
    let _ = logger.await;

    let reason = match exit {
        Ok(status) => format!("the sidecar stopped with {}", signal::describe_exit(status)),
        Err(err) => format!("lost track of the sidecar: {err}"),
    };

    Session {
        reason,
        was_ready: was_ready.load(Ordering::SeqCst),
    }
}

fn stillborn(reason: String) -> Session {
    Session {
        reason,
        was_ready: false,
    }
}

async fn read_frames(stdout: ChildStdout, inner: Arc<Inner>, was_ready: Arc<AtomicBool>) {
    let mut lines = BufReader::new(stdout).lines();

    loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                if line.trim().is_empty() {
                    continue;
                }
                match serde_json::from_str::<SidecarFrame>(&line) {
                    Ok(frame) => handle_frame(&inner, frame, &was_ready),
                    Err(err) => inner
                        .log
                        .host(format!("dropped a frame it could not parse ({err}): {line}")),
                }
            }
            Ok(None) => break,
            Err(err) => {
                inner
                    .log
                    .host(format!("could not read from the sidecar: {err}"));
                break;
            }
        }
    }
}

fn handle_frame(inner: &Arc<Inner>, frame: SidecarFrame, was_ready: &AtomicBool) {
    match frame {
        SidecarFrame::Ready { protocol, pid } => {
            if protocol != PROTOCOL {
                inner.log.host(format!(
                    "protocol mismatch: the sidecar speaks {protocol}, the host speaks {PROTOCOL}"
                ));
            }
            inner.log.host(format!("ready (pid {pid})"));
            was_ready.store(true, Ordering::SeqCst);
            inner.publish(SidecarPhase::Ready, None, 0);
        }
        SidecarFrame::Stream { id, data } => inner.stream(&id, data),
        SidecarFrame::Result { id, data } => inner.settle(&id, Ok(data)),
        SidecarFrame::Error { id, message } => inner.settle(&id, Err(message)),
        SidecarFrame::Notify { channel, data } => {
            let _ = inner
                .app
                .emit(NOTIFY_EVENT, SidecarNotification { channel, data });
        }
    }
}

async fn write_frames(
    mut stdin: ChildStdin,
    mut inbox: UnboundedReceiver<HostFrame>,
    inner: Arc<Inner>,
) {
    while let Some(frame) = inbox.recv().await {
        let mut line = match serde_json::to_vec(&frame) {
            Ok(bytes) => bytes,
            Err(err) => {
                inner.log.host(format!("could not encode a frame: {err}"));
                continue;
            }
        };
        line.push(b'\n');

        if stdin.write_all(&line).await.is_err() || stdin.flush().await.is_err() {
            inner.log.host("could not write to the sidecar");
            break;
        }
    }
}

async fn copy_stderr(stderr: ChildStderr, inner: Arc<Inner>) {
    let mut lines = BufReader::new(stderr).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        inner.log.sidecar(line);
    }
}

fn backoff(tries: u32) -> Duration {
    Duration::from_millis(400u64 << tries.min(4))
}
