import datetime
import json
import shutil
from os import path

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
my_app = None


def prepare_db(app):
    global my_app
    if path.exists(app.config['DATABASE_PATH']) is False:
        shutil.copyfile(app.config['INIT_DATABASE_PATH'], app.config['DATABASE_PATH'])
    my_app = app
    app.config['SESSION_SQLALCHEMY'] = db
    db.init_app(app)


def init_db(app):
    with app.app_context():
        db.create_all()


def get_context():
    return my_app.app_context()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(30), unique=True, nullable=False)
    password = db.Column(db.Text, nullable=False)
    avatar = db.Column(db.LargeBinary(), nullable=True)
    role = db.Column(db.Text, default="user", nullable=False)
    basket = db.relationship('Order')
    comment = db.Column(db.String(1500), nullable=True)

    def as_dict(self, includes=None):
        res = to_json(self, includes)
        del res['password']
        return res


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product = db.Column(db.String(80), unique=False, nullable=False)
    amount = db.Column(db.Integer, default=1)
    variant = db.Column(db.String(100), nullable=False)
    validated = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship("User", back_populates="basket")

    def as_dict(self, includes=None):
        res = to_json(self, includes)
        res['user'] = self.user.as_dict()
        return res


ALL_MODELS = [User, Order]


def is_model(obj):
    for model in ALL_MODELS:
        if isinstance(obj, model):
            return True

    return False


def to_json(obj, includes=None):
    if includes is None:
        includes = []
    res = {}

    fields = []
    for col in obj.__table__.columns:
        fields.append(col.name)
    for incl in includes:
        fields.append(incl)

    for field in fields:
        if is_model(getattr(obj, field)):
            res[field] = getattr(obj, field).as_dict()
        elif isinstance(getattr(obj, field), bytes):
            res[field] = getattr(obj, field).decode('utf-8')
        else:
            res[field] = getattr(obj, field)

    return res


def to_json_obj(obj):
    return json.dumps(obj, default=lambda o: o.__dict__,
                      sort_keys=True, indent=4)
