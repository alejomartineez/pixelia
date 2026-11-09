// Cáscara de Pixelia: una ventana con el juego (JS, sin compilar) y los plugins de actualización y reinicio.
use tauri::{LogicalSize, Manager, PhysicalPosition};

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
    // centrada a mano en el área útil: en macOS center() todavía ve el tamaño de antes (1280) y en un monitor de 1024
    // dejaba el borde izquierdo afuera (captura del workflow manual, docs/INSTALADOR.md)
    let (pw, ph) = ((w * scale).round() as i32, (h * scale).round() as i32);
    let x = area.position.x + ((area.size.width as i32 - pw) / 2).max(0);
    let y = area.position.y + ((area.size.height as i32 - ph) / 2).max(0);
    let _ = win.set_position(PhysicalPosition::new(x, y));
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
