use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    thread,
};

use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};

const FILE_NAME: &str = "sidecar.log";
const MAX_BYTES: u64 = 4 * 1024 * 1024;

pub struct SidecarLog {
    path: PathBuf,
    writer: UnboundedSender<String>,
}

impl SidecarLog {
    pub fn open(dir: &Path) -> Self {
        let _ = fs::create_dir_all(dir);
        let path = dir.join(FILE_NAME);
        rotate(&path);

        let (writer, mut lines) = unbounded_channel::<String>();
        let target = path.clone();

        thread::spawn(move || {
            let Ok(mut file) = fs::OpenOptions::new()
                .append(true)
                .create(true)
                .open(&target)
            else {
                return;
            };
            while let Some(line) = lines.blocking_recv() {
                let _ = writeln!(file, "{line}");
                let _ = file.flush();
            }
        });

        Self { path, writer }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn host(&self, message: impl AsRef<str>) {
        self.append("host", message.as_ref());
    }

    pub fn sidecar(&self, message: impl AsRef<str>) {
        self.append("sidecar", message.as_ref());
    }

    fn append(&self, source: &str, message: &str) {
        let stamp = OffsetDateTime::now_utc()
            .format(&Rfc3339)
            .unwrap_or_default();
        let _ = self.writer.send(format!("{stamp} [{source}] {message}"));
    }
}

fn rotate(path: &Path) {
    let Ok(meta) = fs::metadata(path) else {
        return;
    };
    if meta.len() > MAX_BYTES {
        let _ = fs::rename(path, path.with_extension("log.old"));
    }
}
