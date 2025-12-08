import pytest
from app import app, socketio, players, bets

@pytest.fixture
def sio():
    """
    Socket.IO test client
    A teszt előtt töröljük a memóriában lévő játékosokat és téteket.
    """
    players.clear()
    bets.clear()

    client = socketio.test_client(app)
    return client
