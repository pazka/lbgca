FROM python:3.14-slim

RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY ./app/requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r /app/requirements.txt

COPY ./app /app
COPY ./app/config_prod.py /app/config.py

# Two ways to run this image (DEPLOY.md):
# - legacy box compose: default user (root), PORT 80, bind mounts /app/database + /app/static;
# - hosh-deploy compose: user 10001, read-only rootfs, PORT=8000, DATA_DIR=/data, STATIC_DIR=/data/static
#   on the named volume lbgca-data (a new volume takes /data's owner below, so 10001 can write it).
RUN install -d -o 10001 -g 10001 -m 750 /data

EXPOSE 80 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import os, sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT', '80'), timeout=4).status == 200 else 1)"]

CMD ["gunicorn", "--conf", "app/gunicorn.conf.py", "app.wsgi:app"]
