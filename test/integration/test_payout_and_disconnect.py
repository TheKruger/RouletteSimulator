
def test_payout_logic(sio):
    # regisztráció
    sio.emit("register_name", {"name": "Marci"})
    sio.get_received()

    from app import players, bets, colors, numbers

    sid = next(iter(players.keys()))

    # állapot beállítása
    players[sid]["balance"] = 1000
    bets[sid] = [{"type": "color", "choice": "red", "amount": 100}]

    winning_number = 23
    winning_color = colors[numbers.index(winning_number)]

    # mockolt eredmény kiküldése
    sio.emit("result", {
        "number": winning_number,
        "color": winning_color
    })

    # a szerver 6 másodpercet vár normál esetben, de a test-client nem alszik → azonnal elvégzi

    # ellenőrizzük, hogy változott-e az egyenleg
    assert players[sid]["balance"] != 1000


def test_disconnect_removes_player(sio):
    from app import players, bets

    sio.emit("register_name", {"name": "Laci"})
    sid = next(iter(players.keys()))

    assert sid in players

    # disconnect
    sio.disconnect()

    assert sid not in players
    assert sid not in bets