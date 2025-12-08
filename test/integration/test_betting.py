from app import players, bets, round_active

def test_bet_closed_round(sio):
    # regisztráció
    sio.emit("register_name", {"name": "Peti"})
    sio.get_received()

    # kör zárva
    import app
    app.round_active = False

    sio.emit("place_bet", {
        "type": "color",
        "choice": "red",
        "amount": 100
    })

    received = sio.get_received()

    assert any(
        msg["name"] == "error"
        and msg["args"][0]["message"] == "A tétleadás lezárva!"
        for msg in received
    )


def test_bet_success_and_balance_change(sio):
    # regisztráció
    sio.emit("register_name", {"name": "Jani"})
    sio.get_received()

    # kör nyitva
    import app
    app.round_active = True

    from app import players
    sid = next(iter(players.keys()))

    initial_balance = players[sid]["balance"]

    sio.emit("place_bet", {
        "type": "color",
        "choice": "black",
        "amount": 200
    })

    received = sio.get_received()

    # bet_placed event érkezett?
    assert any(msg["name"] == "bet_placed" for msg in received)

    # levonás történt?
    assert players[sid]["balance"] == initial_balance - 200


def test_bet_not_enough_money(sio):
    sio.emit("register_name", {"name": "Gizi"})
    sio.get_received()

    import app
    app.round_active = True

    from app import players
    sid = next(iter(players.keys()))

    # 10000 helyett adjunk kevesebbet
    players[sid]["balance"] = 50

    sio.emit("place_bet", {
        "type": "color",
        "choice": "red",
        "amount": 200
    })

    received = sio.get_received()

    assert any(
        msg["name"] == "error"
        and msg["args"][0]["message"] == "Nincs elég pénzed!"
        for msg in received
    )
