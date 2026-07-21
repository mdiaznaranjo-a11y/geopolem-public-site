// GEOPÓLEM API v1 (Sprint 7) — emisión segura de JWT de staging/admin.
// ---------------------------------------------------------------------------
// Emite un JWT HS256 firmado con el secreto leído del ENTORNO (JWT_SECRET).
// NUNCA acepta el secreto por argumento ni lo imprime: sólo se usa para el
// HMAC. Reutiliza la firma canónica de src/auth.mjs (misma que valida la API),
// de modo que un token emitido aquí es aceptado por el servidor sin ajustes.
//
// Uso:
//   JWT_SECRET=... node scripts/issue-jwt.mjs --sub admin@geopolem \
//       --scope "admin" --ttl 3600 --iss geopolem --aud geopolem-api
//
// Flags:
//   --sub <s>      subject (obligatorio).
//   --scope <s>    scopes separados por espacios (p. ej. "cms:write").
//   --ttl <n>      validez en segundos (por defecto 3600 = 1h).
//   --iss <s>      issuer (opcional; debe casar con JWT_ISSUER si se valida).
//   --aud <s>      audience (opcional; debe casar con JWT_AUDIENCE si se valida).
//   --nbf <n>      not-before relativo en segundos (opcional).
//   --jti <s>      identificador único del token (opcional; útil para revocación).
//   --json         imprime {token, claims} en JSON (por defecto: sólo el token).
//   --help         ayuda.
//
// Rotación: para emitir con el secreto ANTERIOR durante una ventana de rotación,
// exporta ese valor como JWT_SECRET al invocar el script. Ver docs/jwt-rotation.md.
// ---------------------------------------------------------------------------

import { signJwt } from '../src/auth.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'help' || key === 'json') { args[key] = true; continue; }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) { args[key] = true; continue; }
    args[key] = val;
    i += 1;
  }
  return args;
}

function usage() {
  console.log(`Uso: JWT_SECRET=... node scripts/issue-jwt.mjs --sub <subject> [opciones]

  --sub <s>     subject (obligatorio)
  --scope <s>   scopes separados por espacios (p. ej. "admin" o "cms:write")
  --ttl <n>     validez en segundos (por defecto 3600)
  --iss <s>     issuer (opcional)
  --aud <s>     audience (opcional)
  --nbf <n>     not-before relativo en segundos (opcional)
  --jti <s>     id único del token (opcional)
  --json        imprime {token, claims} en JSON
  --help        esta ayuda

El secreto se lee SIEMPRE de la variable de entorno JWT_SECRET.`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); return 0; }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('ERROR: JWT_SECRET no está definido en el entorno. No se emitió ningún token.');
    return 1;
  }
  if (!args.sub || args.sub === true) {
    console.error('ERROR: --sub <subject> es obligatorio.');
    usage();
    return 1;
  }

  const ttl = args.ttl != null && args.ttl !== true ? Number(args.ttl) : 3600;
  if (!Number.isFinite(ttl) || ttl <= 0) {
    console.error('ERROR: --ttl debe ser un número de segundos positivo.');
    return 1;
  }

  const payload = { sub: String(args.sub) };
  if (args.scope && args.scope !== true) payload.scope = String(args.scope);
  if (args.iss && args.iss !== true) payload.iss = String(args.iss);
  if (args.aud && args.aud !== true) payload.aud = String(args.aud);
  if (args.jti && args.jti !== true) payload.jti = String(args.jti);

  const opts = { expiresInSec: ttl };
  if (args.nbf != null && args.nbf !== true) opts.notBeforeSec = Number(args.nbf);

  const token = signJwt(payload, secret, opts);

  if (args.json) {
    const now = Math.floor(Date.now() / 1000);
    console.log(JSON.stringify({
      token,
      claims: { ...payload, iat: now, exp: now + ttl, ...(opts.notBeforeSec != null ? { nbf: now + opts.notBeforeSec } : {}) },
    }, null, 2));
  } else {
    console.log(token);
  }
  return 0;
}

process.exit(main());
