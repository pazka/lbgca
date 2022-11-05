from flask import session, jsonify, json
from flask_session import Session

from app.models import User, db, Order, to_json_obj
from app.utils import hash_password, ClientKnownError, success_response, check_static_folder_exist

sess = Session()
nb_sess = 0


def init_services(app):
    global sess
    check_static_folder_exist()
    sess.init_app(app)


def check_session():
    if 'connected' not in session:
        raise ClientKnownError('User is not connected')


def check_role(role):
    if role not in session['role']:
        raise ClientKnownError('User is not ' + role)


def create_account_if_not_exist(login, password):
    if User.query.filter_by(username=login).first() is not None:
        return False

    me = User(username=login, password=hash_password(password))
    db.session.add(me)
    db.session.commit()
    return True


def create_account(login, password):
    if User.query.filter_by(username=login).first() is not None:
        raise ClientKnownError("User already exist")

    me = User(username=login, password=hash_password(password))
    db.session.add(me)
    db.session.commit()
    return success_response()


def edit_account(user_edited):
    user = User.query.filter_by(id=session['userid']).first()
    if user is None:
        raise ClientKnownError("User dosen't exist")

    if user_edited['avatar'] is not None:
        user.avatar = str.encode(user_edited['avatar'])
    if user_edited['comment'] is not None:
        user.comment = str.encode(user_edited['comment'])
    db.session.commit()
    return user.as_dict()


def fetch_session_nb():
    result = db.engine.execute("select COUNT(*) FROM sessions")
    names = [row[0] for row in result]
    return names


def fetch_session():
    return to_json_obj(session)


def create_session(login, password):
    user = User.query.filter_by(username=login, password=hash_password(password)).first()
    if user is None:
        raise ClientKnownError("User not found")

    session['connected'] = True
    session['userid'] = user.id
    session['username'] = user.username
    session['role'] = user.role
    return session


def remove_session():
    session['connected'] = False
    session['userid'] = None
    return success_response()


def fetch_user(name):
    user = User.query.filter_by(username=name).first()
    if user is None:
        raise ClientKnownError("No user found")

    return success_response(user.as_dict())


def fetch_current_user():
    user = User.query.filter_by(id=session['userid']).first()
    if user is None:
        raise ClientKnownError("No user found")

    return success_response(user.as_dict())


def create_order(product, amount, variant):
    user = User.query.filter_by(id=session['userid']).first()
    if user is None:
        raise ClientKnownError("No user found")

    order = Order(product=product, amount=amount, variant=variant, user_id=session['userid'])
    db.session.add(order)
    db.session.commit()

    return success_response(order.as_dict())


def validate_order(value):
    user = User.query.filter_by(id=session['userid']).first()
    if user is None:
        raise ClientKnownError("No user found")
    orders = Order.query.filter_by(user_id=user.id).all()

    for order in orders:
        order.validated = value

    db.session.commit()
    all_orders = list(map(lambda x: x.as_dict(), orders))
    return jsonify(all_orders)


def edit_order(order_id, amount, variant):
    order = Order.query.filter_by(id=order_id)
    if order is None:
        raise ClientKnownError("No order found")
    if order.validated is False:
        raise ClientKnownError("Order is validated")

    order.amount = amount
    order.variant = variant
    db.session.commit()
    return success_response(order.as_dict())


def delete_order(order_id):
    order = Order.query.filter_by(id=order_id).first()
    if order is None:
        raise ClientKnownError("No order found")
    user = User.query.filter_by(id=session['userid']).first()
    if user is None:
        raise ClientKnownError("No user found")

    if order.user_id != session['userid']:
        raise ClientKnownError("Not your order")

    db.session.delete(order)
    return success_response()


def get_user_orders(user_id):
    user = User.query.filter_by(id=user_id).first()

    if user is None:
        raise ClientKnownError("No user found")

    all_orders = list(map(lambda x: x.as_dict(), user.orders))
    return jsonify(all_orders)


def get_orders():
    orders = Order.query.all()
    all_orders = list(map(lambda x: x.as_dict(), orders))
    return jsonify(all_orders)
