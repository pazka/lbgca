import json
import logging

from flask import Flask, request, Response
from flask_cors import CORS

import config
from models import init_db, prepare_db
from services import init_services, create_account, create_session, remove_session, fetch_session, check_session, \
    fetch_current_user, fetch_user, fetch_session_nb, edit_account, create_order, get_user_orders, get_orders, \
    validate_order, edit_order, create_account_if_not_exist, delete_order
from utils import ServerKnownError, ClientKnownError

logging.getLogger('flask_cors').level = logging.DEBUG

if config.DEBUG is False:
    print("LBGCA SERVER NO DEBUG")
else:
    print("LBGCA SERVER IS DEBUG")

app = Flask(__name__)

app.config.from_object('config')
cors = CORS(app, resources={
    "*": {
        "origins": app.config["CORS_ORIGINS"]
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


@app.route("/api/")
def test():
    return "The app is running ! " + str(fetch_session_nb()) + " connected !"


@app.route("/api/signup", methods=['POST'])
def signup():
    return create_account(request.json['login'], request.json['password'])


@app.route("/api/session", methods=['GET', 'POST', 'DELETE'])
def session():
    if request.method == 'POST':
        create_account_if_not_exist(request.json['login'], request.json['password'])
        return create_session(request.json['login'], request.json['password'])
    elif request.method == 'DELETE':
        return remove_session()
    elif request.method == 'GET':
        return fetch_session()


################ USER PROFILE ################


@app.route("/api/user/<string:name>", methods=['GET'])
def get_user(name):
    return fetch_user(name)


@app.route("/api/user", methods=['GET'])
def get_current_user():
    check_session()
    return fetch_current_user()


@app.route("/api/user", methods=['POST'])
def edit_user():
    check_session()
    return edit_account(request.json)


################ ORDER ################

@app.route("/api/order", methods=["POST"])
def post_create_order():
    return create_order(request.json['product'], request.json['amount'], request.json['variant'])


@app.route("/api/order/<int:order_id>", methods=["DELETE"])
def api_delete_order(order_id):
    check_session()
    return delete_order(order_id)


@app.route("/api/order/<int:order_id>", methods=["POST"])
def post_edit_order(order_id):
    return edit_order(order_id, request.json['amount'], request.json['variant'])


@app.route("/api/order/validate", methods=["POST"])
def confirm_order():
    return validate_order(request.json['value'])


@app.route("/api/orders", methods=["GET"])
def fetch_orders():
    return get_orders()


@app.route("/api/user/<int:user_id>/orders", methods=["GET"])
def fetch_users_orders(user_id):
    return get_user_orders(user_id)


if __name__ == "__main__":
    print("## DEBUG SERVER START")
    # Only for debugging while developing
    app.run(app.config['HOST'], app.config['PORT'], app.config)
