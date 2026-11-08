// Cáscara de Pixelia: una ventana con el juego (JS, sin compilar) y los plugins de actualización y reinicio.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("no se pudo abrir Pixelia");
}
