"""Logging standard of the hosh.it services (pazka/hosh-management AGENTS.md section 11). Standard library only.

One JSON object per line on stdout: ts (UTC, ms), level, service, version (release tag, APP_VERSION), event, msg,
then the line's fields. LOG_LEVEL (else APP_LOG_LEVEL) sets the level, default info.

What the server writes at info: one `startup` line (each gunicorn worker, once the app is loaded) and one `shutdown`
line (gunicorn master, on exit). Requests are not logged one by one (Traefik has them, so gunicorn's access log is
off): a status >= 500 is one `request_failed` error line with `err`, a 4xx on an auth route (`/session`, `/signup`)
one `auth_failed` warn line, anything slower than 1 s one `request_slow` warn line, the rest (and /healthz) only at
debug. Gunicorn's own records are `server_log` lines whose `msg` is the leading words of the record's template
(`safe_msg`), never its arguments.

Never logged: request bodies (login names, orders), cookies and session ids, IPs, raw paths or query strings.
"""
import datetime
import json
import logging
import os
import re
import sys
import threading
import time
import traceback
import uuid

SERVICE = "lbgca"
LEVELS = {"debug": 10, "info": 20, "warn": 30, "error": 40}
SLOW_MS = 1000
AUTH_ROUTES = ("/session", "/signup")
# The configuration names the startup line may list (only when they are set, never their value).
CONFIG_NAMES = ("PORT", "DATA_DIR", "STATIC_DIR", "SECRET_KEY", "LOG_LEVEL", "APP_LOG_LEVEL", "APP_VERSION")
_REQ_ID = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")


def level_from_env(env=None):
    env = os.environ if env is None else env
    value = (env.get("LOG_LEVEL") or env.get("APP_LOG_LEVEL") or "info").strip().lower()
    return value if value in LEVELS else "info"


def config_names_set(env=None):
    env = os.environ if env is None else env
    return [name for name in CONFIG_NAMES if env.get(name)]


def utc_ts(now=None):
    now = datetime.datetime.now(datetime.timezone.utc) if now is None else now
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (now.microsecond // 1000)


class Logger:
    def __init__(self, stream=None, level=None, version=None):
        self.stream = stream            # None = sys.stdout at write time
        self.level = level or level_from_env()
        self.version = version or os.environ.get("APP_VERSION") or "dev"
        self._lock = threading.Lock()

    def enabled(self, level):
        return LEVELS[level] >= LEVELS[self.level]

    def log(self, level, event, msg, **fields):
        if not self.enabled(level):
            return
        line = {"ts": utc_ts(), "level": level, "service": SERVICE, "version": self.version,
                "event": event, "msg": msg}
        line.update(fields)
        text = json.dumps(line, ensure_ascii=False, default=str)
        with self._lock:
            out = self.stream or sys.stdout
            out.write(text + "\n")
            out.flush()

    def debug(self, event, msg, **fields):
        self.log("debug", event, msg, **fields)

    def info(self, event, msg, **fields):
        self.log("info", event, msg, **fields)

    def warn(self, event, msg, **fields):
        self.log("warn", event, msg, **fields)

    def error(self, event, msg, **fields):
        self.log("error", event, msg, **fields)


LOG = Logger()


def err_field(e, hide=()):
    """The `err` field of an error line: type, message, stack. Every string of `hide` (the request body and its
    values...) is replaced by <hidden> in the message and the stack."""
    secrets = sorted({h for h in hide if isinstance(h, str) and len(h) > 1}, key=len, reverse=True)

    def clean(text):
        for h in secrets:
            text = text.replace(h, "<hidden>")
        return text

    kind = type(e).__name__
    message = clean(str(e))
    frames = [clean(f.rstrip("\n")) for f in traceback.format_tb(e.__traceback__)] if e.__traceback__ else []
    return {"type": kind, "message": message, "stack": "\n".join([f"{kind}: {message}"] + frames)}


def request_id(incoming):
    """X-Request-Id kept when it is a plain token of at most 64 characters, generated otherwise."""
    return incoming if incoming and _REQ_ID.match(incoming) else uuid.uuid4().hex


def _strings_of(value):
    """Every string value inside a decoded JSON body (login names, products...), so one echoed in an error is hidden
    too. Keys and numbers are kept: they are the API's own names and counts, and hiding "login" or "3" would garble
    `KeyError: 'login'` and the stack's line numbers."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings_of(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from _strings_of(v)


def body_words():
    """The current request's body and every value in it (strings to hide in an error line)."""
    from flask import request
    words = []
    try:
        raw = request.get_data(as_text=True)
    except Exception:  # an unreadable body: nothing more to hide
        return words
    words.append(raw)
    try:
        words.extend(_strings_of(json.loads(raw)))
    except ValueError:
        pass
    return words


_WORDS = re.compile(r"^[A-Za-z][A-Za-z ]*")


def safe_msg(template):
    """The leading words (letters and spaces only) of a library record's template: "Error handling request %s" ->
    "Error handling request". Libraries sometimes format before logging ("Invalid request from ip=1.2.3.4: ..."),
    so the template itself can hold an address, a path or a header; what follows the first other character is
    dropped."""
    m = _WORDS.match(str(template))
    return m.group(0).strip() if m else "library record"


class _JsonHandler(logging.Handler):
    """A library's own log records as standard lines, WITHOUT their data: `msg` is `safe_msg` of the record's
    template, the arguments (a raw path, an address, a header) are never written."""

    def __init__(self, logger, event, level=logging.NOTSET):
        super().__init__(level=level)
        self.logger, self.event = logger, event

    def emit(self, record):
        level = "error" if record.levelno >= logging.ERROR else "warn" if record.levelno >= logging.WARNING \
            else "info" if record.levelno >= logging.INFO else "debug"
        fields = {}
        if record.exc_info and record.exc_info[1] is not None:
            fields["err"] = err_field(record.exc_info[1])
        self.logger.log(level, self.event, safe_msg(record.msg), **fields)


def install(app, logger=None):
    """Request ids and the request lines on the Flask app; flask_cors as JSON lines (warnings and errors only).
    Flask's own exception print never runs: main.py handles every exception (status 500 + the request_failed line)."""
    from flask import g, request

    logger = logger or LOG
    cors = logging.getLogger("flask_cors")
    cors.setLevel(logging.WARNING)
    cors.handlers = [_JsonHandler(logger, "cors_log")]
    cors.propagate = False

    @app.before_request
    def _start():
        g.log_t0 = time.monotonic()
        g.log_req_id = request_id(request.headers.get("X-Request-Id"))

    @app.after_request
    def _line(response):
        req_id = g.get("log_req_id") or request_id(None)
        response.headers["X-Request-Id"] = req_id
        t0 = g.get("log_t0")
        route = request.url_rule.rule if request.url_rule is not None else "<unmatched>"
        fields = {"req_id": req_id, "method": request.method, "route": route, "status": response.status_code,
                  "dur_ms": round((time.monotonic() - t0) * 1000, 1) if t0 is not None else 0}
        if response.status_code >= 500:
            exc = g.get("log_exc")
            if exc is not None:
                fields["err"] = err_field(exc, body_words())
            logger.error("request_failed", "server error", **fields)
        elif 400 <= response.status_code < 500 and route in AUTH_ROUTES:
            logger.warn("auth_failed", "refused", **fields)
        elif fields["dur_ms"] > SLOW_MS:
            logger.warn("request_slow", "slow request", **fields)
        elif route == "/healthz":
            logger.debug("healthz", "health check", **fields)
        else:
            logger.debug("request", "request", **fields)
        return response

    return logger


def remember_exception(e):
    """Called by the app's error handler: the exception the request_failed line reports."""
    from flask import g, has_request_context
    if has_request_context():
        g.log_exc = e


try:
    from gunicorn.glogging import Logger as _GunicornLogger
except ImportError:  # gunicorn is only needed in the image (requirements.txt)
    _GunicornLogger = None

if _GunicornLogger is not None:
    class GunicornLogger(_GunicornLogger):
        """gunicorn's error log as `server_log` JSON lines on stdout (templates only); no access log (Traefik has
        the requests, and gunicorn's line holds the client address and the raw path). Warnings and errors only,
        everything at LOG_LEVEL=debug."""

        def setup(self, cfg):
            super().setup(cfg)
            level = logging.DEBUG if LOG.level == "debug" else logging.WARNING
            self.error_log.handlers = [_JsonHandler(LOG, "server_log")]
            self.error_log.setLevel(level)
            self.error_log.propagate = False
            self.access_log.handlers = [logging.NullHandler()]
            self.access_log.propagate = False

        def access(self, resp, req, environ, request_time):
            return
