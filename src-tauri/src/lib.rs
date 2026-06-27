use std::fs;

use serde::{Deserialize, Serialize};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};

const MAIN_WINDOW_LABEL: &str = "main";
const SETTINGS_FILE_NAME: &str = "liuyun-settings.json";

fn default_close_to_tray() -> bool {
    true
}

fn default_snooze_minutes() -> u64 {
    10
}

fn default_background_position() -> f32 {
    50.0
}

fn default_background_scale() -> f32 {
    120.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(alias = "launch_on_startup")]
    pub launch_on_startup: bool,
    #[serde(alias = "close_to_tray", default = "default_close_to_tray")]
    pub close_to_tray: bool,
    #[serde(alias = "font_family")]
    pub font_family: String,
    #[serde(alias = "font_size")]
    pub font_size: u32,
    #[serde(alias = "theme_color")]
    pub theme_color: String,
    #[serde(alias = "background_image_path")]
    pub background_image_path: Option<String>,
    #[serde(alias = "background_opacity")]
    pub background_opacity: f32,
    #[serde(alias = "background_position_x", default = "default_background_position")]
    pub background_position_x: f32,
    #[serde(alias = "background_position_y", default = "default_background_position")]
    pub background_position_y: f32,
    #[serde(alias = "background_scale", default = "default_background_scale")]
    pub background_scale: f32,
    #[serde(alias = "reminder_recheck_seconds")]
    pub reminder_recheck_seconds: u64,
    #[serde(alias = "snooze_minutes", default = "default_snooze_minutes")]
    pub snooze_minutes: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_on_startup: true,
            close_to_tray: true,
            font_family: "lxgw-wenkai".into(),
            font_size: 14,
            theme_color: "#1b365d".into(),
            background_image_path: None,
            background_opacity: 0.85,
            background_position_x: 50.0,
            background_position_y: 50.0,
            background_scale: 120.0,
            reminder_recheck_seconds: 30,
            snooze_minutes: 10,
        }
    }
}

#[tauri::command]
fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    load_settings(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    persist_settings(&app, &settings).map_err(|error| error.to_string())?;
    sync_startup_entry(&settings).map_err(|error| error.to_string())?;
    Ok(settings)
}

#[tauri::command]
fn open_main_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window(MAIN_WINDOW_LABEL).ok_or("主窗口不存在")?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn hide_main_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window(MAIN_WINDOW_LABEL).ok_or("主窗口不存在")?;
    window.hide().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_reminder_window(app: AppHandle, reminder: String) -> Result<(), String> {
    let window = app.get_webview_window(MAIN_WINDOW_LABEL).ok_or("主窗口不存在")?;
    window.emit("show-reminder", reminder).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_app_settings,
            save_app_settings,
            open_main_window,
            hide_main_window,
            show_reminder_window
        ])
        .setup(|app| {
            setup_tray(&app.handle().clone())?;

            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                window.on_window_event({
                    let handle = app.handle().clone();
                    move |event| {
                        if let WindowEvent::CloseRequested { api, .. } = event {
                            let settings = load_settings(&handle).unwrap_or_default();
                            if settings.close_to_tray {
                                api.prevent_close();
                                let _ = hide_main_window(handle.clone());
                            } else {
                                handle.exit(0);
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .item(&MenuItem::with_id(app, "tray-open", "打开主界面", true, None::<&str>)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("退出"))?)
        .build()?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::from(anyhow::anyhow!("缺少默认窗口图标")))?;

    let handle = app.clone();
    TrayIconBuilder::with_id("liuyun-tray")
        .icon(icon)
        .tooltip("流云")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |_, event| {
            if event.id().as_ref() == "tray-open" {
                let _ = open_main_window(handle.clone());
            }
        })
        .on_tray_icon_event({
            let app = app.clone();
            move |_, event| {
                if matches!(event, TrayIconEvent::Click { .. }) {
                    let _ = open_main_window(app.clone());
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn load_settings(app: &AppHandle) -> tauri::Result<AppSettings> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
}

fn persist_settings(app: &AppHandle, settings: &AppSettings) -> tauri::Result<()> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(settings)?;
    fs::write(path, content)?;
    Ok(())
}

#[cfg(windows)]
fn sync_startup_entry(settings: &AppSettings) -> tauri::Result<()> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_WRITE};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_WRITE)?;
    if settings.launch_on_startup {
        let exe = std::env::current_exe()?;
        key.set_value("流云", &exe.to_string_lossy().to_string())?;
    } else {
        let _ = key.delete_value("流云");
    }
    Ok(())
}

#[cfg(not(windows))]
fn sync_startup_entry(_settings: &AppSettings) -> tauri::Result<()> {
    Ok(())
}

fn settings_path(app: &AppHandle) -> tauri::Result<std::path::PathBuf> {
    let base = app.path().app_config_dir()?;
    Ok(base.join(SETTINGS_FILE_NAME))
}

#[allow(dead_code)]
fn _load_icon(app: &AppHandle) -> tauri::Result<Image<'static>> {
    let icon_path = app.path().resolve("icons/icon.png", tauri::path::BaseDirectory::Resource)?;
    let bytes = fs::read(icon_path)?;
    let _ = bytes;
    Ok(Image::new(&[], 0, 0))
}
