import datetime
import os

SERVER_NAME = "dev.localhost:8080"
SESSION_COOKIE_DOMAIN = "dev.localhost"
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = False

CORS_HEADERS = 'Content-Type'
HOST = "dev.localhost"
# Grabs the folder where the script runs.
basedir = os.path.abspath(os.path.dirname(__file__))

# Enable debug mode.
DEBUG = True

# Enable debug mode.
PORT = 8080

# Secret key for session management. You can generate random strings here:
# https://randomkeygen.com/
SECRET_KEY = 'F9hnubP4mexPogIFBVEsFHIVpUpC6JxO'

# Connect to the database
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'database.db')

SESSION_PERMANENT = True
SESSION_TYPE = 'sqlalchemy'
PERMANENT_SESSION_LIFETIME = datetime.timedelta(hours=2)
SMALL_FILE_SIZE_LIMIT = 20 * 1000  # 1 000 = 1ko
FILE_SIZE_LIMIT = 5 * 1000 * 1000  # 1 000 000 = 1Mo
