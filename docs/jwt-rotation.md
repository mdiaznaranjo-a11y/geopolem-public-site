# GEOPÓLEM — Rotación de JWT y estrategia de firma (Sprint 7)

Este documento describe cómo **emitir** y **rotar** los secretos JWT del
api-server sin caída de servicio, y la ruta futura hacia **RS256**. No contiene
secretos reales: todo se parametriza por variables de entorno.

## 1. Modelo actual (HS256)

El api-server valida JWT **HS256** con `JWT_SECRET` (ver `src/auth.mjs`,
`src/config.mjs`). Variables relevantes:

| Variable                | Efecto |
|-------------------------|--------|
| `JWT_SECRET`            | Secreto HS256 **actual** (obligatorio si hay auth o endpoints admin). |
| `JWT_SECRET_PREVIOUS`   | Secreto HS256 **anterior** aceptado durante la ventana de rotación (Sprint 7). |
| `JWT_ISSUER`            | `iss` esperado (opcional; se valida si se define). |
| `JWT_AUDIENCE`          | `aud` esperado (opcional; se valida si se define). |
| `JWT_LEEWAY_SEC`        | Holgura para `exp`/`nbf` (por defecto 30 s). |
| `GEOP_API_AUTH_MODE`    | `public` \| `optional` \| `required` para la LECTURA. |
| `GEOP_SCOPE_ADMIN`      | Scope requerido en `/api/v1/admin/*` (por defecto `admin`). |
| `GEOP_SCOPE_CMS`        | Scope requerido en `/api/v1/cms/*` (por defecto `cms:write`). |

> Los endpoints administrativos (`/api/v1/admin/*`) exigen **siempre** un token
> válido con scope, incluso en `GEOP_API_AUTH_MODE=public`. La lectura pública no
> cambia.

## 2. Emitir un token (CLI seguro)

El secreto se lee **siempre** del entorno; nunca se pasa por argumento ni se
imprime:

```bash
# Token de administración válido 1h
JWT_SECRET="$STAGING_JWT_SECRET" \
  node scripts/issue-jwt.mjs --sub ops@geopolem --scope "admin" --ttl 3600

# Token CMS (sólo escritura de contenidos), con issuer/audience explícitos
JWT_SECRET="$STAGING_JWT_SECRET" \
  node scripts/issue-jwt.mjs --sub editor@geopolem --scope "cms:write" \
    --iss geopolem --aud geopolem-api --ttl 1800 --json
```

Salida por defecto: sólo el token en stdout (apto para `TOKEN=$(...)`).
Con `--json` imprime `{ token, claims }` para inspección.

## 3. Rotación HS256 sin caída (ventana de solapamiento)

La verificación acepta el secreto **actual** y, si está definido, el
**anterior** (`verifyJwtWithRotation`). Esto permite rotar sin invalidar los
tokens ya emitidos:

1. **Preparar**: genera un nuevo secreto fuerte fuera de banda (p. ej.
   `openssl rand -base64 48`). Guárdalo en el gestor de secretos del entorno.
2. **Solapar**: despliega con
   - `JWT_SECRET` = **nuevo** secreto,
   - `JWT_SECRET_PREVIOUS` = secreto **anterior**.
   Durante esta ventana se aceptan tokens firmados con cualquiera de los dos.
3. **Reemitir**: emite nuevos tokens con el secreto nuevo (paso 2 del CLI usando
   el nuevo `JWT_SECRET`). Deja que expiren los antiguos (ventana ≥ TTL máximo).
4. **Cerrar**: cuando ya no queden tokens vivos firmados con el anterior,
   elimina `JWT_SECRET_PREVIOUS` y redespliega. Rotación completa.

Recomendaciones:
- Mantén la ventana de solapamiento ≥ al TTL más largo que emitas.
- Vigila `geopolem_auth_denials_total` (401) durante la rotación
  (ver `docs/observability-alerts.example.yml`): un pico indica tokens que ya
  no validan.
- Usa `jti` (`--jti`) si necesitas trazabilidad/revocación selectiva.

## 4. Ruta futura: RS256 (asimétrico)

HS256 usa un secreto compartido: quien verifica también puede firmar. Para
separar emisor y verificadores (p. ej. un IdP central que firma y varios
servicios que sólo verifican), la evolución natural es **RS256**:

- **Emisor** firma con clave **privada** (`RS256`).
- **api-server** verifica con clave **pública** (no necesita el secreto de firma).
- Rotación mediante `kid` en la cabecera y un **JWKS** publicado; los
  verificadores seleccionan la clave por `kid`, permitiendo solapamiento
  equivalente al de la sección 3 pero sin compartir material de firma.

Plan de adopción sugerido (Sprint 8+):
1. Añadir soporte de verificación RS256 en `verifyJwt` (rama por `header.alg`),
   leyendo la clave pública de `JWT_PUBLIC_KEY` (PEM) o de un `JWKS_URL`.
2. Mantener HS256 como alternativa durante la transición (config `JWT_ALG`).
3. Migrar emisión al IdP y deprecar HS256 cuando todos los servicios verifiquen
   por JWKS.

Hasta entonces, HS256 con rotación por solapamiento (secciones 2–3) cubre la
operación de staging/admin de forma segura.
