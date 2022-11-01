import datetime
import os

PORT = 8080
SERVER_NAME = "dev.localhost:" + str(PORT)
SESSION_COOKIE_DOMAIN = "dev.localhost"
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = False

CORS_HEADERS = 'Content-Type'
HOST = "dev.localhost"
# Grabs the folder where the script runs.
print(__file__)
basedir = os.path.abspath(os.path.dirname(__file__))
print(basedir)

# Enable debug mode.
DEBUG = True

# Secret key for session management. You can generate random strings here:
# https://randomkeygen.com/
SECRET_KEY = 'F9hnubP4mexPogIFBVEsFHIVpUpC6JxO'

# Connect to the database
INIT_DATABASE_PATH = os.path.join(basedir, 'database/init_database.db')
DATABASE_PATH = os.path.join(basedir, 'database/dev_database.db')
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + DATABASE_PATH

SESSION_PERMANENT = True
SESSION_TYPE = 'sqlalchemy'
PERMANENT_SESSION_LIFETIME = datetime.timedelta(hours=2)
SMALL_FILE_SIZE_LIMIT = 20 * 1000  # 1 000 = 1ko
FILE_SIZE_LIMIT = 5 * 1000 * 1000  # 1 000 000 = 1Mo
