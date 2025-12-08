import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, socketio

if __name__ == "__main__":
    socketio.run(app, host="127.0.0.1", port=5001)
