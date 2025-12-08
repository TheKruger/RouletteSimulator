
def test_register_valid_name(sio):
    sio.emit("register_name", {"name": "TesztElek"})
    received = sio.get_received()

    # Ellenőrizzük, hogy name_accepted event érkezett
    assert any(
        msg["name"] == "name_accepted"
        for msg in received
    )


def test_register_empty_name_error(sio):
    sio.emit("register_name", {"name": ""})
    received = sio.get_received()

    assert any(
        msg["name"] == "error"
        and msg["args"][0]["message"] == "Érvényes nevet adj meg!"
        for msg in received
    )


def test_players_dict_updates(sio):
    from app import players
    sio.emit("register_name", {"name": "Bela"})
    sid = sid = next(iter(players.keys()))

    assert sid in players
    assert players[sid]["name"] == "Bela"
