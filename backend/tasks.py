from invoke import Collection
from scripts import *

namespace = Collection()

namespace.add_task(fastapi)
namespace.add_task(ngrok)

# las Principales para poder desplegar en dev y resetear la base de datos
namespace.add_task(run_all, name="dev")
namespace.add_task(reset_db, name="reset-db")
