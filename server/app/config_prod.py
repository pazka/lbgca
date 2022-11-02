import os

# Grabs the folder where the script runs.
basedir = os.path.abspath(os.path.dirname(__file__))

# Enable debug mode.
DEBUG = False

# Enable debug mode.
PORT = 80
SERVER_NAME = "0.0.0.0:" + str(PORT)
HOST = "0.0.0.0:" + str(PORT)

# Secret key for session management. You can generate random strings here:
# https://randomkeygen.com/
SECRET_KEY = 'F9hnubP4mexPogIFBVEsFHIVpUpC6JxO'

# Connect to the database
INIT_DATABASE_PATH = os.path.join(basedir, 'database/init_database.db')
DATABASE_PATH = os.path.join(basedir, 'database/database.db')
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + DATABASE_PATH

SESSION_PERMANENT = False
SESSION_TYPE = 'sqlalchemy'
PERMANENT_SESSION_LIFETIME = 60 * 60

SMALL_FILE_SIZE_LIMIT = 20 * 1000  # 1 000 = 1ko
FILE_SIZE_LIMIT = 1 * 1000 * 1000  # 1 000 000 = 1Mo
