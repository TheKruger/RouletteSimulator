from app import players

def test_register_valid_name(client):
    client.emit("register_name", {"name": "Pista"})
    received = client.get_received()

    assert any(r["name"] == "name_accepted" for r in received), "Nem fogadta el a nevet"
    assert len(players) == 1
    assert list(players.values())[0]["name"] == "Pista"


def test_register_invalid_name(client):
    client.emit("register_name", {"name": ""})
    received = client.get_received()

    assert any(r["name"] == "error" for r in received), "Kellett volna hibát dobjon"
    assert len(players) == 0
