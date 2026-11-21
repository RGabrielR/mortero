#!/usr/bin/env bash
# Backup diario de qule.ar: base de datos + fotos. Pensado para correr con cron.
#   0 4 * * * BACKUP_DIR=/opt/mortero/backups /opt/mortero/src/deploy/backup.sh >> /opt/mortero/backups/backup.log 2>&1
#
# Dos copias:
#   - Local (BACKUP_DIR): solo la base, para volver atrás rápido si un deploy sale mal. Pocos días.
#   - Fuera del servidor, cifrada con restic: base + fotos. Se cifra ACÁ, antes de salir: el proveedor
#     guarda datos ilegibles. Se activa cuando existe el archivo RESTIC_ENV (ver docs/DEPLOY.md, sección 6).
#
# Las fotos son lo más sensible que guardamos: por defecto NO se copian sin cifrar al disco local.
set -euo pipefail
umask 077

DEST="${BACKUP_DIR:-/opt/mortero/backups}"
RESTIC_ENV="${RESTIC_ENV:-$(dirname "$DEST")/restic.env}"
RESTIC_IMAGE="${RESTIC_IMAGE:-restic/restic:0.17.3}"
LOCAL_PHOTOS="${LOCAL_PHOTOS:-0}"
STAMP="$(date +%Y-%m-%d_%H%M)"

# Con copia cifrada afuera, lo local dura poco; sin ella, se guarda más (como antes)
if [ -f "$RESTIC_ENV" ]; then KEEP_DAYS="${KEEP_DAYS:-3}"; else KEEP_DAYS="${KEEP_DAYS:-14}"; fi

mkdir -p "$DEST"
chmod 700 "$DEST"

# Base de datos (formato custom: se restaura con pg_restore). umask 077 => queda 600.
DUMP="$DEST/db_$STAMP.dump"
docker exec mortero-db pg_dump -U mortero -d mortero -Fc > "$DUMP"

# Fotos sin cifrar en disco local: solo si se pide explícitamente
if [ "$LOCAL_PHOTOS" = 1 ]; then
  docker run --rm -v mortero-data:/data:ro -v "$DEST":/backup busybox \
    sh -c "tar czf /backup/fotos_$STAMP.tar.gz -C /data uploads && chmod 600 /backup/fotos_$STAMP.tar.gz"
fi

# Copia cifrada fuera del servidor
if [ -f "$RESTIC_ENV" ]; then
  restic() {
    docker run --rm -i --env-file "$RESTIC_ENV" \
      -v mortero-restic-cache:/root/.cache/restic \
      -v mortero-data:/data:ro \
      -v "$DUMP":/backup/db.dump:ro \
      "$RESTIC_IMAGE" "$@"
  }
  # Las miniaturas no se copian: se regeneran solas la primera vez que se piden
  restic backup --host qule --tag nocturno --exclude /data/uploads/thumbs /backup/db.dump /data/uploads
  # Retención: la política de privacidad promete que lo borrado desaparece de los backups en 14 días.
  # Se guardan REMOTE_KEEP_DAYS (7) días de copias, y el bucket borra del todo lo descartado a los 7 días
  # (ver docs/DEPLOY.md): 7 + 7 = 14. No subas ninguno de los dos sin cambiar antes la política.
  restic forget --host qule --keep-within "${REMOTE_KEEP_DAYS:-7}d" --prune
  # Los domingos se verifica que el repositorio esté sano y se leen al azar 5% de los datos
  if [ "$(date +%u)" = 7 ]; then restic check --read-data-subset=5%; fi
  echo "$(date -Is) copia cifrada afuera ok"
else
  echo "$(date -Is) AVISO: no existe $RESTIC_ENV, no hay copia fuera del servidor" >&2
fi

# Borrar backups locales viejos
find "$DEST" -name 'db_*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'fotos_*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) backup ok: $STAMP"
