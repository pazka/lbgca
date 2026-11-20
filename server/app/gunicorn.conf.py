import os
import sys

# The JSON logging standard (app/jsonlog.py, hosh-management AGENTS.md section 11): gunicorn's own records become
# `server_log` JSON lines on stdout, no access log (Traefik has the requests; gunicorn's line holds the client
# address and the raw path). The app package is next to this file's directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.jsonlog import LOG, GunicornLogger  # noqa: E402

# Gunicorn config variables
logger_class = GunicornLogger
errorlog = "-"
accesslog = None
worker_tmp_dir = "/dev/shm"
graceful_timeout = 120
timeout = 120
keepalive = 5
threads = 3
# PORT: 80 for the legacy box compose (default), 8000 for the hosh-deploy compose.
bind = "0.0.0.0:" + os.environ.get("PORT", "80")
# gunicorn's admin control socket (gunicornc) is not used here, and on the read-only rootfs it cannot be created
# under $HOME: it only logged "Control server error" at every start.
control_socket_disable = True


def post_worker_init(worker):
    from app.main import log_startup
    log_startup()


def on_exit(server):
    LOG.info("shutdown", "Shutting down")
