import json
import logging

from flask import Flask, request, Response, send_from_directory
from flask_cors import CORS

from models import init_db, prepare_db
from services import init_services, create_account, create_session, remove_session, fetch_session, check_session, \
    fetch_current_user, fetch_user, fetch_session_nb, edit_account, create_order, get_user_orders, get_orders, \
    validate_order, edit_order, create_account_if_not_exist
from utils import ServerKnownError, ClientKnownError

logging.getLogger('flask_cors').level = logging.DEBUG

app = Flask(__name__)
app.config.from_object('config')
cors = CORS(app, resources={
    "*": {
        "origins": "*"
    }
}, supports_credentials=True)

prepare_db(app)
init_services(app)
init_db(app)


def handle_errors(e):
    response = Response()
    response.data = json.dumps({
        "code": e.code,
        "name": type(e).__name__,
        "error": e.message,
    })
    response.content_type = "application/json"
    response.status_code = e.code
    return response


app.register_error_handler(ServerKnownError, handle_errors)
app.register_error_handler(ClientKnownError, handle_errors)
app.register_error_handler(404, lambda e: handle_errors(ServerKnownError("Resource not found", code=404, ex=e)))
if not app.config['DEBUG']:
    app.register_error_handler(Exception, lambda e: handle_errors(ServerKnownError(str(e), ex=e)))


@app.route("/static")
def static_files(path):
    return send_from_directory('static', path)


@app.route("/")
def test():
    return "The app is running ! " + str(fetch_session_nb()) + " connected !"


@app.route("/signup", methods=['POST'])
def signup():
    return create_account(request.json['login'], request.json['password'])


@app.route("/session", methods=['GET', 'POST', 'DELETE'])
def session():
    if request.method == 'POST':
        create_account_if_not_exist(request.json['login'], request.json['password'])
        return create_session(request.json['login'], request.json['password'])
    elif request.method == 'DELETE':
        return remove_session()
    elif request.method == 'GET':
        return fetch_session()


################ USER PROFILE ################


@app.route("/user/<string:name>", methods=['GET'])
def get_user(name):
    return fetch_user(name)


@app.route("/user", methods=['GET'])
def get_current_user():
    check_session()
    return fetch_current_user()


@app.route("/user", methods=['POST'])
def edit_user():
    check_session()
    return edit_account(request.json)


################ ORDER ################

@app.route("/order", methods=["POST"])
def post_create_order():
    return create_order(request.json['product'], request.json['amount'], request.json['variant'])


@app.route("/order/<int:order_id>", methods=["POST"])
def post_edit_order(order_id):
    return edit_order(order_id, request.json['amount'], request.json['variant'])


@app.route("/order/<int:order_id>/confirm", methods=["POST"])
def confirm_order(order_id):
    return validate_order(order_id, request.json['value'])


@app.route("/orders", methods=["GET"])
def fetch_orders():
    return get_orders()


@app.route("/user/<int:user_id>/orders", methods=["GET"])
def fetch_users_orders(user_id):
    return get_user_orders(user_id)


app.run(app.config['HOST'], app.config['PORT'], app.config)
