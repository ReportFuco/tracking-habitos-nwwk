from invoke import task
import subprocess
from app.settings import *
import shutil


@task
def reset_db(ctx):
    """
    Resetea completamente la base y migraciones
    """
    print("🧹 Borrando migraciones Alembic...")
    for item in ALEMBIC_VERSIONS_PATH.iterdir():
        if item.name == "__init__.py":
            continue

        if item.is_file():
            item.unlink()
        elif item.is_dir():
            shutil.rmtree(item)

    print("🗑️ Reseteando base de datos...")
    drop_database()

    print("🧱 Generando migración Alembic...")
    ctx.run(
        f'alembic -c {ALEMBIC_INI} revision --autogenerate -m "reset migraciones"'
    )

    ctx.run(
        f'alembic -c {ALEMBIC_INI} upgrade head'
    )

    print("✅ Reset DB completado correctamente")


def drop_database():
    print("🔌 Cerrando conexiones activas...")

    subprocess.run(
        [
            "psql",
            "-U", DATABASE_USER,
            "-h", DATABASE_HOST,
            "-p", DATABASE_PORT,
            "-d", "postgres",
            "-c",
            f"""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = '{DATABASE_NAME}'
              AND pid <> pg_backend_pid();
            """
        ],
        check=True
    )

    print("🗑️ Eliminando base de datos...")
    subprocess.run(
        [
            "psql",
            "-U", DATABASE_USER,
            "-h", DATABASE_HOST,
            "-p", DATABASE_PORT,
            "-d", "postgres",
            "-c",
            f"DROP DATABASE IF EXISTS {DATABASE_NAME};"
        ],
        check=True
    )

    print("🆕 Creando base de datos...")
    subprocess.run(
        [
            "psql",
            "-U", DATABASE_USER,
            "-h", DATABASE_HOST,
            "-p", DATABASE_PORT,
            "-d", "postgres",
            "-c",
            f"CREATE DATABASE {DATABASE_NAME};"
        ],
        check=True
    )
