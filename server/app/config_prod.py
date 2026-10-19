import os
import secrets

# Grabs the folder where the script runs.
basedir = os.path.abspath(os.path.dirname(__file__))

PORT = 80
# Enable debug mode.
DEBUG = False

SERVER_NAME = "api-lbgca.hosh.it"
HOST = "api-lbgca.hosh.it"

CORS_ORIGINS = [
    "https://lbgca.hosh.it",
    "https://api-lbgca.hosh.it",
    "http://dev.localhost"
]
COOKIE_DOMAIN = ".hosh.it"
CORS_SUPPORTS_CREDENTIALS = True

# Secret key for session management. You can generate random strings here:
# https://randomkeygen.com/
# From the environment. Not used for sessions today (Flask-Session ids are not signed: SESSION_USE_SIGNER is
# off), so a random per-boot fallback is safe. The value formerly committed here must be considered public.
SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"

# Connect to the database
INIT_DATABASE_PATH = os.path.join(basedir, 'database/init_database.db')
DATABASE_PATH = os.path.join(basedir, 'database/database.db')
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + DATABASE_PATH

SESSION_PERMANENT = True
SESSION_TYPE = 'sqlalchemy'
PERMANENT_SESSION_LIFETIME = 60 * 60

SMALL_FILE_SIZE_LIMIT = 20 * 1000  # 1 000 = 1ko
FILE_SIZE_LIMIT = 1 * 1000 * 1000  # 1 000 000 = 1Mo
