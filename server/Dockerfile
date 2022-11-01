FROM tiangolo/uwsgi-nginx-flask:python3.8

COPY ./app/requirements.txt /app

RUN pip install --no-cache-dir -r /app/requirements.txt

ENV LISTEN_PORT 6547
EXPOSE 6547
EXPOSE 443

COPY ./app /app
COPY ./app/config_prod.py /app/config.py