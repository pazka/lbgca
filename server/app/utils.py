import inspect
import os
import uuid

from flask import jsonify

static_path = os.path.dirname(os.path.realpath(__file__)) + '/static/'


def hash_password(password):
    return password  # lol


def check_static_folder_exist():
    if not os.path.isdir(static_path):
        os.mkdir(static_path)


def get_new_file_name():
    name = str(uuid.uuid4()) + '.jpg'
    return [name, static_path + name]


class ServerKnownError(Exception):
    def __init__(self, message="Server unknown error", code=500, ex=None):
        super().__init__()
        self.code = code
        self.message = message
        self.ex = None


class ClientKnownError(Exception):
    def __init__(self, message="Client unknown error", code=400, ex=None):
        super().__init__()
        self.code = code
        self.message = message
        self.ex = None


def success_response(data=None):
    if data is not None:
        return data
    return jsonify(success=True)
