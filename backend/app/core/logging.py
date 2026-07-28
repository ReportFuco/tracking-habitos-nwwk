from loguru import logger
import sys

def setup_logging():
    logger.remove()

    logger.add(
        sys.stdout,
        level="DEBUG",
        format=(
            "<level>{level}</level>:     "
            "<cyan>{extra[ip]}</cyan> - "
            "<green>{extra[method]}</green> "
            "<cyan>{extra[path]}</cyan> "
            "<level>{extra[status]}</level> "
            "<magenta>{extra[duration]}</magenta> | "
            "{message}"
        ),
        enqueue=True
    )
