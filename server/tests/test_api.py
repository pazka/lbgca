"""Upgrade safety net for the lbgca API (see TESTING.md at the repo root).

Characterization tests run against the PRODUCTION config (the image copies config_prod.py over config.py),
with the database redirected to a temp dir. They pin what the API does TODAY, known bugs included, so a
Python, Flask, Flask-Session or SQLAlchemy bump that changes behaviour fails here. Standard library only.

Run from server/:  python -m unittest discover -s tests -v
"""
import importlib
import json
import os
import sqlite3
import sys
import tempfile
import unittest

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SERVER_DIR)

TMP = tempfile.mkdtemp(prefix="lbgca-test-")
cfg = importlib.import_module("app.config_prod")
cfg.INIT_DATABASE_PATH = os.path.join(TMP, "init_database.db")
sqlite3.connect(cfg.INIT_DATABASE_PATH).close()
cfg.DATABASE_PATH = os.path.join(TMP, "database.db")
cfg.SQLALCHEMY_DATABASE_URI = "sqlite:///" + cfg.DATABASE_PATH
import app as app_pkg  # noqa: E402

sys.modules["app.config"] = cfg
app_pkg.config = cfg

from app.main import app  # noqa: E402
from app.models import db  # noqa: E402

BASE = "https://api-lbgca.hosh.it"


def body(r):
    return json.loads(r.get_data(as_text=True))


def error(code, name, message):
    return {"code": code, "name": name, "error": message}


class ApiTest(unittest.TestCase):
    def setUp(self):
        with app.app_context():
            db.drop_all()
            db.create_all()
        self.c = app.test_client()

    def get(self, path, **kw):
        return self.c.get(BASE + path, **kw)

    def post(self, path, payload=None):
        return self.c.post(BASE + path, json=payload)

    def login(self, user="alice", password="pw"):
        return self.post("/session", {"login": user, "password": password})

    def order(self):
        return self.post("/order", {"product": "pasta", "amount": 2, "variant": "red"})

    # ---------------------------------------------------------------- boot / misc

    def test_root_counts_sessions(self):
        r = self.get("/")
        self.assertEqual((r.status_code, r.get_data(as_text=True)), (200, "The app is running ! [0] connected !"))
        self.login()
        self.assertEqual(self.get("/").get_data(as_text=True), "The app is running ! [1] connected !")

    def test_unknown_route_is_a_json_404(self):
        r = self.get("/nope")
        self.assertEqual((r.status_code, r.content_type), (404, "application/json"))
        self.assertEqual(body(r), error(404, "ServerKnownError", "Resource not found"))

    def test_schema(self):
        con = sqlite3.connect(cfg.DATABASE_PATH)
        try:
            tables = [t for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
            cols = {t: [c[1] for c in con.execute(f'PRAGMA table_info("{t}")')] for t in tables}
        finally:
            con.close()
        self.assertEqual(cols, {
            "order": ["id", "product", "amount", "variant", "validated", "created_at", "user_id"],
            "sessions": ["id", "session_id", "data", "expiry"],
            "user": ["id", "username", "password", "avatar", "role", "comment"],
        })

    # ---------------------------------------------------------------- accounts and sessions

    def test_signup(self):
        r = self.post("/signup", {"login": "alice"})
        self.assertEqual((r.status_code, body(r)), (200, {"success": True}))
        r = self.post("/signup", {"login": "alice"})
        self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "User already exist")))

    def test_login_creates_the_account_on_first_use(self):
        r = self.login()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.content_type, "text/html; charset=utf-8")
        # The front (ihm/src/StateManagement/userEffects.js) reads `connected` and `username` from this body.
        self.assertEqual(body(r), {"_permanent": True, "connected": True, "role": "user", "userid": 1,
                                   "username": "alice"})
        cookie = r.headers["Set-Cookie"]
        self.assertTrue(cookie.startswith("session="))
        self.assertIn("HttpOnly", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertEqual(body(self.get("/session")), body(r))

    def test_login_needs_no_password(self):
        # Owner decision (2026-10-19): no passwords; the login name opens the account. Any password is ignored.
        self.login(password="whatever")
        self.c.delete(BASE + "/session")
        r = self.post("/session", {"login": "alice"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual((body(r)["username"], body(r)["userid"]), ("alice", 1))
        self.assertEqual(body(self.get("/user"))["username"], "alice")

    def test_account_made_with_a_password_before_the_change_still_logs_in(self):
        con = sqlite3.connect(cfg.DATABASE_PATH)
        try:
            con.execute("INSERT INTO user (username, password, role) VALUES ('legacy', 'old-secret', 'user')")
            con.commit()
        finally:
            con.close()
        r = self.post("/session", {"login": "legacy", "password": "nopassword"})
        self.assertEqual((r.status_code, body(r)["username"]), (200, "legacy"))

    def test_logout(self):
        self.login()
        r = self.c.delete(BASE + "/session")
        self.assertEqual(body(r), {"success": True})
        self.assertIn("Max-Age=0", r.headers["Set-Cookie"])
        r = self.get("/user")
        self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "User is not connected")))

    def test_no_password_is_stored(self):
        self.login(password="typed-anyway")
        self.post("/signup", {"login": "bob", "password": "typed-anyway"})
        con = sqlite3.connect(cfg.DATABASE_PATH)
        try:
            self.assertEqual(con.execute("SELECT username, password FROM user ORDER BY id").fetchall(),
                             [("alice", ""), ("bob", "")])
        finally:
            con.close()

    # ---------------------------------------------------------------- users

    def test_profile(self):
        r = self.get("/user")
        self.assertEqual(r.status_code, 400)
        self.login()
        me = {"avatar": None, "comment": None, "id": 1, "role": "user", "username": "alice"}
        self.assertEqual(body(self.get("/user")), me)
        self.assertEqual(body(self.get("/user/alice")), me)
        r = self.get("/user/zed")
        self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "No user found")))
        r = self.post("/user", {"avatar": "data:x", "comment": "hi"})
        self.assertEqual(body(r), {**me, "avatar": "data:x", "comment": "hi"})

    # ---------------------------------------------------------------- orders

    def test_order_lifecycle(self):
        self.login()
        r = self.order()
        self.assertEqual(r.status_code, 200)
        o = body(r)
        self.assertEqual({k: o[k] for k in ("amount", "id", "product", "user_id", "validated", "variant")},
                         {"amount": 2, "id": 1, "product": "pasta", "user_id": 1, "validated": 0, "variant": "red"})
        self.assertEqual(o["user"]["username"], "alice")
        self.assertRegex(o["created_at"], r"^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT$")

        r = self.post("/order/validate", {"value": 1})
        self.assertEqual([x["validated"] for x in body(r)], [1])
        self.assertEqual(len(body(self.get("/orders"))), 1)

        r = self.c.delete(BASE + "/order/1")
        self.assertEqual(body(r), {"success": True})
        self.assertEqual(body(self.get("/orders")), [])

    def test_all_orders_are_public(self):
        # Known issue kept as is: GET /orders needs no session and includes every user's profile.
        self.login()
        self.order()
        self.c.delete(BASE + "/session")
        r = self.get("/orders")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(body(r)[0]["user"]["username"], "alice")

    def test_order_routes_need_a_session(self):
        for path, payload in [("/order", {"product": "p", "amount": 1, "variant": "v"}),
                              ("/order/1", {"amount": 1, "variant": "v"}), ("/order/validate", {"value": 1})]:
            r = self.post(path, payload)
            self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "User is not connected")))

    def test_cannot_delete_someone_elses_order(self):
        self.login()
        self.order()
        self.c.delete(BASE + "/session")
        self.login("bob")
        r = self.c.delete(BASE + "/order/1")
        self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "Not your order")))

    def test_edit_order(self):
        self.login()
        self.order()
        r = self.post("/order/1", {"amount": 3, "variant": "blue"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual((body(r)["amount"], body(r)["variant"]), (3, "blue"))
        saved = body(self.get("/orders"))[0]
        self.assertEqual((saved["amount"], saved["variant"], saved["product"]), (3, "blue", "pasta"))
        r = self.post("/order/9", {"amount": 1, "variant": "x"})
        self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "No order found")))

    def test_cannot_edit_someone_elses_or_a_validated_order(self):
        self.login()
        self.order()
        self.c.delete(BASE + "/session")
        self.login("bob")
        r = self.post("/order/1", {"amount": 9, "variant": "x"})
        self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "Not your order")))
        self.c.delete(BASE + "/session")
        self.login("alice")
        self.post("/order/validate", {"value": 1})
        r = self.post("/order/1", {"amount": 9, "variant": "x"})
        self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "Order is validated")))
        self.assertEqual(body(self.get("/orders"))[0]["amount"], 2)

    def test_orders_of_a_user(self):
        self.login()
        self.order()
        self.post("/order", {"product": "bread", "amount": 1, "variant": "white"})
        r = self.get("/user/1/orders")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([(o["product"], o["user"]["username"]) for o in body(r)], [("pasta", "alice"), ("bread", "alice")])
        r = self.get("/user/9/orders")
        self.assertEqual((r.status_code, body(r)), (400, error(400, "ClientKnownError", "No user found")))


if __name__ == "__main__":
    unittest.main()
