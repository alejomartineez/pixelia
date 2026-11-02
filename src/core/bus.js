// Bus de eventos mínimo. Ver DESIGN.md para la lista de eventos.
const handlers = new Map();

export const bus = {
  on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(fn);
    return () => bus.off(name, fn);
  },
  off(name, fn) { handlers.get(name)?.delete(fn); },
  emit(name, payload) {
    for (const fn of [...(handlers.get(name) || [])]) {
      try { fn(payload); } catch (e) { console.error(`[bus] ${name}`, e); }
    }
    if (name !== '*') for (const fn of [...(handlers.get('*') || [])]) {
      try { fn({ name, payload }); } catch (e) { console.error('[bus] *', e); }
    }
  },
};
