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

```bash
mkdir -p /opt/mortero/backups
crontab -e
# agregar:
0 4 * * * /opt/mortero/src/deploy/backup.sh >> /opt/mortero/backups/backup.log 2>&1
```

Guarda la base y las fotos todas las noches y borra lo que tenga más de 14 días. Conviene copiar esa carpeta a otro lado de vez en cuando.

Para restaurar la base:

```bash
docker exec -i mortero-db pg_restore -U mortero -d mortero --clean < /opt/mortero/backups/db_FECHA.dump
```

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
