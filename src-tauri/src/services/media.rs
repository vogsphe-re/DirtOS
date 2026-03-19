use base64::{engine::general_purpose, Engine as _};
use std::path::PathBuf;
use uuid::Uuid;

pub struct MediaService {
    app_data_dir: PathBuf,
}

pub struct StoredMedia {
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub mime_type: Option<String>,
}

impl MediaService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn store_file(
        &self,
        file_bytes: &[u8],
        original_name: &str,
        entity_type: &str,
        entity_id: i64,
    ) -> Result<StoredMedia, String> {
        let ext = std::path::Path::new(original_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin")
            .to_lowercase();

        let dir = self
            .app_data_dir
            .join("media")
            .join(entity_type)
            .join(entity_id.to_string());
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

        let uuid = Uuid::new_v4().to_string();
        let stored_name = format!("{}.{}", uuid, ext);
        let file_path = dir.join(&stored_name);
        std::fs::write(&file_path, file_bytes).map_err(|e| e.to_string())?;

        let mime_type = mime_for_ext(&ext);
        let thumbnail_path = if is_image(mime_type.as_deref()) {
            self.generate_thumbnail(file_bytes, &dir, &uuid)
        } else {
            None
        };

        Ok(StoredMedia {
            file_path: file_path.to_string_lossy().to_string(),
            thumbnail_path,
            mime_type,
        })
    }

    fn generate_thumbnail(&self, bytes: &[u8], dir: &PathBuf, uuid: &str) -> Option<String> {
        let img = image::load_from_memory(bytes).ok()?;
        let thumb = img.thumbnail(200, 200);
        let thumb_name = format!("thumb_{}.jpg", uuid);
        let thumb_path = dir.join(&thumb_name);
        thumb
            .save_with_format(&thumb_path, image::ImageFormat::Jpeg)
            .ok()?;
        Some(thumb_path.to_string_lossy().to_string())
    }

    pub fn delete_files(&self, file_path: &str, thumbnail_path: Option<&str>) {
        let _ = std::fs::remove_file(file_path);
        if let Some(thumb) = thumbnail_path {
            let _ = std::fs::remove_file(thumb);
        }
    }

    pub fn read_as_base64(&self, file_path: &str) -> Result<String, String> {
        let bytes = std::fs::read(file_path).map_err(|e| e.to_string())?;
        Ok(general_purpose::STANDARD.encode(&bytes))
    }
}

fn mime_for_ext(ext: &str) -> Option<String> {
    Some(
        match ext {
            "jpg" | "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "heic" | "heif" => "image/heic",
            "pdf" => "application/pdf",
            "txt" => "text/plain",
            "md" => "text/markdown",
            _ => return None,
        }
        .to_string(),
    )
}

fn is_image(mime: Option<&str>) -> bool {
    mime.map(|m| m.starts_with("image/")).unwrap_or(false)
}
