from app import players, bets

def test_cancel_bet(client, monkeypatch):
    monkeypatch.setattr("app.round_active", True)

    client.emit("register_name", {"name": "Józsi"})
    client.get_received()

    sid = list(players.keys())[0]

    # Leraksz egy tétet, bazdmeg
    client.emit("place_bet", {"type": "color", "choice": "red", "amount": 200})
    client.get_received()

    assert bets[sid][0]["amount"] == 200

    # Tét törlése
    client.emit("cancel_bet", {"type": "color", "choice": "red"})
    client.get_received()

    assert bets[sid] == [], "Nem törölte a tétet"
    assert players[sid]["balance"] == 10000, "Nem kapta vissza a pénzét"
