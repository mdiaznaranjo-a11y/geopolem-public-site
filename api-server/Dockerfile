# GEOPÓLEM API v1 — imagen de contenedor (Sprint 4).
# ---------------------------------------------------------------------------
# Servidor Node read-only con dependencia OPCIONAL `pg`. El puente estático
# (api/v1/*.json) vive en la raíz del repo, un nivel por encima de api-server/,
# por lo que copiamos ambos: el contexto de build debe ser la RAÍZ del repo.
#
#   docker build -f api-server/Dockerfile -t geopolem-api:staging .
#   docker run --rm -p 8787:8787 --env-file api-server/.env.staging geopolem-api:staging
# ---------------------------------------------------------------------------

FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0

WORKDIR /app

# 1) Instala dependencias (sólo `pg`, opcional) con la definición del paquete.
#    Si falla la opcional, el servidor sigue funcionando en modo estático.
COPY api-server/package.json ./api-server/package.json
RUN cd api-server && npm install --omit=dev --no-audit --no-fund || true

# 2) Copia el código del servidor y el puente estático (respaldo permanente).
COPY api-server/ ./api-server/
COPY api/ ./api/

WORKDIR /app/api-server

# Ejecuta como usuario sin privilegios (la imagen node trae el user `node`).
USER node

EXPOSE 8787

# Healthcheck: /api/v1/health responde SIEMPRE (con o sin DB).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/healthcheck.mjs || exit 1

CMD ["node", "server.mjs"]
