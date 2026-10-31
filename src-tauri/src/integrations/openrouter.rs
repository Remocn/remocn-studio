use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::Client;
use serde_json::{json, Value};

use super::{
    provider::{Adapter, Answering, Checked, Descriptor},
    sound_http::{bounded, validate_mp3, Audio, UNCERTAIN},
    sounds::SoundRequest,
};

pub const BASE: &str = "https://openrouter.ai/api/v1";
pub const SPEECH_MODEL: &str = "elevenlabs/eleven-v4";
pub const TURBO_MODEL: &str = "elevenlabs/eleven-v4-turbo";
pub const SOUND_MODEL: &str = "bytedance-seed/seed-audio-1-0";
pub const MUSIC_MODEL: &str = "google/lyria-3-pro-preview";
const AUDIO_LIMIT: usize = 32 * 1024 * 1024;
const VOICES: &[&str] = &[
    "george", "sarah", "adam", "alice", "bella", "bill", "brian", "callum", "charlie", "chris",
    "daniel", "eric", "harry", "jessica", "laura", "liam", "lily", "matilda", "river", "roger",
    "will",
];

pub struct OpenRouter;

impl Adapter for OpenRouter {
    fn describe(&self) -> Descriptor {
        Descriptor {
            id: "openrouter",
            name: "OpenRouter",
            authorization: vec!["api-key"],
            capabilities: vec!["audio"],
        }
    }

    fn check<'a>(&'a self, secret: Option<&'a str>) -> Answering<'a, Checked> {
        Box::pin(async move {
            let key = secret.ok_or("OpenRouter needs an API key.")?;
            let client = super::sound_http::client()?;
            let body = account(&client, BASE, key).await?;
            Ok(Checked {
                account: body
                    .pointer("/data/label")
                    .and_then(Value::as_str)
                    .filter(|label| !label.contains(key))
                    .map(str::to_string),
                capabilities: vec!["audio".to_string()],
            })
        })
    }
}

pub async fn account(client: &Client, base: &str, key: &str) -> Result<Value, String> {
    let response = client
        .get(format!("{base}/key"))
        .bearer_auth(key)
        .timeout(Duration::from_secs(7))
        .send()
        .await
        .map_err(|_| "OpenRouter could not be reached to check the key.".to_string())?;
    if !response.status().is_success() {
        return Err(refusal(response.status().as_u16()));
    }
    let bytes = bounded(response, 128 * 1024).await?;
    let body: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "OpenRouter returned unreadable account information.".to_string())?;
    if !body.get("data").is_some_and(Value::is_object) {
        return Err("OpenRouter returned no key information.".to_string());
    }
    Ok(body)
}

pub fn model(request: &SoundRequest) -> &str {
    if request.is_music() {
        MUSIC_MODEL
    } else if request.is_speech() {
        request.model.as_deref().unwrap_or(SPEECH_MODEL)
    } else {
        SOUND_MODEL
    }
}

pub fn validate_speech(request: &SoundRequest) -> Result<(), String> {
    if request.connection_id.is_empty()
        || request.name.trim().is_empty()
        || request.name.encode_utf16().count() > 5000
        || request.text.trim().is_empty()
        || request.text.chars().count() > 10000
    {
        return Err(
            "Narration needs a connection, a name, and a script up to 10,000 characters."
                .to_string(),
        );
    }
    if !matches!(request.model.as_deref(), Some(SPEECH_MODEL | TURBO_MODEL)) {
        return Err("Choose Eleven v4 or Eleven v4 Turbo for narration.".to_string());
    }
    if !request
        .voice
        .as_deref()
        .is_some_and(|voice| VOICES.contains(&voice))
    {
        return Err(
            "Choose a supported OpenRouter ElevenLabs voice, such as george or sarah.".to_string(),
        );
    }
    if request.format != "mp3"
        || request.duration_seconds.is_some()
        || request.force_instrumental.is_some()
    {
        return Err("Narration uses MP3 and follows the script's natural duration.".to_string());
    }
    Ok(())
}

fn prompt(request: &SoundRequest) -> String {
    let mut prompt = request.text.clone();
    if request.is_music() && request.force_instrumental == Some(true) {
        prompt.push_str("\nInstrumental only. No singing, speech, or vocals.");
    }
    if let Some(duration) = request.duration_seconds {
        prompt.push_str(&format!("\nTarget duration: {duration} seconds."));
    }
    prompt
}

pub fn validate_request(request: &SoundRequest) -> Result<(), String> {
    request.validate()?;
    if request.is_speech() && request.model.as_deref() != Some(SPEECH_MODEL) {
        return Err("New narration uses Eleven v4. Choose elevenlabs/eleven-v4; no speech model substitution is allowed.".to_string());
    }
    if !request.is_speech() && request.format != "mp3_44100_128" {
        return Err("OpenRouter selects the MP3 bitrate. Use the default format; 192 kbps is not supported here.".to_string());
    }
    if !request.is_speech() && !request.is_music() && prompt(request).chars().count() > 3000 {
        return Err("Seed Audio accepts up to 3,000 characters including the duration direction. Shorten this sound description.".to_string());
    }
    Ok(())
}

fn payload(request: &SoundRequest) -> Value {
    if request.is_music() {
        json!({
            "model": MUSIC_MODEL,
            "messages": [{"role": "user", "content": prompt(request)}],
            "modalities": ["text", "audio"],
            "audio": {"format": "mp3"},
            "stream": true,
            "provider": {"allow_fallbacks": false}
        })
    } else {
        let mut body = json!({
            "model": model(request),
            "input": if request.is_speech() { request.text.clone() } else { prompt(request) },
            "response_format": "mp3"
        });
        if let Some(voice) = &request.voice {
            body["voice"] = json!(voice);
        }
        body
    }
}

pub async fn generate(
    client: &Client,
    base: &str,
    key: &str,
    request: &SoundRequest,
) -> Result<Audio, String> {
    validate_request(request)?;
    let endpoint = if request.is_music() {
        "chat/completions"
    } else {
        "audio/speech"
    };
    let response = client
        .post(format!("{base}/{endpoint}"))
        .bearer_auth(key)
        .header("X-Title", "Remocn Studio")
        .timeout(Duration::from_secs(600))
        .json(&payload(request))
        .send()
        .await
        .map_err(|_| UNCERTAIN.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "{} Model: {}. HTTP {}. No replacement was generated.",
            refusal(response.status().as_u16()),
            model(request),
            response.status().as_u16()
        ));
    }
    let mime = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim();
    let expected = if request.is_music() {
        "text/event-stream"
    } else {
        "audio/mpeg"
    };
    if mime != expected && !(mime == "audio/mp3" && !request.is_music()) {
        return Err(format!(
            "OpenRouter returned an unexpected audio format. {UNCERTAIN}"
        ));
    }
    let request_id = response
        .headers()
        .get("x-generation-id")
        .and_then(|v| v.to_str().ok())
        .filter(|v| {
            v.len() <= 128
                && !v.contains(key)
                && v.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
        .map(str::to_string);
    let bytes = bounded(
        response,
        if request.is_music() {
            AUDIO_LIMIT * 2
        } else {
            AUDIO_LIMIT
        },
    )
    .await?;
    let mut audio = if request.is_music() {
        decode_music(&bytes)?
    } else {
        Audio {
            bytes,
            request_id,
            cost: None,
        }
    };
    if audio.request_id.as_ref().is_some_and(|id| id.contains(key)) {
        audio.request_id = None;
    }
    validate_mp3(&audio.bytes)?;
    Ok(audio)
}

// Audio chunks are independently base64 encoded, so decode each before joining.
fn decode_music(bytes: &[u8]) -> Result<Audio, String> {
    let stream = std::str::from_utf8(bytes).map_err(|_| UNCERTAIN.to_string())?;
    let mut audio = Audio {
        bytes: Vec::new(),
        request_id: None,
        cost: None,
    };
    let mut done = false;
    for line in stream.lines() {
        let Some(data) = line.strip_prefix("data:") else {
            continue;
        };
        let data = data.trim();
        if data == "[DONE]" {
            done = true;
            break;
        }
        let chunk: Value = serde_json::from_str(data).map_err(|_| UNCERTAIN.to_string())?;
        if chunk.get("error").is_some() || chunk.pointer("/choices/0/error").is_some() {
            return Err(format!(
                "OpenRouter interrupted music generation. {UNCERTAIN}"
            ));
        }
        if let Some(id) = chunk.get("id").and_then(Value::as_str) {
            if id.len() <= 128
                && id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
            {
                audio.request_id = Some(id.to_string());
            }
        }
        if let Some(cost) = chunk.pointer("/usage/cost").and_then(Value::as_f64) {
            if cost.is_finite() && cost >= 0.0 {
                audio.cost = Some(format!("${cost:.6}"));
            }
        }
        if let Some(data) = chunk
            .pointer("/choices/0/delta/audio/data")
            .and_then(Value::as_str)
        {
            let decoded = STANDARD.decode(data).map_err(|_| UNCERTAIN.to_string())?;
            if audio.bytes.len() + decoded.len() > AUDIO_LIMIT {
                return Err(UNCERTAIN.to_string());
            }
            audio.bytes.extend_from_slice(&decoded);
        }
    }
    if !done || audio.bytes.is_empty() {
        return Err(format!("OpenRouter returned incomplete music. {UNCERTAIN}"));
    }
    Ok(audio)
}

fn refusal(status: u16) -> String {
    match status {
        401 | 403 => "OpenRouter rejected access. Check the API key and model permissions in Settings > Integrations, and enable the model provider and accept its terms in OpenRouter provider settings.".to_string(),
        402 => "OpenRouter has insufficient credits for this request.".to_string(),
        404 => "OpenRouter could not route this audio model. Check the model availability and your OpenRouter provider settings. For Seed Audio, enable Seed and accept its provider terms.".to_string(),
        400 | 422 => "OpenRouter refused the model, voice, or audio parameters. Check the model's current availability and input limits.".to_string(),
        429 => "OpenRouter is rate-limiting this key. No automatic generation retry will be made.".to_string(),
        _ => format!("OpenRouter answered with HTTP {status}. {UNCERTAIN}"),
    }
}

#[cfg(test)]
mod tests {
    use super::super::sound_http::{
        client,
        tests::{mp3, request, server},
    };
    use super::*;

    fn speech() -> SoundRequest {
        SoundRequest {
            kind: Some("speech".into()),
            model: Some(SPEECH_MODEL.into()),
            voice: Some("george".into()),
            duration_seconds: None,
            format: "mp3".into(),
            ..request()
        }
    }

    #[tokio::test]
    async fn speech_uses_openrouter_auth_endpoint_and_v4_without_elevenlabs_headers() {
        let (base, received, worker) = server("200 OK", "audio/mpeg", mp3());
        let audio = generate(&client().unwrap(), &base, "test-openrouter-key", &speech())
            .await
            .unwrap();
        worker.join().unwrap();
        assert_eq!(audio.bytes, mp3());
        let requests = received.lock().unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].starts_with("POST /audio/speech "));
        assert!(requests[0].contains("authorization: Bearer test-openrouter-key"));
        assert!(!requests[0].contains("xi-api-key"));
        let body: Value =
            serde_json::from_str(requests[0].split("\r\n\r\n").nth(1).unwrap()).unwrap();
        assert_eq!(body["model"], SPEECH_MODEL);
        assert_eq!(body["voice"], "george");
        assert_eq!(body["response_format"], "mp3");
    }

    #[test]
    fn sound_uses_a_non_speech_prompt_and_no_voice() {
        let body = payload(&request());
        assert_eq!(body["model"], SOUND_MODEL);
        assert!(body["input"]
            .as_str()
            .unwrap()
            .contains("Target duration: 2 seconds"));
        assert!(body.get("voice").is_none());
        let mut long = request();
        long.text = "x".repeat(3000);
        assert!(validate_request(&long).is_err());
    }

    #[test]
    fn speech_limits_and_voices_are_checked_before_dispatch() {
        let mut input = speech();
        input.model = Some(TURBO_MODEL.into());
        assert!(validate_speech(&input).is_ok());
        assert!(validate_request(&input).is_err());
        input.model = Some(SPEECH_MODEL.into());
        input.text = "😀".repeat(10000);
        assert!(validate_request(&input).is_ok());
        input.text.push('a');
        assert!(validate_request(&input).is_err());
        input.text = "Hello".into();
        input.voice = Some("unknown".into());
        assert!(validate_request(&input).is_err());
    }

    #[test]
    fn music_stream_decodes_chunks_and_rejects_truncated_or_error_streams() {
        let data = STANDARD.encode(mp3());
        let event = json!({"id":"gen-123", "choices":[{"delta":{"audio":{"data":data}}}], "usage":{"cost":0.08}});
        let stream = format!("data: {event}\n\ndata: [DONE]\n\n");
        let audio = decode_music(stream.as_bytes()).unwrap();
        assert_eq!(audio.bytes, mp3());
        assert_eq!(audio.cost.as_deref(), Some("$0.080000"));
        assert!(decode_music(format!("data: {event}\n\n").as_bytes()).is_err());
        assert!(decode_music(b"data: {\"error\":{}}\n\ndata: [DONE]\n").is_err());
    }

    #[tokio::test]
    async fn errors_do_not_echo_keys_or_retry() {
        let (base, received, worker) = server(
            "402 Payment Required",
            "application/json",
            br#"{"error":"test-key"}"#.to_vec(),
        );
        let error = generate(&client().unwrap(), &base, "test-key", &speech())
            .await
            .err()
            .unwrap();
        worker.join().unwrap();
        assert!(error.contains("credits"));
        assert!(error.contains("HTTP 402"));
        assert!(error.contains(SPEECH_MODEL));
        assert!(!error.contains("test-key"));
        assert_eq!(received.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn unavailable_seed_route_explains_provider_settings_without_echoing_the_body() {
        let (base, received, worker) = server(
            "404 Not Found",
            "application/json",
            br#"{"error":{"message":"private-prompt test-key"}}"#.to_vec(),
        );
        let error = generate(&client().unwrap(), &base, "test-key", &request())
            .await
            .err()
            .unwrap();
        worker.join().unwrap();
        assert!(error.contains("HTTP 404"));
        assert!(error.contains(SOUND_MODEL));
        assert!(error.contains("enable Seed and accept its provider terms"));
        assert!(!error.contains("private-prompt"));
        assert!(!error.contains("test-key"));
        assert_eq!(received.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn key_check_uses_read_only_openrouter_endpoint() {
        let (base, received, worker) = server(
            "200 OK",
            "application/json",
            br#"{"data":{"label":"Studio"}}"#.to_vec(),
        );
        assert!(account(&client().unwrap(), &base, "test-key").await.is_ok());
        worker.join().unwrap();
        assert!(received.lock().unwrap()[0].starts_with("GET /key "));
    }
}

#[cfg(test)]
mod music_tests {
    use super::super::sound_http::{
        client,
        tests::{mp3, request, server},
    };
    use super::*;

    #[tokio::test]
    async fn music_uses_streaming_chat_audio_and_instrumental_direction() {
        let event = json!({"choices":[{"delta":{"audio":{"data":STANDARD.encode(mp3())}}}]});
        let stream = format!("data: {event}\n\ndata: [DONE]\n\n");
        let (base, received, worker) = server("200 OK", "text/event-stream", stream.into_bytes());
        let request = SoundRequest {
            kind: Some("music".into()),
            force_instrumental: Some(true),
            duration_seconds: Some(30.0),
            ..request()
        };
        let audio = generate(&client().unwrap(), &base, "test-key", &request)
            .await
            .unwrap();
        worker.join().unwrap();
        assert_eq!(audio.bytes, mp3());
        let received = received.lock().unwrap();
        assert_eq!(received.len(), 1);
        assert!(received[0].starts_with("POST /chat/completions "));
        let body: Value =
            serde_json::from_str(received[0].split("\r\n\r\n").nth(1).unwrap()).unwrap();
        assert_eq!(body["model"], MUSIC_MODEL);
        assert_eq!(body["stream"], true);
        assert_eq!(body["audio"]["format"], "mp3");
        assert!(body["messages"][0]["content"]
            .as_str()
            .unwrap()
            .contains("Instrumental only"));
        assert!(body.get("voice").is_none());
    }

    #[test]
    fn mp3_validation_accepts_provider_sample_rates_without_accepting_truncation() {
        // MPEG-1 Layer III, 128 kbps at 48 kHz: 384 bytes per frame.
        let mut bytes = vec![0; 384 * 3];
        for offset in [0, 384, 768] {
            bytes[offset..offset + 4].copy_from_slice(&[255, 251, 148, 0]);
        }
        assert!(validate_mp3(&bytes).is_ok());
        assert!(validate_mp3(&bytes[..1000]).is_err());
        // MPEG-2 Layer III, 64 kbps at 22.05 kHz: 208 bytes per frame.
        let mut bytes = vec![0; 208 * 3];
        for offset in [0, 208, 416] {
            bytes[offset..offset + 4].copy_from_slice(&[255, 243, 128, 0]);
        }
        assert!(validate_mp3(&bytes).is_ok());
    }
}
