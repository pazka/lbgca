import os

# Grabs the folder where the script runs.
basedir = os.path.abspath(os.path.dirname(__file__))

PORT = 80
# Enable debug mode.
DEBUG = False

SERVER_NAME = "api.lesbonnesgrossescouillesdalex.store"
HOST = "api.lesbonnesgrossescouillesdalex.store"

CORS_ORIGINS = [
    "https://lesbonnesgrossescouillesdalex.store",
    "https://api.lesbonnesgrossescouillesdalex.store",
    "https://www.lesbonnesgrossescouillesdalex.store"
]
COOKIE_DOMAIN = ".lesbonnesgrossescouillesdalex.store"
CORS_SUPPORTS_CREDENTIALS = True

# Secret key for session management. You can generate random strings here:
# https://randomkeygen.com/
SECRET_KEY = 'F9hnubP4mexPogIFBVEsFHIVpUpC6JxO'

# Connect to the database
INIT_DATABASE_PATH = os.path.join(basedir, 'database/init_database.db')
DATABASE_PATH = os.path.join(basedir, 'database/database.db')
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + DATABASE_PATH

SESSION_PERMANENT = True
SESSION_TYPE = 'sqlalchemy'
PERMANENT_SESSION_LIFETIME = 60 * 60

SMALL_FILE_SIZE_LIMIT = 20 * 1000  # 1 000 = 1ko
FILE_SIZE_LIMIT = 1 * 1000 * 1000  # 1 000 000 = 1Mo
