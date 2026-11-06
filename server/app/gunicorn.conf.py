import os

# Gunicorn config variables
loglevel = "debug"
errorlog = "-"  # stderr
accesslog = "-"  # stdout
worker_tmp_dir = "/dev/shm"
graceful_timeout = 120
timeout = 120
keepalive = 5
threads = 3
# PORT: 80 for the legacy box compose (default), 8000 for the hosh-deploy compose.
bind = "0.0.0.0:" + os.environ.get("PORT", "80")
