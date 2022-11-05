FROM python:3.8

COPY ./app/requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r /app/requirements.txt
RUN pip install gunicorn

COPY ./app /app
COPY ./app/config_prod.py /app/config.py

EXPOSE 443

CMD ["gunicorn", "--conf", "app/gunicorn.conf.py", "app.wsgi:app"]