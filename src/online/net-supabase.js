// Adaptador real: Supabase (Auth email+contraseña + RPCs de supabase/schema.sql).
// Lo carga net.js con import dinámico solo si config.js tiene URL y KEY.
// Puede tirar excepciones: net.js las atrapa y las traduce a mensajes amables.
import { createClient } from '../../vendor/supabase.min.js';

const toUser = u => (u ? { id: u.id, email: u.email || null, name: u.user_metadata?.name || null } : null);

export function createSupabaseAdapter(url, key) {
  const sb = createClient(url, key, {
    auth: {
      persistSession: true,           // la sesión queda en localStorage
      autoRefreshToken: true,
      detectSessionInUrl: true,       // por si se usa el link de confirmación de email
      storageKey: 'pixelia.auth',
      storage: globalThis.localStorage,
    },
  });

  return {
    mode: 'supabase',
    client: sb,

    async getUser() {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      return toUser(data.session?.user);
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        // diferimos para no llamar a Supabase dentro del callback (recomendación de supabase-js)
        setTimeout(() => cb(toUser(session?.user)), 0);
      });
      return () => data.subscription.unsubscribe();
    },

    /** -> { user } (con sesión) | { user:null } (falta confirmar email) */
    async signUp(email, password, name) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw error;
      // con confirmación activada, un email ya registrado vuelve "ok" pero sin identidades
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
        throw new Error('User already registered');
      return { user: data.session ? toUser(data.user) : null };
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { user: toUser(data.user) };
    },

    async signOut() {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
    },

    /** Llama una función de schema.sql. Los `raise exception` llegan con code 'P0001' y mensaje amable. */
    async rpc(name, args = {}) {
      const { data, error } = await sb.rpc(name, args);
      if (error) throw error;
      return data;
    },
  };
}
