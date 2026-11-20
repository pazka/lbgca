"""Logging standard (pazka/hosh-management AGENTS.md section 11), see TESTING.md "Logs". Standard library only.

Unit tests of app/jsonlog.py, the request lines on the real app (production config, the same set-up as
test_api.py), gunicorn's own records, and the real server (gunicorn with app/gunicorn.conf.py in a subprocess, the
image's layout): startup line, an error line, no access log, shutdown line on SIGTERM, nothing on stderr.
Run from server/:  python -m unittest discover -s tests -v
"""
import contextlib
import datetime
import io
import json
import logging
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from unittest import mock

import test_api  # noqa: F401  (production config + temp database, then the app)
from test_api import BASE, app

import app.main as main  # noqa: E402
from app import jsonlog  # noqa: E402

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEAD = ["ts", "level", "service", "version", "event", "msg"]
REQ = ["req_id", "method", "route", "status", "dur_ms"]
TS = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$")


def lines_of(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]


class LoggerTest(unittest.TestCase):
    def test_one_json_object_per_line_with_the_standard_fields_first(self):
        out = io.StringIO()
        log = jsonlog.Logger(stream=out, level="info", version="v1.2.3")
        log.info("startup", "hello", port=8000)
        log.error("thing_failed", "bad", status=500)
        rows = lines_of(out.getvalue())
        self.assertEqual(len(out.getvalue().splitlines()), 2)
        self.assertEqual(list(rows[0]), HEAD + ["port"])
        self.assertRegex(rows[0]["ts"], TS)
        self.assertEqual(rows[0], {"ts": rows[0]["ts"], "level": "info", "service": "lbgca", "version": "v1.2.3",
                                   "event": "startup", "msg": "hello", "port": 8000})
        self.assertEqual([rows[1]["level"], rows[1]["event"], rows[1]["status"]], ["error", "thing_failed", 500])

    def test_level_filter_and_env(self):
        out = io.StringIO()
        log = jsonlog.Logger(stream=out, level="warn", version="x")
        log.debug("a", "a")
        log.info("b", "b")
        log.warn("c", "c")
        log.error("d", "d")
        self.assertEqual([r["event"] for r in lines_of(out.getvalue())], ["c", "d"])
        self.assertEqual(jsonlog.level_from_env({}), "info")
        self.assertEqual(jsonlog.level_from_env({"LOG_LEVEL": "DEBUG"}), "debug")
        self.assertEqual(jsonlog.level_from_env({"APP_LOG_LEVEL": "error"}), "error")
        self.assertEqual(jsonlog.level_from_env({"LOG_LEVEL": "warn", "APP_LOG_LEVEL": "debug"}), "warn")
        self.assertEqual(jsonlog.level_from_env({"LOG_LEVEL": "loud"}), "info")
        self.assertEqual(jsonlog.Logger(stream=io.StringIO()).version, os.environ.get("APP_VERSION") or "dev")

    def test_ts_is_utc_whatever_the_local_timezone(self):
        if not hasattr(time, "tzset"):
            self.skipTest("time.tzset is POSIX only")
        old = os.environ.get("TZ")

        def restore():
            if old is None:
                os.environ.pop("TZ", None)
            else:
                os.environ["TZ"] = old
            time.tzset()
        self.addCleanup(restore)
        os.environ["TZ"] = "Asia/Tokyo"     # UTC+9, no daylight saving
        time.tzset()
        self.assertEqual(time.timezone, -9 * 3600)   # the zone is really in effect
        ts = jsonlog.utc_ts()
        self.assertRegex(ts, TS)
        parsed = datetime.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=datetime.timezone.utc)
        self.assertLess(abs(parsed.timestamp() - time.time()), 5)

    def test_config_names_never_values(self):
        env = {"PORT": "8000", "SECRET_KEY": "s3cr3t-value", "DATA_DIR": "", "OTHER": "x"}
        self.assertEqual(jsonlog.config_names_set(env), ["PORT", "SECRET_KEY"])

    def test_err_field_hides_words_and_has_frames(self):
        def boom():
            raise ValueError("bad login zed-private for body {\"login\": \"zed-private\"}")
        try:
            boom()
        except ValueError as e:
            err = jsonlog.err_field(e, ["zed-private", "", "x"])
        self.assertEqual(list(err), ["type", "message", "stack"])
        self.assertEqual(err["type"], "ValueError")
        self.assertEqual(err["message"], "bad login <hidden> for body {\"login\": \"<hidden>\"}")
        self.assertTrue(err["stack"].startswith("ValueError: bad login <hidden>"))
        self.assertIn("in boom", err["stack"])
        self.assertNotIn("Traceback", err["stack"])     # the smokes fail on a raw Python traceback
        self.assertNotIn("zed-private", json.dumps(err))

    def test_request_id(self):
        self.assertEqual(jsonlog.request_id("abc-123_x.y"), "abc-123_x.y")
        for bad in (None, "", "a" * 65, "has space", "x\ny", "<script>"):
            self.assertRegex(jsonlog.request_id(bad), r"^[0-9a-f]{32}$", bad)

    def test_body_values_are_all_collected(self):
        words = list(jsonlog._strings_of({"login": "zed", "order": {"product": "pasta", "amount": 3,
                                                                    "tags": ["red", True, None]}}))
        self.assertEqual(sorted(words), ["pasta", "red", "zed"])


class RequestLinesTest(unittest.TestCase):
    """The real app (production config) with jsonlog.LOG writing into a buffer."""

    def setUp(self):
        with app.app_context():
            test_api.db.drop_all()
            test_api.db.create_all()
        self.out = io.StringIO()
        old_stream, old_level = jsonlog.LOG.stream, jsonlog.LOG.level
        jsonlog.LOG.stream, jsonlog.LOG.level = self.out, "info"
        self.addCleanup(setattr, jsonlog.LOG, "stream", old_stream)
        self.addCleanup(setattr, jsonlog.LOG, "level", old_level)
        self.c = app.test_client()

    def rows(self):
        return lines_of(self.out.getvalue())

    def post(self, path, payload, **kw):
        return self.c.post(BASE + path, json=payload, **kw)

    def test_500_is_one_request_failed_line_with_the_original_err_and_no_body_or_path(self):
        self.post("/session", {"login": "zed-private-name"})
        self.out.truncate(0)
        self.out.seek(0)
        # only this request's body values are hidden (the login name came in an earlier request)

        def leaky(product, amount, variant):
            raise ValueError(f"cannot store {product} x{amount} for zed-private-name")
        errors, stderr = io.StringIO(), io.StringIO()
        with mock.patch.object(main, "create_order", leaky), contextlib.redirect_stderr(stderr):
            r = self.post("/order?q=private-query", {"product": "secret-dish", "amount": 7, "variant": "hot"},
                          headers={"X-Request-Id": "rid-1"}, errors_stream=errors)
        # the client body is unchanged (a contract: the catch-all 500 returns str(e))
        self.assertEqual(r.status_code, 500)
        self.assertEqual(json.loads(r.get_data(as_text=True)),
                         {"code": 500, "name": "ServerKnownError", "error": "cannot store secret-dish x7 for zed-private-name"})
        self.assertEqual(r.headers["X-Request-Id"], "rid-1")
        # Flask's own "Exception on ..." + raw traceback print is silenced
        self.assertEqual(errors.getvalue(), "")
        self.assertEqual(stderr.getvalue(), "")
        rows = self.rows()
        self.assertEqual(len(rows), 1, self.out.getvalue())
        e = rows[0]
        self.assertEqual(list(e), HEAD + REQ + ["err"])
        self.assertEqual([e["level"], e["event"], e["req_id"], e["method"], e["route"], e["status"]],
                         ["error", "request_failed", "rid-1", "POST", "/order", 500])
        self.assertIsInstance(e["dur_ms"], (int, float))
        # the original exception (ServerKnownError keeps `ex`), with every body value hidden
        self.assertEqual(e["err"]["type"], "ValueError")
        self.assertEqual(e["err"]["message"], "cannot store <hidden> x7 for zed-private-name")
        self.assertIn("in leaky", e["err"]["stack"])
        for s in ("secret-dish", "private-query", "127.0.0.1", "session="):
            self.assertNotIn(s, self.out.getvalue(), s)

    def test_auth_4xx_is_one_warn_line_other_4xx_and_ok_silent_at_info(self):
        self.post("/signup", {"login": "zed-private-name"})
        r = self.post("/signup", {"login": "zed-private-name"})                 # 400 User already exist
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.c.get(BASE + "/user").status_code, 400)           # not connected: not an auth route
        self.assertEqual(self.c.get(BASE + "/nope?x=1").status_code, 404)
        self.c.get(BASE + "/healthz")
        self.c.get(BASE + "/orders")
        rows = self.rows()
        self.assertEqual([(r["level"], r["event"], r["route"], r["status"]) for r in rows],
                         [("warn", "auth_failed", "/signup", 400)])
        self.assertEqual(list(rows[0]), HEAD + REQ)
        self.assertNotIn("zed-private-name", self.out.getvalue())

    def test_slow_request_is_a_warn_line(self):
        real = main.get_orders

        def slow():
            time.sleep(1.05)
            return real()
        with mock.patch.object(main, "get_orders", slow):
            self.c.get(BASE + "/orders")
        rows = self.rows()
        self.assertEqual([(r["level"], r["event"], r["route"], r["status"]) for r in rows],
                         [("warn", "request_slow", "/orders", 200)])
        self.assertGreater(rows[0]["dur_ms"], 1000)

    def test_debug_level_logs_every_request_by_route(self):
        jsonlog.LOG.level = "debug"
        self.c.get(BASE + "/healthz")
        self.c.get(BASE + "/user/zed-private-name")
        self.c.get(BASE + "/nowhere?x=1")
        rows = self.rows()
        self.assertEqual([(r["level"], r["event"], r["route"]) for r in rows],
                         [("debug", "healthz", "/healthz"), ("debug", "request", "/user/<string:name>"),
                          ("debug", "request", "<unmatched>")])
        self.assertNotIn("x=1", self.out.getvalue())
        self.assertNotIn("zed-private-name", self.out.getvalue())

    def test_request_id_kept_or_generated(self):
        self.assertEqual(self.c.get(BASE + "/healthz", headers={"X-Request-Id": "abc.1"}).headers["X-Request-Id"], "abc.1")
        for headers in ({}, {"X-Request-Id": "bad id with spaces"}):
            self.assertRegex(self.c.get(BASE + "/healthz", headers=headers).headers["X-Request-Id"], r"^[0-9a-f]{32}$")

    def test_flask_cors_records_are_json_lines_without_their_arguments(self):
        cors = logging.getLogger("flask_cors")
        cors.debug("Request to '%s' matches CORS resource '*'.", "/private-path")
        cors.warning("Origin %s not allowed", "https://evil.example")
        rows = self.rows()
        self.assertEqual([(r["level"], r["event"], r["msg"]) for r in rows], [("warn", "cors_log", "Origin")])
        self.assertNotIn("evil.example", self.out.getvalue())
        self.assertNotIn("private-path", self.out.getvalue())

    def test_startup_line(self):
        out = io.StringIO()
        main.log_startup(jsonlog.Logger(stream=out, level="info", version="v9.8.7"))
        rows = lines_of(out.getvalue())
        self.assertEqual(len(rows), 1)
        s = rows[0]
        self.assertEqual(list(s), HEAD + ["port", "debug", "data_dir_writable", "static_dir_writable", "log_level", "config"])
        self.assertEqual([s["level"], s["event"], s["msg"], s["debug"], s["data_dir_writable"]],
                         ["info", "startup", "LBGCA SERVER NO DEBUG", False, True])


class GunicornLoggerTest(unittest.TestCase):
    def test_gunicorn_records_are_templates_only_and_no_access_line(self):
        from gunicorn.config import Config
        out = io.StringIO()
        old = jsonlog.LOG.stream
        jsonlog.LOG.stream = out
        self.addCleanup(setattr, jsonlog.LOG, "stream", old)
        glog = jsonlog.GunicornLogger(Config())
        glog.info("Booting worker with pid: %s", 42)                     # below warning: not written at info
        glog.warning("Invalid request from ip=%s: %s", "203.0.113.9", "GET /private-path")
        glog.warning("Invalid request from ip=203.0.113.9: 'GET /private-path'")    # formatted before logging
        glog.warning("1.2.3.4 is not allowed")
        try:
            raise OSError("socket broke")
        except OSError:
            glog.exception("Error handling request %s", "/private-path?q=1")
        glog.access(None, None, {}, None)
        rows = lines_of(out.getvalue())
        self.assertEqual([(r["level"], r["event"], r["msg"]) for r in rows],
                         [("warn", "server_log", "Invalid request from ip"),
                          ("warn", "server_log", "Invalid request from ip"),
                          ("warn", "server_log", "library record"),
                          ("error", "server_log", "Error handling request")])
        self.assertEqual(rows[3]["err"]["type"], "OSError")
        for s in ("203.0.113", "1.2.3.4", "private-path"):
            self.assertNotIn(s, out.getvalue())


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class RealServerTest(unittest.TestCase):
    """gunicorn + app/gunicorn.conf.py on the image's layout (config_prod.py as config.py), in a subprocess."""

    def start(self, extra_env=None):
        self.dir = tempfile.mkdtemp(prefix="lbgca-log-")
        self.addCleanup(shutil.rmtree, self.dir, True)
        shutil.copytree(os.path.join(SERVER_DIR, "app"), os.path.join(self.dir, "app"),
                        ignore=shutil.ignore_patterns("__pycache__", "database", "static"))
        shutil.copy(os.path.join(SERVER_DIR, "app", "config_prod.py"), os.path.join(self.dir, "app", "config.py"))
        data = os.path.join(self.dir, "data")
        os.makedirs(os.path.join(data, "static"))
        self.port = free_port()
        env = {k: v for k, v in os.environ.items() if k not in ("LOG_LEVEL", "APP_LOG_LEVEL", "APP_VERSION")}
        env.update({"PORT": str(self.port), "DATA_DIR": data, "STATIC_DIR": os.path.join(data, "static"),
                    "APP_VERSION": "v9.8.7", "PYTHONUNBUFFERED": "1", "TZ": "Asia/Tokyo"})
        env.update(extra_env or {})
        self.out_path, self.err_path = os.path.join(self.dir, "stdout"), os.path.join(self.dir, "stderr")
        self.out_f, self.err_f = open(self.out_path, "w"), open(self.err_path, "w")
        self.addCleanup(self.err_f.close)
        self.addCleanup(self.out_f.close)
        self.proc = subprocess.Popen([sys.executable, "-m", "gunicorn", "--conf", "app/gunicorn.conf.py", "app.wsgi:app"],
                                     cwd=self.dir, env=env, stdout=self.out_f, stderr=self.err_f)
        self.addCleanup(self.kill)
        self.base = f"http://127.0.0.1:{self.port}"
        until = time.time() + 30
        while True:
            try:
                urllib.request.urlopen(self.base + "/healthz", timeout=2).read()
                break
            except Exception:
                if time.time() > until or self.proc.poll() is not None:
                    self.fail("server did not start:\n" + self.read(self.out_path) + self.read(self.err_path))
                time.sleep(0.2)

    def kill(self):
        if self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait()

    @staticmethod
    def read(path):
        with open(path) as f:
            return f.read()

    def call(self, method, path, payload=None):
        req = urllib.request.Request(self.base + path, method=method, headers={"Host": "api-lbgca.hosh.it",
                                     "Content-Type": "application/json"},
                                     data=None if payload is None else json.dumps(payload).encode())
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def test_startup_error_no_access_log_and_shutdown(self):
        self.start()
        t0 = time.time()
        self.assertEqual(self.call("POST", "/session", {"logn": "zed-private-name"})[0], 500)   # KeyError 'login'
        self.assertEqual(self.call("POST", "/session", {"login": "zed-private-name"})[0], 200)
        self.assertEqual(self.call("GET", "/orders?q=private-query")[0], 200)
        time.sleep(0.3)
        self.proc.send_signal(signal.SIGTERM)
        self.assertEqual(self.proc.wait(timeout=20), 0)

        out = self.read(self.out_path)
        rows = lines_of(out)
        self.assertEqual([r["event"] for r in rows], ["startup", "request_failed", "shutdown"], out)
        s = rows[0]
        self.assertEqual(s, {"ts": s["ts"], "level": "info", "service": "lbgca", "version": "v9.8.7", "event": "startup",
                             "msg": "LBGCA SERVER NO DEBUG", "port": self.port, "debug": False,
                             "data_dir_writable": True, "static_dir_writable": True, "log_level": "info",
                             "config": ["PORT", "DATA_DIR", "STATIC_DIR", "APP_VERSION"]})
        # ts is UTC although the server runs with TZ=Asia/Tokyo
        ts = datetime.datetime.strptime(s["ts"], "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=datetime.timezone.utc)
        self.assertLess(abs(ts.timestamp() - t0), 30)
        e = rows[1]
        self.assertEqual(list(e), HEAD + REQ + ["err"])
        self.assertEqual([e["level"], e["method"], e["route"], e["status"], e["err"]["type"]],
                         ["error", "POST", "/session", 500, "KeyError"])
        self.assertEqual([rows[2]["level"], rows[2]["msg"]], ["info", "Shutting down"])
        for line in out.splitlines():
            self.assertEqual(list(json.loads(line))[:6], HEAD, line)
        for s in ("zed-private-name", "private-query", "127.0.0.1", "Traceback", "GET /", "POST /"):
            self.assertNotIn(s, out, s)
        self.assertEqual(self.read(self.err_path), "")

    def test_debug_level_gunicorn_records_are_json_lines_too(self):
        self.start({"LOG_LEVEL": "debug"})
        self.assertEqual(self.call("GET", "/healthz")[0], 200)
        with socket.create_connection(("127.0.0.1", self.port), timeout=5) as raw:   # not HTTP: gunicorn logs it
            raw.sendall(b"NOT-HTTP /private-path\r\n\r\n")
            raw.recv(1024)
        time.sleep(0.3)
        self.proc.send_signal(signal.SIGTERM)
        self.assertEqual(self.proc.wait(timeout=20), 0)
        out = self.read(self.out_path)
        rows = lines_of(out)
        starts = [r for r in rows if r["event"] == "startup"]
        self.assertEqual(len(starts), 1, out)
        self.assertEqual(starts[0]["log_level"], "debug")
        self.assertIn("LOG_LEVEL", starts[0]["config"])
        self.assertIn(("debug", "healthz", "/healthz"), [(r["level"], r["event"], r.get("route")) for r in rows])
        self.assertIn("server_log", [r["event"] for r in rows])      # gunicorn's own records, as JSON lines
        self.assertEqual(rows[-1]["event"], "shutdown")
        for line in out.splitlines():
            self.assertEqual(list(json.loads(line))[:6], HEAD, line)
        for s in ("private-path", "127.0.0.1"):
            self.assertNotIn(s, out, s)
        self.assertEqual(self.read(self.err_path), "")


if __name__ == "__main__":
    unittest.main()
