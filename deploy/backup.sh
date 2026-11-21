#!/usr/bin/env bash
# Backup diario de qule.ar, CIFRADO y FUERA del servidor (restic). Ver docs/DEPLOY.md, "6. Backups".
#
# Corre como root con cron (necesita leer el volumen de Docker):
#   0 4 * * * /opt/mortero/src/deploy/backup.sh >> /var/log/qule-backup.log 2>&1
#
# - La base va directo de pg_dump a restic: nunca queda un volcado sin cifrar en el disco.
# - Las fotos y videos se suben desde el volumen de la app (sin las miniaturas, que se regeneran solas).
# - Se guardan 14 días, que es lo que promete la política de privacidad. Lo más viejo se borra.
# - Los domingos verifica que el repositorio esté sano y que se pueda leer una parte de los datos.
set -euo pipefail

ENV_FILE="${BACKUP_ENV:-/opt/mortero/backup.env}"
if [ ! -r "$ENV_FILE" ]; then
  echo "$(date -Is) ERROR: falta $ENV_FILE (copialo de deploy/backup.env.example)" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${RESTIC_REPOSITORY:?Falta RESTIC_REPOSITORY en $ENV_FILE}"
: "${RESTIC_PASSWORD_FILE:?Falta RESTIC_PASSWORD_FILE en $ENV_FILE}"

KEEP_DAYS="${KEEP_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-mortero-db}"
DATA_VOLUME="${DATA_VOLUME:-mortero-data}"
HOST_TAG="qule"

# 1. Base de datos. --stdin-from-command (restic 0.17 o más nuevo) no guarda el snapshot si pg_dump falla.
restic backup --host "$HOST_TAG" --tag db --stdin-filename db.dump \
  --stdin-from-command -- docker exec "$DB_CONTAINER" pg_dump -U mortero -d mortero -Fc

# 2. Fotos y videos
UPLOADS="$(docker volume inspect -f '{{ .Mountpoint }}' "$DATA_VOLUME")/uploads"
restic backup --host "$HOST_TAG" --tag fotos --exclude "$UPLOADS/thumbs" "$UPLOADS"

# 3. Retención: solo los últimos KEEP_DAYS días (base y fotos por separado)
restic forget --host "$HOST_TAG" --group-by host,tags --keep-within "${KEEP_DAYS}d" --prune

# 4. Domingos: control del repositorio y lectura de una muestra de los datos
if [ "$(date +%u)" = "7" ]; then
  restic check --read-data-subset=5%
fi

echo "$(date -Is) backup ok"
