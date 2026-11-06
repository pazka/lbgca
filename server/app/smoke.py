"""Post-deploy capability check, run INSIDE the container by hosh-deploy (deploy/hosh-deploy.conf POST_DEPLOY):

    python /app/smoke.py http://127.0.0.1:8000

Standard library only. Proves the API works end to end, not just that it answers:
/healthz ok, boot text, public order list, login (the exact body the front reads), profile, an order
written, edited, read back in the public list and DELETED again, logout. Leaves no order behind; the
account `hosh-smoke` stays (accounts cannot be deleted through the API). Exit 1 on the first failure.
"""
import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
USER = "hosh-smoke"
cookie = None


def call(method, path, payload=None, want=200):
    global cookie
    req = urllib.request.Request(BASE + path, method=method,
                                 data=None if payload is None else json.dumps(payload).encode())
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", cookie)  # by hand: the cookie is Secure, this is plain HTTP on loopback
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            status, raw, headers = r.status, r.read().decode(), r.headers
    except urllib.error.HTTPError as e:
        status, raw, headers = e.code, e.read().decode(), e.headers
    if status != want:
        fail("%s %s -> %s (want %s): %s" % (method, path, status, want, raw[:200]))
    for h in headers.get_all("Set-Cookie") or []:
        if h.startswith("session="):
            cookie = h.split(";", 1)[0]
    return raw


def fail(msg):
    print("SMOKE FAIL: " + msg)
    sys.exit(1)


def check(cond, msg):
    if not cond:
        fail(msg)
    print("ok  " + msg)


h = json.loads(call("GET", "/healthz"))
check(h.get("status") == "ok" and h.get("data_dir") == "writable", "/healthz ok, data dir writable")
check(call("GET", "/").startswith("The app is running ! ["), "boot text")
check(isinstance(json.loads(call("GET", "/orders")), list), "public order list")
s = json.loads(call("POST", "/session", {"login": USER}))
check(s.get("connected") is True and s.get("username") == USER and cookie, "login body + session cookie")
check(json.loads(call("GET", "/user")).get("username") == USER, "profile with the session")
o = json.loads(call("POST", "/order", {"product": "hosh-smoke", "amount": 1, "variant": "post-deploy"}))
oid = o["id"]
check(o.get("user", {}).get("username") == USER, "order written")
e = json.loads(call("POST", "/order/%d" % oid, {"amount": 2, "variant": "edited"}))
check((e.get("amount"), e.get("variant")) == (2, "edited"), "order edited")
check(any(x["id"] == oid and x["amount"] == 2 for x in json.loads(call("GET", "/orders"))), "order read back")
call("DELETE", "/order/%d" % oid)
check(all(x["id"] != oid for x in json.loads(call("GET", "/orders"))), "order deleted (nothing left behind)")
call("DELETE", "/session")
call("GET", "/user", want=400)
check(True, "logout")
print("SMOKE OK")
