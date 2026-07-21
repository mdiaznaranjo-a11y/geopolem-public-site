// GEOPÓLEM API v1 (Sprint 6) — rate limiting simple en memoria (cero deps).
// ---------------------------------------------------------------------------
// Ventana fija por clave (client id) sin dependencias externas ni estado
// persistente. Pensado para endurecer endpoints de datos cuando la auth está
// activa, SIN afectar al modo public por defecto:
//
//   • Desactivado si `max <= 0` (valor por defecto) → el modo public no cambia.
//   • /api/v1/health y /api/v1/metrics quedan SIEMPRE exentos (los aplica el
//     router antes de llegar aquí): observabilidad y arranque nunca se limitan.
//
// La función `evaluate()` es PURA (recibe estado y `now`) para poder testearla
// sin relojes ni sockets. El `RateLimitStore` mantiene el estado por proceso y
// hace limpieza perezosa de ventanas expiradas (sin timers en background).
// ---------------------------------------------------------------------------

// Evalúa una ventana fija. Devuelve el nuevo estado y la decisión.
//   state: { count, windowStart } | undefined
//   opts:  { max, windowMs, now }
// return: { allowed, remaining, resetMs, retryAfterSec, state }
export function evaluate(state, { max, windowMs, now }) {
  // Nueva ventana si no hay estado o la anterior ya expiró.
  if (!state || now - state.windowStart >= windowMs) {
    const next = { count: 1, windowStart: now };
    return {
      allowed: true,
      remaining: Math.max(0, max - 1),
      resetMs: windowMs,
      retryAfterSec: 0,
      state: next,
    };
  }

  const elapsed = now - state.windowStart;
  const resetMs = Math.max(0, windowMs - elapsed);
  if (state.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      resetMs,
      retryAfterSec: Math.ceil(resetMs / 1000),
      state, // no se incrementa cuando ya está limitado
    };
  }

  const next = { count: state.count + 1, windowStart: state.windowStart };
  return {
    allowed: true,
    remaining: Math.max(0, max - next.count),
    resetMs,
    retryAfterSec: 0,
    state: next,
  };
}

export class RateLimitStore {
  constructor({ max, windowMs }) {
    this.max = max;
    this.windowMs = windowMs;
    this.buckets = new Map(); // key → { count, windowStart }
  }

  get enabled() {
    return Number.isFinite(this.max) && this.max > 0;
  }

  // Registra un acceso de `key`. Devuelve la decisión de evaluate().
  hit(key, now = Date.now()) {
    if (!this.enabled) {
      return { allowed: true, remaining: Infinity, resetMs: 0, retryAfterSec: 0 };
    }
    const res = evaluate(this.buckets.get(key), { max: this.max, windowMs: this.windowMs, now });
    this.buckets.set(key, res.state);
    this._maybeSweep(now);
    return res;
  }

  // Limpieza perezosa: elimina ventanas expiradas para acotar la memoria.
  // Se dispara como mucho una vez por ventana para no penalizar cada petición.
  _maybeSweep(now) {
    if (this._lastSweep && now - this._lastSweep < this.windowMs) return;
    this._lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart >= this.windowMs) this.buckets.delete(key);
    }
  }

  reset() {
    this.buckets.clear();
    this._lastSweep = undefined;
  }
}
