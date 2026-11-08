// Sin consola en Windows al abrir el juego (en debug sí, para ver los logs).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pixelia_lib::run()
}
