# Deploy a producción

Verificado por inspección directa del servidor el 2026-08-02. Si algo de acá no
coincide con lo que ves en el servidor, confiá en el servidor y actualizá este archivo.

## Servidor

- Acceso: `ssh fucolabs` (host configurado en `~/.ssh/config` del usuario, key propia).
- Es una VPS **compartida** con otras apps del usuario (Supermercado al Día, Evolution
  API/WhatsApp, un sitio de noticias). No asumas que sos el único servicio ni el único
  proceso escuchando en un puerto dado.
- Dominios: `https://app.fucolabs.dev` (frontend), `https://api.fucolabs.dev` (backend).

## ⚠️ No hay Docker en producción

`backend/Dockerfile` y `backend/docker-compose.yml` **no se usan**. Producción corre
bare-metal vía systemd. El `docker-compose.yml` describe un flujo distinto (Postgres en
contenedor, DB `tracking_whatsapp` que no existe en este proyecto) — probablemente un
remanente copiado de otra configuración. Si necesitás levantar el proyecto en un
contenedor localmente esos archivos pueden servir como punto de partida, pero **no
representan cómo corre producción hoy** y no hay que seguirlos para un deploy real.

No hay CI/CD ni webhooks. Todo el proceso de abajo es manual.

## Layout en el servidor

- Ruta: `/home/report-fuco/proyectos/tracking-habitos-nwwk`
- Dueño del proceso: usuario del sistema `report-fuco` (los `systemctl restart` de abajo
  necesitan privilegios de sudo/root, no el usuario `report-fuco`)
- Es un `git clone` de `https://github.com/ReportFuco/tracking-habitos-nwwk.git`
- ⚠️ El checkout de producción puede estar parado en una rama que no es `main`. Antes
  de asumir qué versión sirve tráfico real, confirmá con:
  ```
  cd /home/report-fuco/proyectos/tracking-habitos-nwwk
  git -c safe.directory='*' branch --show-current
  ```
  (el repo tiene "dubious ownership" para el usuario `root`; el flag `-c safe.directory='*'`
  evita tener que tocar la git config global del servidor solo para leer el estado.)

## Backend (`tracking-api.service`)

Unit real (`/etc/systemd/system/tracking-api.service`):

```ini
[Service]
Type=simple
User=report-fuco
Group=report-fuco
WorkingDirectory=/home/report-fuco/proyectos/tracking-habitos-nwwk/backend
EnvironmentFile=/home/report-fuco/proyectos/tracking-habitos-nwwk/backend/.env
ExecStart=/home/report-fuco/proyectos/tracking-habitos-nwwk/backend/env/bin/gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 127.0.0.1:8000 app.main:app
Restart=always
```

- venv en `backend/env`.
- **`gunicorn` no está en `requirements.txt`.** Si el venv es nuevo, instalarlo a mano
  después de `pip install -r requirements.txt`. Producción fija `gunicorn==25.3.0` y
  `uvicorn==0.38.0` — un venv creado solo con requirements.txt deja a systemd fallando
  con `203/EXEC` porque el binario `gunicorn` no existe.
- Variables de entorno en `backend/.env` (no versionado, nunca commitear). Producción
  tiene declaradas: `CORS_ORIGINS`, `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_PASSWORD`,
  `DATABASE_PORT`, `DATABASE_URL`, `DATABASE_USER`, `PORT`, `SECRET_JWT`,
  `SESSION_COOKIE_SECURE`, `TITLE_API`, `URL_SITE`, `VERSION`. Ver todas las claves
  posibles y sus defaults en `backend/.env.example`.
  - `SECRET_JWT` es obligatorio: `app/settings.py` lanza `RuntimeError` al importar si
    falta, la API no arranca.
  - `VAPID_*`, `EVOLUTION_*`, `APIKEY_OPENAI` no están configuradas en producción a
    propósito — esas integraciones (push notifications, WhatsApp, IA) están inactivas.
    No hay proceso `app.notifications.worker` corriendo en el servidor.
- DB: **Postgres nativo del host**, no contenedor. Cluster `postgresql@16-main`, escucha
  en el puerto no estándar **1840** (no 5432). DB `tracking_db`, usuario `tracking_user`.
- Migraciones: **no son automáticas.** El restart del servicio NO corre Alembic (a
  diferencia de `docker-entrypoint.sh`, que sí lo hace pero no se usa en prod). Correr a
  mano antes de reiniciar, desde `backend/`:
  ```
  env/bin/alembic -c app/alembic.ini upgrade head
  ```

## Frontend (`frontend-tracking-habitos.service`)

Unit real (`/etc/systemd/system/frontend-tracking-habitos.service`):

```ini
[Service]
Type=simple
User=report-fuco
Group=report-fuco
WorkingDirectory=/home/report-fuco/proyectos/tracking-habitos-nwwk/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=always
```

- El build **no es parte del servicio**: la unit solo corre `npm run start` sobre lo que
  ya esté en `.next/`. Hay que correr `npm run build` a mano antes de reiniciar,
  si no vas a seguir sirviendo el build viejo.
- `NEXT_PUBLIC_API_URL` (ver `frontend/CLAUDE.md`) se resuelve en build time. Si cambia,
  hace falta rebuild, no alcanza con reiniciar el servicio.
- Node instalado en el servidor: v22.22.2 / npm 10.9.7.

## Nginx

Dos vhosts en `/etc/nginx/sites-available/`, con TLS via certbot/Let's Encrypt
(`/etc/letsencrypt/live/<dominio>/`):

- `app.fucolabs.dev` → `proxy_pass http://127.0.0.1:3000` (con headers de upgrade
  websocket, aunque hoy el frontend no usa websockets)
- `tracking-api` (sirve `api.fucolabs.dev`) → `proxy_pass http://127.0.0.1:8000`

Un deploy normal (nuevo código, misma app) no toca nginx. Solo hace falta editarlo si
cambia el puerto interno, el dominio, o se agrega un servicio nuevo.

## Procedimiento de deploy manual

```
ssh fucolabs
cd /home/report-fuco/proyectos/tracking-habitos-nwwk
git -c safe.directory='*' pull   # confirmar antes en qué rama está parado

# Backend
cd backend
env/bin/pip install -r requirements.txt   # + gunicorn/uvicorn a mano si el venv es nuevo
env/bin/alembic -c app/alembic.ini upgrade head
cd ..

# Frontend
cd frontend
npm install
npm run build
cd ..

# Reiniciar (requiere sudo/root)
systemctl restart tracking-api.service frontend-tracking-habitos.service
systemctl status tracking-api.service frontend-tracking-habitos.service --no-pager
```

Verificar al final con `curl -I https://app.fucolabs.dev` y
`curl -I https://api.fucolabs.dev` (o el endpoint de health que exponga el backend).

## Seguridad

- Nunca pegar `DATABASE_PASSWORD` ni `SECRET_JWT` reales en este archivo ni en ningún
  doc versionado — van solo en `backend/.env` del servidor, que no está en git.
- Sin CI/CD, un push a GitHub (a `main` o a la rama que esté checkeada en el servidor)
  **no despliega nada solo**. Alguien tiene que entrar y correr el procedimiento de arriba.
