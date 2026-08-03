# CLAUDE.md

Guía para Claude Code al trabajar en este monorepo.

## Estructura

Monorepo con dos subproyectos independientes, cada uno con su propio `CLAUDE.md`:

- `frontend/` — Next.js. Ver `frontend/CLAUDE.md` para comandos, arquitectura y
  convenciones de estilo.
- `backend/` — FastAPI + SQLAlchemy async + Alembic + PostgreSQL.

## Deploy a producción

**Ver `DEPLOY.md`** antes de tocar nada relacionado a producción (servidor, systemd,
nginx, migraciones, variables de entorno). Puntos clave que no son obvios leyendo el
código:

- Producción corre bare-metal vía systemd, **no usa Docker**. `backend/Dockerfile` y
  `backend/docker-compose.yml` son un flujo distinto sin usar — no seguirlos como
  referencia para un deploy real.
- Las migraciones de Alembic no son automáticas al reiniciar el servicio; hay que
  correrlas a mano.
- `gunicorn` no está en `backend/requirements.txt` pero es requerido en producción.
- El checkout de producción puede no estar en `main` — confirmar la rama antes de
  asumir qué versión sirve tráfico real.

No hay CI/CD: un push a GitHub no despliega nada por sí solo.
