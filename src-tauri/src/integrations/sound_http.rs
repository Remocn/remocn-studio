use std::time::Duration;

use reqwest::{Client, Response};
use serde_json::Value;

use super::sounds::SoundRequest;

pub const BASE: &str = "https://api.elevenlabs.io";
pub const MODEL: &str = "eleven_text_to_sound_v2";
pub const UNCERTAIN: &str = "The audio provider may have used credits, but the result could not be confirmed. Check this operation before approving another generation; it will not be retried automatically.";
const LIMIT: usize = 8 * 1024 * 1024;
pub const MUSIC_MODEL: &str = "music_v1";

pub fn client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never())
        .build()
        .map_err(|_| "The studio could not prepare its audio connection.".to_string())
}

pub async fn account(client: &Client, base: &str, key: &str) -> Result<Value, String> {
    let response = client
        .get(format!("{base}/v1/user"))
        .header("xi-api-key", key)
        .timeout(Duration::from_secs(7))
        .send()
        .await
        .map_err(|_| "ElevenLabs could not be reached to check account access.".to_string())?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 | 403 => "ElevenLabs rejected account access. Check that the key is active and permits User read in Settings → Integrations.",
            429 => "ElevenLabs is rate-limiting account checks. Try checking the connection later.",
            _ => "ElevenLabs could not confirm account access. Nothing was generated.",
        }.to_string());
    }
    let bytes = bounded(response, 128 * 1024).await.map_err(|_| {
        "ElevenLabs account information could not be read. Nothing was generated.".to_string()
    })?;
    serde_json::from_slice(&bytes)
        .map_err(|_| "ElevenLabs returned unreadable account information.".to_string())
}

pub fn check_format(request: &SoundRequest, account: &Value) -> Result<(), String> {
    request.validate()?;
    if request.format == "mp3_44100_192" {
        let tier = account
            .pointer("/subscription/tier")
            .and_then(Value::as_str)
            .unwrap_or("");
        if !matches!(
            tier,
            "creator" | "pro" | "scale" | "business" | "enterprise"
        ) {
            return Err("MP3 at 192 kbps requires an ElevenLabs Creator plan or higher. Choose 128 kbps or check your plan.".to_string());
        }
    }
    Ok(())
}

pub struct Audio {
    pub bytes: Vec<u8>,
    pub request_id: Option<String>,
    pub cost: Option<String>,
}

pub async fn generate(
    client: &Client,
    base: &str,
    key: &str,
    request: &SoundRequest,
) -> Result<Audio, String> {
    request.validate()?;
    let (endpoint, body) = if request.is_music() {
        (
            "music",
            serde_json::json!({
                "prompt": request.text,
                "music_length_ms": request.duration_seconds.map(|seconds| (seconds * 1000.0).round() as u64),
                "model_id": MUSIC_MODEL,
                "force_instrumental": request.force_instrumental.unwrap_or(true)
            }),
        )
    } else {
        (
            "sound-generation",
            serde_json::json!({"text": request.text, "duration_seconds": request.duration_seconds, "model_id": MODEL}),
        )
    };
    let response = client
        .post(format!(
            "{base}/v1/{endpoint}?output_format={}",
            request.format
        ))
        .timeout(Duration::from_secs(if request.is_music() {
            600
        } else {
            120
        }))
        .header("xi-api-key", key)
        .json(&body)
        .send()
        .await
        .map_err(|_| UNCERTAIN.to_string())?;
    if !response.status().is_success() {
        return Err(refused(response, request.is_music()).await);
    }
    let mime = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if !mime
        .split(';')
        .next()
        .is_some_and(|value| matches!(value.trim(), "audio/mpeg" | "audio/mp3"))
    {
        return Err(format!(
            "ElevenLabs returned a non-audio response. {UNCERTAIN}"
        ));
    }
    let safe_header = |name| {
        response
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .filter(|value| {
                value.len() <= 128
                    && !value.contains(key)
                    && value
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
            })
            .map(str::to_string)
    };
    let request_id = safe_header("song-id").or_else(|| safe_header("request-id"));
    let cost = safe_header("character-cost");
    let bytes = bounded(
        response,
        if request.is_music() {
            20 * 1024 * 1024
        } else {
            LIMIT
        },
    )
    .await?;
    validate_mp3(&bytes)?;
    Ok(Audio {
        bytes,
        request_id,
        cost,
    })
}

pub(super) async fn bounded(mut response: Response, limit: usize) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|size| size > limit as u64)
    {
        return Err(format!(
            "ElevenLabs returned more data than the studio can save. {UNCERTAIN}"
        ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| UNCERTAIN.to_string())? {
        if bytes.len() + chunk.len() > limit {
            return Err(format!(
                "ElevenLabs returned more data than the studio can save. {UNCERTAIN}"
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

async fn refused(response: Response, music: bool) -> String {
    let status = response.status().as_u16();
    let code = bounded(response, 8192)
        .await
        .ok()
        .and_then(|body| serde_json::from_slice::<Value>(&body).ok())
        .and_then(|body| {
            body.pointer("/detail/status")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
    if matches!(
        code.as_deref(),
        Some("quota_exceeded" | "insufficient_credits" | "insufficient_balance")
    ) || status == 402
    {
        return "ElevenLabs refused generation because the account has insufficient credits or quota. Review your ElevenLabs allowance.".to_string();
    }
    match status {
        401 | 403 if music => "ElevenLabs rejected music access. Check your Music API access, account plan and API key permissions in Settings → Integrations.".to_string(),
        401 | 403 => "ElevenLabs rejected access. Check that the key is active and permits User read and Sound Generation, then replace it in Settings → Integrations.".to_string(),
        400 | 422 => "ElevenLabs refused these audio parameters or output format. Check the description, duration, format and account plan.".to_string(),
        429 => "ElevenLabs is rate-limiting this account. No automatic generation retry will be made.".to_string(),
        _ => UNCERTAIN.to_string(),
    }
}

pub fn validate_mp3(bytes: &[u8]) -> Result<(), String> {
    let invalid =
        || format!("The audio provider returned incomplete or unreadable MP3 audio. {UNCERTAIN}");
    let mut offset = 0;
    if bytes.starts_with(b"ID3") {
        if bytes.len() < 10 || bytes[6..10].iter().any(|value| value & 128 != 0) {
            return Err(invalid());
        }
        offset = 10
            + bytes[6..10]
                .iter()
                .fold(0_usize, |size, value| (size << 7) | *value as usize);
        if bytes[3] == 4 && bytes[5] & 16 != 0 {
            offset += 10;
        }
    }
    let mut frames = 0;
    while offset + 4 <= bytes.len() {
        if bytes.len() - offset == 128 && bytes[offset..].starts_with(b"TAG") {
            offset = bytes.len();
            break;
        }
        let h = &bytes[offset..offset + 4];
        let version = (h[1] >> 3) & 3;
        let sample_index = ((h[2] >> 2) & 3) as usize;
        if h[0] != 255 || h[1] & 0xe0 != 0xe0 || h[1] & 6 != 2 || version == 1 || sample_index == 3
        {
            return Err(invalid());
        }
        let rates = if version == 3 {
            [
                0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
            ]
        } else {
            [
                0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
            ]
        };
        let kbps = rates[(h[2] >> 4) as usize];
        let sample_rate = [44100, 48000, 32000][sample_index]
            / if version == 3 {
                1
            } else if version == 2 {
                2
            } else {
                4
            };
        if kbps == 0 {
            return Err(invalid());
        }
        let length = (if version == 3 { 144000 } else { 72000 }) * kbps / sample_rate
            + ((h[2] >> 1) & 1) as usize;
        offset += length;
        if offset > bytes.len() {
            return Err(invalid());
        }
        frames += 1;
    }
    if frames < 2 || offset != bytes.len() {
        return Err(invalid());
    }
    Ok(())
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        sync::{Arc, Mutex},
        thread,
    };

    pub fn mp3() -> Vec<u8> {
        let mut bytes = vec![0; 417 * 3];
        for offset in [0, 417, 834] {
            bytes[offset..offset + 4].copy_from_slice(&[255, 251, 144, 0]);
        }
        bytes
    }

    pub fn request() -> SoundRequest {
        SoundRequest {
            model: None,
            voice: None,
            kind: None,
            force_instrumental: None,
            connection_id: "cn_test".to_string(),
            name: "Door".to_string(),
            text: "A door closes".to_string(),
            duration_seconds: Some(2.0),
            format: "mp3_44100_128".to_string(),
        }
    }

    pub fn server(
        status: &str,
        mime: &str,
        body: Vec<u8>,
    ) -> (String, Arc<Mutex<Vec<String>>>, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let requests = Arc::new(Mutex::new(Vec::new()));
        let received = Arc::clone(&requests);
        let head = format!("HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\ncharacter-cost: 10\r\nrequest-id: req_test\r\n\r\n", body.len());
        let worker = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut chunk = [0; 2048];
                let size = socket.read(&mut chunk).unwrap();
                if size == 0 {
                    break;
                }
                bytes.extend_from_slice(&chunk[..size]);
                if let Some(at) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..at]).to_lowercase();
                    let length = headers
                        .lines()
                        .find_map(|line| line.strip_prefix("content-length: "))
                        .and_then(|value| value.parse::<usize>().ok())
                        .unwrap_or(0);
                    if bytes.len() >= at + 4 + length {
                        break;
                    }
                }
            }
            received
                .lock()
                .unwrap()
                .push(String::from_utf8(bytes).unwrap());
            socket.write_all(head.as_bytes()).unwrap();
            socket.write_all(&body).unwrap();
        });
        (base, requests, worker)
    }

    #[test]
    fn validates_complete_frames_and_refuses_truncation_and_fake_audio() {
        assert!(validate_mp3(&mp3()).is_ok());
        assert!(validate_mp3(&mp3()[..1000]).is_err());
        assert!(validate_mp3(b"ID3").is_err());
        assert!(validate_mp3(b"{\"detail\":\"not audio\"}").is_err());
        assert!(validate_mp3(&[]).is_err());
    }

    #[test]
    fn duration_description_and_tier_are_checked_before_spending() {
        for duration in [0.0, 30.1, f64::NAN, f64::INFINITY] {
            let mut request = request();
            request.duration_seconds = Some(duration);
            assert!(request.validate().is_err());
        }
        let mut request = request();
        request.format = "mp3_44100_192".to_string();
        assert!(check_format(
            &request,
            &serde_json::json!({"subscription":{"tier":"free"}})
        )
        .is_err());
        assert!(check_format(
            &request,
            &serde_json::json!({"subscription":{"tier":"future-tier"}})
        )
        .is_err());
        assert!(check_format(
            &request,
            &serde_json::json!({"subscription":{"tier":"creator"}})
        )
        .is_ok());
        request.text = " ".to_string();
        assert!(request.validate().is_err());
    }

    #[tokio::test]
    async fn sends_the_exact_paid_request_once_and_returns_audio_and_cost() {
        let (base, received, worker) = server("200 OK", "audio/mpeg", mp3());
        let audio = generate(&client().unwrap(), &base, "test-key-not-real", &request())
            .await
            .unwrap();
        worker.join().unwrap();
        assert_eq!(audio.bytes, mp3());
        assert_eq!(audio.cost.as_deref(), Some("10"));
        let received = received.lock().unwrap();
        assert_eq!(received.len(), 1);
        assert!(received[0].starts_with("POST /v1/sound-generation?output_format=mp3_44100_128"));
        assert!(received[0].contains("xi-api-key: test-key-not-real"));
        assert!(received[0].contains("\"duration_seconds\":2.0"));
        assert!(received[0].contains(MODEL));
    }

    #[tokio::test]
    async fn safe_errors_never_echo_provider_bodies_or_retry_paid_requests() {
        for (status, code, expected) in [
            ("401 Unauthorized", "quota_exceeded", "credits"),
            ("403 Forbidden", "missing_permissions", "Sound Generation"),
            ("429 Too Many Requests", "rate_limit", "rate-limiting"),
            ("422 Unprocessable Entity", "format", "format"),
            ("503 Service Unavailable", "internal", "may have"),
        ] {
            let body = serde_json::json!({"detail":{"status":code,"message":"test-key-not-real"}})
                .to_string()
                .into_bytes();
            let (base, received, worker) = server(status, "application/json", body);
            let error = generate(&client().unwrap(), &base, "test-key-not-real", &request())
                .await
                .err()
                .unwrap();
            worker.join().unwrap();
            assert!(error.contains(expected), "{error}");
            assert!(!error.contains("test-key-not-real"));
            assert_eq!(received.lock().unwrap().len(), 1);
        }
    }

    #[tokio::test]
    async fn music_uses_its_endpoint_model_duration_and_vocal_preference_once() {
        for instrumental in [true, false] {
            let mut request = request();
            request.kind = Some("music".to_string());
            request.force_instrumental = Some(instrumental);
            request.duration_seconds = Some(120.0);
            let (base, received, worker) = server("200 OK", "audio/mpeg", mp3());
            let audio = generate(&client().unwrap(), &base, "test-key", &request)
                .await
                .unwrap();
            worker.join().unwrap();
            assert_eq!(audio.bytes, mp3());
            let received = received.lock().unwrap();
            assert_eq!(received.len(), 1);
            assert!(received[0].starts_with("POST /v1/music?output_format=mp3_44100_128"));
            let body: Value =
                serde_json::from_str(received[0].split("\r\n\r\n").nth(1).unwrap()).unwrap();
            assert_eq!(body["model_id"], MUSIC_MODEL);
            assert_eq!(body["music_length_ms"], 120000);
            assert_eq!(body["force_instrumental"], instrumental);
            assert_eq!(body["prompt"], request.text);
            assert!(body.get("duration_seconds").is_none());
        }
    }

    #[test]
    fn music_validation_and_serialization_preserve_the_operation_kind() {
        let mut request = request();
        request.kind = Some("music".to_string());
        request.force_instrumental = Some(true);
        for duration in [3.0, 600.0] {
            request.duration_seconds = Some(duration);
            assert!(request.validate().is_ok());
        }
        for duration in [2.9, 600.1, f64::NAN] {
            request.duration_seconds = Some(duration);
            assert!(request.validate().is_err());
        }
        request.duration_seconds = None;
        assert!(request.validate().is_ok());
        let decoded: SoundRequest =
            serde_json::from_value(serde_json::to_value(&request).unwrap()).unwrap();
        assert!(decoded.is_music());
        assert_eq!(decoded.force_instrumental, Some(true));
        request.text = "x".repeat(4101);
        assert!(request.validate().is_err());
        request.text = "Music".to_string();
        request.force_instrumental = None;
        assert!(request.validate().is_err());
    }

    #[tokio::test]
    async fn account_check_does_not_generate_a_sound() {
        let (base, received, worker) = server(
            "200 OK",
            "application/json",
            br#"{"user_id":"u1","subscription":{"tier":"creator"}}"#.to_vec(),
        );
        assert!(account(&client().unwrap(), &base, "test-key").await.is_ok());
        worker.join().unwrap();
        assert!(received.lock().unwrap()[0].starts_with("GET /v1/user "));
    }
}
