"""
Rulettjáték Szerver
===================

Ez a modul egy Flask + Socket.IO alapú többjátékos rulett szervert valósít meg.
A szerver kezeli a játékosokat, a téteket, a játékkörök állapotát és a nyeremények kifizetését.

A dokumentáció automatikusan generálható Sphinx segítségével.
"""

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random
import threading
import time

# Flask alkalmazás és Socket.IO inicializálása
app = Flask(__name__)
app.config["SECRET_KEY"] = "secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Játékosok és fogadások tárolása
players = {}
bets = {}
round_active = False

# Rulett kerék számai
numbers = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,
           10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]


def get_color_for_number(n):
    """
    Meghatározza, hogy a megadott rulettszám milyen színű.

    Args:
        n (int): A vizsgált szám.

    Returns:
        str: 'green', 'red' vagy 'black'.
    """
    if n == 0:
        return "green"
    red_numbers = [1,3,5,7,9,12,14,16,18,21,23,25,27,28,30,32,34,36]
    return "red" if n in red_numbers else "black"


# A rulett kerék színeinek listája a számok sorrendjében
colors = [get_color_for_number(n) for n in numbers]


def game_loop():
    """
    A szerver folyamatosan futó játékmenetét vezérli.

    A folyamat:
        1. Várakozás legalább egy játékosra
        2. Tétleadási szakasz elindítása és visszaszámlálás
        3. Tétleadás lezárása
        4. Pörgetés animáció indítása a klienseken
        5. Nyerőszám kiválasztása és kiküldése
        6. Nyeremények kiszámítása és kifizetése
        7. Játékoslista frissítése

    A függvény végtelen ciklusban fut egy külön threadben.

    Returns:
        None
    """
    global round_active, bets

    while True:

        # 1. Várakozás legalább egy játékosra
        while len(players) == 0:
            time.sleep(1)

        # 2. Tétleadás megnyitása 10 másodpercre
        round_active = True
        socketio.emit("round_status", {"status": "open"})
        countdown = 10

        while countdown > 0:
            socketio.emit("countdown", {"seconds": countdown})
            countdown -= 1
            time.sleep(1)

        # 3. Tétleadás lezárása
        round_active = False
        socketio.emit("round_status", {"status": "closed"})

        # 4. Pörgetés indítása
        socketio.emit("spinning_start", {})
        time.sleep(2)

        # 5. Nyerőszám kiválasztása
        winning_number = 23  # Itt random is lehetne
        winning_color = colors[numbers.index(winning_number)]

        socketio.emit("result", {
            "number": winning_number,
            "color": winning_color
        })

        # 6. Nyeremények kifizetése
        for sid, player_bets in bets.items():
            for bet in player_bets:
                amount = bet["amount"]
                choice = bet["choice"]
                btype = bet["type"]
                payout = 0

                # --- Fogadási típusok és kifizetések ---
                if btype == "color" and choice == winning_color:
                    payout = amount * 2
                elif btype == "parity" and ((winning_number % 2 == 0) == (choice == "even")):
                    payout = amount * 2
                elif btype == "range" and ((1 <= winning_number <= 18) == (choice == "low")):
                    payout = amount * 2
                elif btype == "dozen" and (
                    (choice == "1st" and 1 <= winning_number <= 12) or
                    (choice == "2nd" and 13 <= winning_number <= 24) or
                    (choice == "3rd" and 25 <= winning_number <= 36)
                ):
                    payout = amount * 3
                elif btype == "column" and (
                    (choice == 1 and winning_number % 3 == 0) or
                    (choice == 2 and winning_number % 3 == 2) or
                    (choice == 3 and winning_number % 3 == 1)
                ):
                    payout = amount * 3
                elif btype == "number" and choice == winning_number:
                    payout = amount * 36
                elif btype in ("street", "split", "corner") and winning_number in choice:
                    # Kettő szám (street/split): 17:1 → kifizetés *18
                    # Négy szám (corner): 8:1 → kifizetés *9
                    payout = amount * (18 if btype in ("street", "split") else 9)

                players[sid]["balance"] += payout

            # Ha a játékos pénze elfogy, kap új egyenleget
            if players[sid]["balance"] <= 0:
                players[sid]["balance"] = 10000

        # Fogadások törlése a következő körre
        bets.clear()

        # 7. Játékos frissítés kiküldése
        socketio.emit("update_players", players)
        time.sleep(10)


@app.route("/")
def index():
    """
    A főoldalt szolgálja ki.

    Returns:
        Response: A renderelt index.html sablon.
    """
    return render_template("index.html")


@socketio.on("connect")
def connect():
    """
    Új kliens csatlakozásakor fut le.

    Jelenleg nem végez külön műveletet.

    Returns:
        None
    """
    pass


@socketio.on("register_name")
def register_name(data):
    """
    Regisztrálja a játékos nevét és hozzáadja a játékoslistához.

    Args:
        data (dict): A kliens által küldött adat, tartalmazza a nevet.

    Emits:
        name_accepted: Sikeres regisztráció
        update_players: Játékoslista frissítése
    """
    sid = request.sid
    name = data.get("name", "").strip()

    if not name:
        emit("error", {"message": "Érvényes nevet adj meg!"})
        return

    players[sid] = {"name": name, "balance": 10000}

    emit("name_accepted", {"message": "Sikeres regisztráció!"})
    emit("update_players", players, broadcast=True)


@socketio.on("place_bet")
def place_bet(data):
    """
    Kezeli a játékos tétleadását.

    Args:
        data (dict): Fogadás típusa, választása és összege.

    Emits:
        error: Hibás tét
        bet_placed: Tét elfogadva
        update_players: Játékoslista frissítve
    """
    sid = request.sid

    if sid not in players:
        emit("error", {"message": "Először add meg a neved!"})
        return

    if not round_active:
        emit("error", {"message": "A tétleadás lezárva!"})
        return

    amount = int(data["amount"])
    btype = data["type"]
    choice = data["choice"]

    if players[sid]["balance"] >= amount:
        bet = {"type": btype, "choice": choice, "amount": amount}
        bets.setdefault(sid, []).append(bet)
        players[sid]["balance"] -= amount

        emit("bet_placed", {"player": players[sid]["name"], **data}, broadcast=True)
        emit("update_players", players, broadcast=True)
    else:
        emit("error", {"message": "Nincs elég pénzed!"})


@socketio.on("disconnect")
def disconnect():
    """
    Kezeli a játékos kilépését.

    - Törli a játékost
    - Törli a fogadásait
    - Frissíti a játékoslistát

    Returns:
        None
    """
    sid = request.sid
    if sid in players:
        players.pop(sid)
    if sid in bets:
        bets.pop(sid)

    emit("update_players", players, broadcast=True)


@socketio.on("result")
def result_broadcast(data):
    """
    A pörgetés eredményét továbbítja a kliensek felé,
    majd 6 másodperc múlva kifizeti a nyereményeket.

    Args:
        data (dict): number, color

    Emits:
        result: A nyertes szám
        update_players: Pénzek frissítése
        spin_complete: Golyó megállt jelzés
    """
    winning_number = data["number"]
    winning_color = data["color"]

    emit("result", data, broadcast=True)

    # Várjuk meg a kliens animációját
    time.sleep(6)

    # Kifizetés ugyanaz, mint game_loop-ban
    for sid, player_bets in bets.items():
        for bet in player_bets:
            amount = bet["amount"]
            choice = bet["choice"]
            btype = bet["type"]
            payout = 0

            if btype == "color" and choice == winning_color:
                payout = amount * 2
            elif btype == "parity" and ((winning_number % 2 == 0) == (choice == "even")):
                payout = amount * 2
            elif btype == "range" and ((1 <= winning_number <= 18) == (choice == "low")):
                payout = amount * 2
            elif btype == "dozen" and (
                (choice == "1st" and 1 <= winning_number <= 12) or
                (choice == "2nd" and 13 <= winning_number <= 24) or
                (choice == "3rd" and 25 <= winning_number <= 36)
            ):
                payout = amount * 3
            elif btype == "column" and (
                (choice == 1 and winning_number % 3 == 0) or
                (choice == 2 and winning_number % 3 == 2) or
                (choice == 3 and winning_number % 3 == 1)
            ):
                payout = amount * 3
            elif btype == "number" and choice == winning_number:
                payout = amount * 35
            elif btype in ("street", "split", "corner") and winning_number in choice:
                payout = amount * (18 if btype in ("street", "split") else 9)

            players[sid]["balance"] += payout

        if players[sid]["balance"] <= 0:
            players[sid]["balance"] = 10000

    bets.clear()

    emit("update_players", players, broadcast=True)

    emit("spin_complete", {
        "message": f"Golyó megállt: {winning_number} ({winning_color})",
        "number": winning_number,
        "color": winning_color
    }, broadcast=True)


@socketio.on("cancel_bet")
def cancel_bet(data):
    """
    Kezeli a tét törlését és visszatéríti az összeget.

    Args:
        data (dict): A törlendő tét típusa és választása.

    Returns:
        None
    """
    sid = request.sid
    if sid in bets:
        amount_to_return = 0
        for bet in bets[sid]:
            if bet["type"] == data["type"] and str(bet["choice"]) == str(data["choice"]):
                amount_to_return += bet["amount"]

        players[sid]["balance"] += amount_to_return
        bets[sid] = [
            b for b in bets[sid]
            if not (b["type"] == data["type"] and str(b["choice"]) == str(data["choice"]))
        ]

        emit("update_players", players, broadcast=True)


if __name__ == "__main__":
    """
    A szerver indítása és a játékmenet külön threadben futtatása.
    """
    threading.Thread(target=game_loop, daemon=True).start()
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
