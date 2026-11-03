// Configuración del servidor online (Supabase).
//
// Vacíos = el juego funciona en modo local ("Sin conexión") y las funciones sociales lo avisan.
//
// Cómo completarlo:
//  1. Entrá a https://supabase.com, creá un proyecto gratis.
//  2. En el proyecto: Project Settings → API (o "Connect" → App Frameworks).
//  3. Copiá "Project URL" en SUPABASE_URL  (ej: 'https://abcdefghijkl.supabase.co')
//     y la clave "anon public" (o "publishable") en SUPABASE_ANON_KEY.
//  4. Corré supabase/schema.sql una vez en el SQL Editor del proyecto.
//
// La anon key es PÚBLICA a propósito (va en el navegador): la seguridad la dan las reglas
// RLS y las funciones de schema.sql. NUNCA pongas acá la "service_role" / "secret" key.
//
// Para probar sin servidor: abrí el juego con ?mock=1&mockuser=ana (y otra pestaña con mockuser=bea).
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
