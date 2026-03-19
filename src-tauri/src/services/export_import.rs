use aes_gcm_siv::{
    aead::{Aead, KeyInit},
    Aes256GcmSiv, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use pbkdf2::pbkdf2_hmac;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::io::{Cursor, Write};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

use crate::db::models::BackupExportData;

const KEY_LEN: usize = 32;
const PBKDF2_ITERATIONS: u32 = 120_000;

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedEnvelope {
    pub algorithm: String,
    pub iterations: u32,
    pub salt_b64: String,
    pub nonce_b64: String,
    pub ciphertext_b64: String,
}

pub fn redact_settings(input: &[(String, Option<String>)]) -> Vec<(String, Option<String>)> {
    input
        .iter()
        .map(|(k, v)| {
            if is_secret_key(k) {
                (k.clone(), None)
            } else {
                (k.clone(), v.clone())
            }
        })
        .collect()
}

pub fn sanitize_json(value: Option<String>, include_secrets: bool) -> Option<String> {
    if include_secrets {
        return value;
    }

    let Some(raw) = value else {
        return None;
    };

    let parsed = serde_json::from_str::<serde_json::Value>(&raw);
    let Ok(mut parsed) = parsed else {
        return None;
    };

    redact_json_value(&mut parsed);
    serde_json::to_string(&parsed).ok()
}

fn redact_json_value(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(obj) => {
            for (k, v) in obj.iter_mut() {
                if is_secret_key(k) {
                    *v = serde_json::Value::String("[REDACTED]".to_string());
                } else {
                    redact_json_value(v);
                }
            }
        }
        serde_json::Value::Array(items) => {
            for item in items.iter_mut() {
                redact_json_value(item);
            }
        }
        _ => {}
    }
}

fn is_secret_key(key: &str) -> bool {
    let low = key.to_ascii_lowercase();
    low.contains("key") || low.contains("token") || low.contains("secret") || low.contains("password")
}

pub fn to_json(export: &BackupExportData) -> Result<String, String> {
    serde_json::to_string_pretty(export).map_err(|e| e.to_string())
}

pub fn to_yaml(export: &BackupExportData) -> Result<String, String> {
    serde_yaml::to_string(export).map_err(|e| e.to_string())
}

pub fn encrypt_text(plain_text: &str, password: &str) -> Result<String, String> {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);

    let cipher = Aes256GcmSiv::new_from_slice(&key).map_err(|e| e.to_string())?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plain_text.as_bytes())
        .map_err(|e| format!("Encryption failed: {e}"))?;

    let envelope = EncryptedEnvelope {
        algorithm: "aes-256-gcm-siv".to_string(),
        iterations: PBKDF2_ITERATIONS,
        salt_b64: STANDARD.encode(salt),
        nonce_b64: STANDARD.encode(nonce_bytes),
        ciphertext_b64: STANDARD.encode(ciphertext),
    };

    serde_json::to_string_pretty(&envelope).map_err(|e| e.to_string())
}

pub fn decrypt_text(envelope_json: &str, password: &str) -> Result<String, String> {
    let envelope: EncryptedEnvelope = serde_json::from_str(envelope_json)
        .map_err(|e| format!("Invalid encrypted payload envelope: {e}"))?;

    if envelope.algorithm != "aes-256-gcm-siv" {
        return Err(format!("Unsupported algorithm '{}'", envelope.algorithm));
    }

    let salt = STANDARD
        .decode(envelope.salt_b64)
        .map_err(|e| format!("Invalid salt in payload: {e}"))?;
    let nonce_raw = STANDARD
        .decode(envelope.nonce_b64)
        .map_err(|e| format!("Invalid nonce in payload: {e}"))?;
    let ciphertext = STANDARD
        .decode(envelope.ciphertext_b64)
        .map_err(|e| format!("Invalid ciphertext in payload: {e}"))?;

    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, envelope.iterations, &mut key);
    let cipher = Aes256GcmSiv::new_from_slice(&key).map_err(|e| e.to_string())?;

    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_raw), ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {e}"))?;

    String::from_utf8(plaintext).map_err(|e| format!("Decrypted payload is not UTF-8: {e}"))
}

pub fn build_archive(
    json_payload: &str,
    yaml_payload: &str,
    schema_sql: &str,
    app_settings_csv: &str,
    integration_configs_csv: &str,
) -> Result<Vec<u8>, String> {
    let cursor = Cursor::new(Vec::<u8>::new());
    let mut zip = ZipWriter::new(cursor);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    zip.start_file("config/export.json", opts)
        .map_err(|e| e.to_string())?;
    zip.write_all(json_payload.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.start_file("config/export.yaml", opts)
        .map_err(|e| e.to_string())?;
    zip.write_all(yaml_payload.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.start_file("data/schema.sql", opts)
        .map_err(|e| e.to_string())?;
    zip.write_all(schema_sql.as_bytes()).map_err(|e| e.to_string())?;

    zip.start_file("data/app_settings.csv", opts)
        .map_err(|e| e.to_string())?;
    zip.write_all(app_settings_csv.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.start_file("data/integration_configs.csv", opts)
        .map_err(|e| e.to_string())?;
    zip.write_all(integration_configs_csv.as_bytes())
        .map_err(|e| e.to_string())?;

    let cursor = zip.finish().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

pub fn csv_string(headers: &[&str], rows: Vec<Vec<String>>) -> Result<String, String> {
    let mut wtr = csv::Writer::from_writer(Vec::new());
    wtr.write_record(headers).map_err(|e| e.to_string())?;
    for row in rows {
        wtr.write_record(row).map_err(|e| e.to_string())?;
    }
    let out = wtr.into_inner().map_err(|e| e.to_string())?;
    String::from_utf8(out).map_err(|e| e.to_string())
}
