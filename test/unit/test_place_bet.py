from app import players, bets

def test_place_bet_success(client, monkeypatch):
    # Állítsuk be a round_active-et true-ra, te seggfej
    monkeypatch.setattr("app.round_active", True)

    client.emit("register_name", {"name": "Gizi"})
    client.get_received()

    client.emit("place_bet", {"type": "color", "choice": "red", "amount": 100})

    received = client.get_received()
    assert any(r["name"] == "bet_placed" for r in received), "Nem fogadta el a tétet"

    sid = list(players.keys())[0]
    assert bets[sid][0]["amount"] == 100


def test_place_bet_not_enough_money(client, monkeypatch):
    monkeypatch.setattr("app.round_active", True)

    client.emit("register_name", {"name": "Lajos"})
    players[list(players.keys())[0]]["balance"] = 50  # Csóró vagy, bazmeg

    client.get_received()
    client.emit("place_bet", {"type": "number", "choice": 5, "amount": 100})

    received = client.get_received()
    assert any(r["name"] == "error" for r in received), "Hiba kellett volna"
