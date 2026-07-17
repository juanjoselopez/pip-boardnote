use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

/// Estado de cámara (zoom y offset)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraState {
    pub zoom: f64,
    pub offset_x: f64,
    pub offset_y: f64,
}

/// Datos serializables de una imagen incrustada
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageData {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub data_url: String,
    pub natural_width: f64,
    pub natural_height: f64,
}

/// Estructura de datos para persistir el contenido del cuaderno
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardNoteData {
    pub strokes: Vec<StrokeData>,
    pub camera: CameraState,
    pub images: Vec<ImageData>,
    pub theme: String,
    pub opacity: f64,
    pub paper_format: String,
    pub active_mode: String,
    pub active_tool: String,
    pub active_color: String,
    pub stroke_width: f64,
}

/// Datos serializables de un trazo individual
#[derive(Debug, Serialize, Deserialize)]
pub struct StrokeData {
    pub id: String,
    pub tool: String,
    pub color: String,
    pub width: f64,
    pub opacity: f64,
    pub points: Vec<PointData>,
}

/// Punto con coordenadas en mm y presión
#[derive(Debug, Serialize, Deserialize)]
pub struct PointData {
    pub x: f64,
    pub y: f64,
    pub pressure: f64,
}

/// Obtiene el directorio de datos de la aplicación
fn get_data_dir(app: &tauri::AppHandle) -> PathBuf {
    let mut path = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    path.push("notes");
    path
}

/// Obtiene la ventana principal
fn get_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window("main")
}

/// Validación de nombre de archivo para prevenir path traversal
fn sanitize_filename(filename: &str) -> Result<&str, String> {
    if filename.contains("..")
        || filename.contains('/')
        || filename.contains('\\')
        || filename.contains(':')
        || filename.contains('\0')
    {
        return Err("Invalid filename: path traversal detected".into());
    }
    if filename.is_empty() || filename.len() > 255 {
        return Err("Invalid filename: wrong length".into());
    }
    if filename.ends_with('.') || filename.ends_with(' ') {
        return Err("Invalid filename: trailing dot or space".into());
    }
    let reserved = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    let stem = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    if reserved.contains(&stem.to_uppercase().as_str()) {
        return Err("Invalid filename: reserved name".into());
    }
    let allowed_extensions = ["json"];
    let path = Path::new(filename);
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if !allowed_extensions.contains(&ext) {
            return Err("Invalid filename: extension not allowed".into());
        }
    }
    Ok(filename)
}

/// Guarda el cuaderno en el archivo JSON
#[tauri::command]
fn save_note(app: tauri::AppHandle, filename: String, data: BoardNoteData) -> Result<(), String> {
    let safe_name = sanitize_filename(&filename)?;
    let data_dir = get_data_dir(&app);
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let file_path = data_dir.join(safe_name);
    if !file_path.starts_with(&data_dir) {
        return Err("Path traversal detected".into());
    }

    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, &json).map_err(|e| e.to_string())?;
    Ok(())
}

/// Carga el cuaderno desde el archivo JSON
#[tauri::command]
fn load_note(app: tauri::AppHandle, filename: String) -> Result<BoardNoteData, String> {
    let safe_name = sanitize_filename(&filename)?;
    let data_dir = get_data_dir(&app);
    let file_path = data_dir.join(safe_name);

    if !file_path.starts_with(&data_dir) {
        return Err("Path traversal detected".into());
    }

    if !file_path.exists() {
        return Ok(BoardNoteData {
            strokes: Vec::new(),
            camera: CameraState { zoom: 1.0, offset_x: 0.0, offset_y: 0.0 },
            images: Vec::new(),
            theme: "dark".into(),
            opacity: 1.0,
            paper_format: "a4".into(),
            active_mode: "draw".into(),
            active_tool: "pen".into(),
            active_color: "#1e1e2e".into(),
            stroke_width: 1.0,
        });
    }

    let json = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let data: BoardNoteData = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(data)
}

/// Extensiones permitidas para operaciones de archivo
const ALLOWED_EXTENSIONS: &[&str] = &["svg", "html"];

/// Valida que la extensión del archivo esté en la whitelist
fn validate_extension(path: &str) -> Result<(), String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if !ALLOWED_EXTENSIONS.contains(&ext) {
        return Err(format!("Extensión no permitida: .{}", ext));
    }
    Ok(())
}

/// Lee un archivo de texto validando extensión (para importar proyectos HTML/JSON)
#[tauri::command]
fn read_file_at_path(path: String) -> Result<String, String> {
    // Validar que el archivo existe y tiene extensión permitida
    let p = Path::new(&path);
    if !p.exists() {
        return Err("El archivo no existe".into());
    }
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext != "html" && ext != "json" {
        return Err(format!("Extensión no soportada: .{}", ext));
    }
    std::fs::read_to_string(&path).map_err(|e| format!("Error al leer archivo: {}", e))
}

/// Escribe un archivo de texto validando extensión (para exportar SVG/HTML)
#[tauri::command]
fn write_text_file_at_path(path: String, content: String) -> Result<(), String> {
    validate_extension(&path)?;
    // Verificar que el directorio padre existe
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            return Err("El directorio de destino no existe".into());
        }
    }
    std::fs::write(&path, &content).map_err(|e| format!("Error al escribir archivo: {}", e))
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let data_dir = get_data_dir(&app.handle());
            std::fs::create_dir_all(&data_dir).expect("failed to create notes dir");

            let show =
                MenuItem::with_id(app, "pip_show", "Mostrar/Ocultar", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "pip_quit", "Salir", true, Some("CmdOrCtrl+Q"))?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))
                .expect("failed to load tray icon");

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("PiP BoardNote")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "pip_show" => {
                        if let Some(window) = get_window(app) {
                            if window.is_visible().unwrap_or(true) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "pip_quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = get_window(app) {
                            if window.is_visible().unwrap_or(true) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_note,
            load_note,
            read_file_at_path,
            write_text_file_at_path,
            exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
