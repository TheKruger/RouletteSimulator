import pytest
from app import app, socketio, players, bets

@pytest.fixture
def client():
    # Minden teszt előtt nullázzuk az állapotot te fasz
    players.clear()
    bets.clear()

    test_client = socketio.test_client(app)
    yield test_client
    test_client.disconnect()
