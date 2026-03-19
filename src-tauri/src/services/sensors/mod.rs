pub mod poller;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::db::models::{Sensor, SensorConnectionType};

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum SensorError {
    #[error("Serial I/O error: {0}")]
    Serial(String),
    #[error("HTTP request error: {0}")]
    Http(String),
    #[error("MQTT error: {0}")]
    Mqtt(String),
    #[error("Value parse error: {0}")]
    Parse(String),
    #[error("Sensor not connected (manual entry only)")]
    NotConnected,
    #[error("Task join error: {0}")]
    Join(String),
}

// ---------------------------------------------------------------------------
// Reading value returned by every driver
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverReading {
    pub value: f64,
    pub unit: Option<String>,
}

// ---------------------------------------------------------------------------
// Driver trait
// ---------------------------------------------------------------------------

#[async_trait]
pub trait SensorDriver: Send + Sync {
    /// Take a single reading from the sensor.
    async fn read(&self) -> Result<DriverReading, SensorError>;
    /// Human-readable connection type label.
    fn connection_type_label(&self) -> &'static str;
}

// ---------------------------------------------------------------------------
// Per-driver configuration structs (stored as JSON in sensors.connection_config_json)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SerialConfig {
    pub port: String,
    #[serde(default = "default_baud")]
    pub baud_rate: u32,
}
fn default_baud() -> u32 { 9600 }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HttpConfig {
    pub url: String,
    /// JSON Pointer (RFC 6901) into the response body, e.g. `/data/value`.
    /// If omitted the root value must be a plain number.
    pub json_pointer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MqttConfig {
    /// e.g. "mqtt://localhost:1883"
    pub broker_url: String,
    pub topic: String,
    pub client_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Serial sensor
// ---------------------------------------------------------------------------

pub struct SerialSensor {
    pub config: SerialConfig,
    pub unit: Option<String>,
}

#[async_trait]
impl SensorDriver for SerialSensor {
    async fn read(&self) -> Result<DriverReading, SensorError> {
        let port_name = self.config.port.clone();
        let baud_rate = self.config.baud_rate;
        let unit = self.unit.clone();

        tokio::task::spawn_blocking(move || {
            use std::io::Read;
            let mut port = serialport::new(&port_name, baud_rate)
                .timeout(std::time::Duration::from_secs(2))
                .open()
                .map_err(|e| SensorError::Serial(e.to_string()))?;
            let mut buf = [0u8; 64];
            let n = port
                .read(&mut buf)
                .map_err(|e| SensorError::Serial(e.to_string()))?;
            let raw = String::from_utf8_lossy(&buf[..n]).trim().to_string();
            let value: f64 = raw.parse().map_err(|_| {
                SensorError::Parse(format!("Cannot parse '{}' as f64", raw))
            })?;
            Ok(DriverReading { value, unit })
        })
        .await
        .map_err(|e| SensorError::Join(e.to_string()))?
    }

    fn connection_type_label(&self) -> &'static str { "serial" }
}

// ---------------------------------------------------------------------------
// HTTP sensor
// ---------------------------------------------------------------------------

pub struct HttpSensor {
    pub config: HttpConfig,
    pub unit: Option<String>,
    pub client: reqwest::Client,
}

#[async_trait]
impl SensorDriver for HttpSensor {
    async fn read(&self) -> Result<DriverReading, SensorError> {
        let resp = self
            .client
            .get(&self.config.url)
            .send()
            .await
            .map_err(|e| SensorError::Http(e.to_string()))?;

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SensorError::Http(e.to_string()))?;

        let value = if let Some(pointer) = &self.config.json_pointer {
            json.pointer(pointer)
                .and_then(|v| v.as_f64())
                .ok_or_else(|| {
                    SensorError::Parse(format!(
                        "JSON pointer '{}' not found or not numeric",
                        pointer
                    ))
                })?
        } else {
            json.as_f64().ok_or_else(|| {
                SensorError::Parse("Response root is not a numeric value".to_string())
            })?
        };

        Ok(DriverReading { value, unit: self.unit.clone() })
    }

    fn connection_type_label(&self) -> &'static str { "http" }
}

// ---------------------------------------------------------------------------
// MQTT sensor (connects, subscribes, reads one message, disconnects)
// ---------------------------------------------------------------------------

pub struct MqttSensor {
    pub config: MqttConfig,
    pub unit: Option<String>,
}

#[async_trait]
impl SensorDriver for MqttSensor {
    async fn read(&self) -> Result<DriverReading, SensorError> {
        use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
        use std::time::Duration;

        let client_id = self
            .config
            .client_id
            .clone()
            .unwrap_or_else(|| format!("dirtos-{}", uuid::Uuid::new_v4()));

        // Strip scheme prefix and parse host:port
        let addr = self
            .config
            .broker_url
            .trim_start_matches("mqtt://")
            .trim_start_matches("mqtts://");
        let (host, port) = addr
            .split_once(':')
            .and_then(|(h, p)| p.parse::<u16>().ok().map(|p| (h.to_string(), p)))
            .unwrap_or_else(|| (addr.to_string(), 1883));

        let mut opts = MqttOptions::new(client_id, host, port);
        opts.set_keep_alive(Duration::from_secs(5));

        let (client, mut event_loop) = AsyncClient::new(opts, 10);
        client
            .subscribe(&self.config.topic, QoS::AtMostOnce)
            .await
            .map_err(|e| SensorError::Mqtt(e.to_string()))?;

        // Wait up to 5 seconds for the first matching message
        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        loop {
            if tokio::time::Instant::now() > deadline {
                let _ = client.disconnect().await;
                return Err(SensorError::Mqtt(
                    "Timeout waiting for MQTT message".to_string(),
                ));
            }
            match tokio::time::timeout(Duration::from_secs(1), event_loop.poll()).await {
                Ok(Ok(Event::Incoming(Packet::Publish(msg)))) => {
                    let raw = String::from_utf8_lossy(&msg.payload).trim().to_string();
                    let value: f64 = raw.parse().map_err(|_| {
                        SensorError::Parse(format!("Cannot parse '{}' as f64", raw))
                    })?;
                    let _ = client.disconnect().await;
                    return Ok(DriverReading { value, unit: self.unit.clone() });
                }
                Ok(Ok(_)) => continue,
                Ok(Err(e)) => return Err(SensorError::Mqtt(e.to_string())),
                Err(_) => continue, // inner timeout, loop again
            }
        }
    }

    fn connection_type_label(&self) -> &'static str { "mqtt" }
}

// ---------------------------------------------------------------------------
// Manual sensor (UI-only entry, no polling)
// ---------------------------------------------------------------------------

pub struct ManualSensor;

#[async_trait]
impl SensorDriver for ManualSensor {
    async fn read(&self) -> Result<DriverReading, SensorError> {
        Err(SensorError::NotConnected)
    }

    fn connection_type_label(&self) -> &'static str { "manual" }
}

// ---------------------------------------------------------------------------
// Factory: build the right driver from a DB Sensor
// ---------------------------------------------------------------------------

pub fn build_driver(sensor: &Sensor) -> Box<dyn SensorDriver> {
    let cfg = sensor.connection_config_json.as_deref().unwrap_or("{}");

    match sensor.connection_type {
        SensorConnectionType::Serial | SensorConnectionType::Usb => {
            let config: SerialConfig = serde_json::from_str(cfg).unwrap_or_default();
            Box::new(SerialSensor { config, unit: None })
        }
        SensorConnectionType::Http => {
            let config: HttpConfig = serde_json::from_str(cfg).unwrap_or_default();
            Box::new(HttpSensor {
                config,
                unit: None,
                client: reqwest::Client::new(),
            })
        }
        SensorConnectionType::Mqtt => {
            let config: MqttConfig = serde_json::from_str(cfg).unwrap_or_default();
            Box::new(MqttSensor { config, unit: None })
        }
        SensorConnectionType::Manual => Box::new(ManualSensor),
    }
}
