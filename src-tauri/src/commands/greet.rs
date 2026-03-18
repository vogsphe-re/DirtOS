use specta::Type;

/// Temporary smoke-test command to verify IPC and specta type export.
/// This command will be removed after Phase 0 verification.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Type)]
pub struct GreetResponse {
    pub message: String,
}

#[tauri::command]
#[specta::specta]
pub fn greet(name: String) -> GreetResponse {
    tracing::info!("greet called with name={}", name);
    GreetResponse {
        message: format!("Hello, {}! Welcome to DirtOS.", name),
    }
}
