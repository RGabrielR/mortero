# Deploy de qule.ar

Guía para subir qule.ar a un servidor Linux con Docker y nginx. Todo corre en dos contenedores:

- `mortero-db`: Postgres.
- `mortero-app`: el API, el chat en vivo y la web compilada, en un solo proceso.

nginx queda adelante y se encarga del HTTPS. Se usan comandos `docker` sueltos, sin docker-compose, para no depender de su versión.

## 1. Requisitos

- Docker y nginx instalados.
- Un dominio (o subdominio) apuntando a la IP del servidor con un registro `A`.
- Unos 1,5 GB de RAM libres. Postgres y la app juntos usan bastante menos, pero conviene tener margen.

## 2. Código y variables

```bash
sudo mkdir -p /opt/mortero && sudo chown "$USER" /opt/mortero
git clone https://github.com/RGabrielR/qule.ar.git /opt/mortero/src
cd /opt/mortero/src
```

Generá las claves de notificaciones y el secreto de sesiones:

```bash
docker run --rm -v "$PWD":/app -w /app node:24-bookworm-slim sh -c "npm ci --silent && npm run vapid --silent"
openssl rand -base64 32
```

Creá `/opt/mortero/app.env` (no lo subas a ningún lado):

```env
APP_URL=https://DOMINIO
BETTER_AUTH_SECRET=el-secreto-generado
DATABASE_URL=postgres://mortero:CLAVE_DB@mortero-db:5432/mortero
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
ADMIN_EMAILS=tu-email@ejemplo.com
# Solo cuenta si el mail está verificado (cuentas de Google). Si entrás con mail y contraseña, usá tu ID de cuenta
# (se ve en https://DOMINIO/api/me con la sesión iniciada):
ADMIN_USER_IDS=
# Opcional, para mandar mails (bienvenida, recuperar contraseña):
SMTP_URL=smtps://resend:API_KEY@smtp.resend.com:465
MAIL_FROM=qule.ar <hola@DOMINIO>
# Opcional, para el login con Google:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Protegelo: `chmod 600 /opt/mortero/app.env`.

## 3. Base de datos

```bash
docker network create mortero
docker volume create mortero-pg
docker run -d --name mortero-db --restart unless-stopped --network mortero \
  -e POSTGRES_USER=mortero -e POSTGRES_PASSWORD=CLAVE_DB -e POSTGRES_DB=mortero \
  -v mortero-pg:/var/lib/postgresql/data \
  postgres:17-alpine
```

Postgres no expone ningún puerto hacia afuera: solo lo ve la app, por la red `mortero`.

## 4. App

```bash
cd /opt/mortero/src
docker build -t mortero:latest .
docker volume create mortero-data
docker run -d --name mortero-app --restart unless-stopped --network mortero \
  --env-file /opt/mortero/app.env \
  -v mortero-data:/data \
  -p 127.0.0.1:3010:3001 \
  mortero:latest
docker logs -f mortero-app   # tiene que decir "qule.ar API escuchando"
```

Las migraciones de la base se aplican solas al arrancar. La app escucha solo en `127.0.0.1:3010`: el único acceso desde afuera es por nginx.

## 5. nginx y HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mortero
sudo sed -i 's/DOMINIO/tu.dominio.com/' /etc/nginx/sites-available/mortero
sudo ln -s /etc/nginx/sites-available/mortero /etc/nginx/sites-enabled/mortero
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tu.dominio.com
```

Si el servidor ya tiene otros sitios, este bloque se suma sin tocar los demás.

## 6. Backups

Todas las noches `deploy/backup.sh` guarda la base y las fotos **cifradas y fuera del servidor**, con [restic](https://restic.net). Se cifran en el servidor antes de salir (AES-256): el proveedor del almacenamiento no puede ver nada. Se guardan 14 días, lo que dice la política de privacidad.

Si se pierde el servidor, los backups siguen estando. Si se pierde **la contraseña de restic**, no se pueden recuperar: por eso se guarda también fuera del servidor.

### Una sola vez

1. **Almacenamiento:** un bucket privado en Cloudflare R2 (ya usamos Cloudflare; 10 GB gratis), por ejemplo `qule-backups`. Un token de API de R2 con permiso de lectura y escritura **solo sobre ese bucket**. Sirve cualquier S3 compatible (Backblaze B2, etc.).
2. **restic 0.17 o más nuevo** en el servidor (el de `apt` puede ser más viejo, por eso se actualiza):

   ```bash
   apt install -y restic && restic self-update && restic version
   ```

3. **Configuración y contraseña:**

   ```bash
   cp /opt/mortero/src/deploy/backup.env.example /opt/mortero/backup.env
   nano /opt/mortero/backup.env          # repositorio y token de R2
   openssl rand -base64 32 > /opt/mortero/restic-password
   chmod 600 /opt/mortero/backup.env /opt/mortero/restic-password
   ```

   **Guardá la contraseña** (`cat /opt/mortero/restic-password`) en un gestor de contraseñas, que la tengan al menos dos personas del equipo. No va al repo ni a las Discusiones.

4. **Crear el repositorio y probar:**

   ```bash
   set -a; . /opt/mortero/backup.env; set +a
   restic init
   /opt/mortero/src/deploy/backup.sh
   restic snapshots                       # tiene que mostrar uno "db" y uno "fotos"
   ```

5. **Cron** (como root, `crontab -e`):

   ```
   0 4 * * * /opt/mortero/src/deploy/backup.sh >> /var/log/qule-backup.log 2>&1
   ```

6. **Borrar los backups viejos sin cifrar**, una vez que el primero cifrado funcionó: `rm -rf /opt/mortero/backups`.

### Restaurar

```bash
set -a; . /opt/mortero/backup.env; set +a
restic snapshots                                        # elegir la fecha
# Base (latest = la última; o el ID de un snapshot):
restic dump --tag db latest /db.dump | docker exec -i mortero-db pg_restore -U mortero -d mortero --clean --if-exists
# Fotos (se restauran en una carpeta aparte y después se copian al volumen):
restic restore --tag fotos latest --target /tmp/restore
# quedan con la ruta completa: /tmp/restore/var/lib/docker/volumes/mortero-data/_data/uploads
```

Las miniaturas no se guardan: la app las vuelve a generar sola.

Conviene probar la restauración cada tanto en otra máquina o en una base de prueba: un backup que nunca se restauró no está probado.

### Si alguien borra su cuenta

Sus datos salen de la base al instante, pero pueden quedar en los backups hasta 14 días. Después `restic forget --prune` los borra solos. Por eso no hay que subir `KEEP_DAYS` sin cambiar antes la política de privacidad.

## Seguridad: la IP de cada persona

El límite de intentos (login, registro, recuperar contraseña) y las sesiones usan la IP real de cada persona. El API la lee de **un solo encabezado**, que el proxy de adelante tiene que pisar siempre, así nadie la puede inventar. Se elige con `CLIENT_IP_HEADER` en `app.env`:

| Cómo llega el tráfico al API | `CLIENT_IP_HEADER` |
|---|---|
| Túnel de Cloudflare directo al API | `cf-connecting-ip` (es el valor por defecto) |
| nginx de `deploy/nginx.conf`, sin Cloudflare | `x-real-ip` |

**Importante:** el API tiene que ser alcanzable **solo** por ese proxy (por eso escucha en `127.0.0.1`). Si alguien llega directo, puede mandar el encabezado inventado y saltearse el límite de intentos. Con el túnel de Cloudflare, nginx no debería quedar escuchando hacia afuera.

La app también manda encabezados de seguridad (CSP, anti-iframe, HSTS en https): están en `apps/api/src/security.ts` y no hace falta configurarlos en el proxy.

## 7. Actualizar

```bash
cd /opt/mortero/src && git pull
docker build -t mortero:latest .
docker rm -f mortero-app
docker run -d --name mortero-app ...   # el mismo comando del paso 4
```

## Login con Google

En Google Cloud Console → APIs y servicios → Credenciales, creá un "ID de cliente de OAuth" de tipo aplicación web:

- Orígenes autorizados: `https://DOMINIO`
- URI de redirección: `https://DOMINIO/api/auth/callback/google`

Copiá el ID y el secreto en `app.env` y reiniciá la app.
