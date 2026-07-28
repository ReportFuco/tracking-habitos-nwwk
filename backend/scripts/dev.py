from invoke import task
import os

PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

@task
def fastapi(c):
    c.run(
        f'start "FastAPI" cmd /k "cd /d {PROJECT_ROOT} && python -m app.main"',
        pty=False,
        disown=True
    )

@task
def ngrok(c):
    c.run(
        f'start "ngrok" cmd /k "cd /d {PROJECT_ROOT} && ngrok http 8000"',
        pty=False,
        disown=True
    )

@task
def run_all(c):
    ngrok(c)
    fastapi(c)
