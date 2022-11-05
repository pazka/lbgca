# Gunicorn config variables
loglevel = "debug"
errorlog = "-"  # stderr
accesslog = "-"  # stdout
worker_tmp_dir = "/dev/shm"
graceful_timeout = 120
timeout = 120
keepalive = 5
threads = 3
bind = "0.0.0.0:80"
