// Cáscara de Pixelia: una ventana con el juego (JS, sin compilar) y los plugins de actualización y reinicio.
use tauri::{LogicalSize, Manager};

/// La ventana arranca en 1280×800, pero en monitores chicos (1366×768, 1024×768, o con la escala de Windows alta)
/// se saldría de la pantalla: se achica al área útil del monitor (sin la barra de tareas) y se centra.
/// Lo que el jugador elige en Ajustes → Pantalla lo aplica el juego después (src/core/desktop.js).
fn fit_to_monitor(win: &tauri::WebviewWindow) {
    let Ok(Some(mon)) = win.current_monitor() else { return };
    let scale = mon.scale_factor();
    let area = mon.work_area();
    // margen para la barra de título y los bordes de la ventana
    let max_w = (area.size.width as f64 / scale) * 0.94;
    let max_h = (area.size.height as f64 / scale - 34.0) * 0.96;
    let w = 1280.0_f64.min(max_w).max(800.0);
    let h = 800.0_f64.min(max_h).max(520.0);
    let _ = win.set_size(LogicalSize::new(w, h));
    let _ = win.center();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                fit_to_monitor(&win);
                let _ = win.show();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("no se pudo abrir Pixelia");
}
