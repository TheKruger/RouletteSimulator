from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import random, threading, time

app = Flask(__name__)
app.config["SECRET_KEY"] = "secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

players = {}
bets = {}
round_active = False

# Valódi roulette kerék számai
numbers = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
colors = ["green","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black","red","black"]

def game_loop():
    global round_active, bets
    while True:
        round_active = True
        socketio.emit("round_status", {"status":"open"})
        print("[INFO] Betting opened")
        countdown = 10
        while countdown>0:
            socketio.emit("countdown", {"seconds":countdown})
            countdown -= 1
            time.sleep(1)

        round_active = False
        print("[INFO] Betting closed")
        winning_number = random.choice(numbers)
        winning_color = colors[numbers.index(winning_number)]
        print(f"[INFO] Winning number: {winning_number} ({winning_color})")
        socketio.emit("result", {"number": winning_number, "color": winning_color})

        # Eredmények feldolgozása
        for sid, player_bets in bets.items():
            for bet in player_bets:
                payout = 0
                amount = bet["amount"]
                choice = bet["choice"]
                btype = bet["type"]

                if btype=="color" and choice==winning_color:
                    payout = amount*2
                elif btype=="parity" and ((winning_number%2==0) == (choice=="even")):
                    payout = amount*2
                elif btype=="range" and ((1<=winning_number<=18)==(choice=="low")):
                    payout = amount*2
                elif btype=="number" and choice==winning_number:
                    payout = amount*35

                players[sid]["balance"] += payout

            if players[sid]["balance"]<=0:
                players[sid]["balance"]=1000

        bets.clear()
        socketio.emit("update_players", players)
        time.sleep(5)

@app.route("/")
def index():
    return render_template("index.html")

@socketio.on("connect")
def connect():
    sid = request.sid
    players[sid] = {"name": f"Player-{sid[:4]}", "balance":1000}
    print(f"[INFO] {players[sid]['name']} connected")
    emit("update_players", players, broadcast=True)

@socketio.on("place_bet")
def place_bet(data):
    sid = request.sid
    global round_active

    if not round_active:
        emit("error", {"message":"Betting closed"})
        return

    amount = int(data["amount"])
    btype = data["type"]
    choice = data["choice"]

    if players[sid]["balance"]>=amount:
        bet = {"type":btype,"choice":choice,"amount":amount}
        bets.setdefault(sid,[]).append(bet)
        players[sid]["balance"] -= amount
        print(f"[BET] {players[sid]['name']} bet {amount} on {btype}={choice}")
        emit("bet_placed", {"player":players[sid]["name"], **data}, broadcast=True)
        emit("update_players", players, broadcast=True)
    else:
        emit("error", {"message":"Not enough balance"})

@socketio.on("disconnect")
def disconnect():
    sid = request.sid
    if sid in players:
        print(f"[INFO] {players[sid]['name']} disconnected")
        players.pop(sid)
    if sid in bets:
        bets.pop(sid)
    emit("update_players", players, broadcast=True)

if __name__=="__main__":
    threading.Thread(target=game_loop, daemon=True).start()
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
