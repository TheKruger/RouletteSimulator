"""
Rulett szerver stresszteszter
==============================

Ez a szkript Socket.IO klienseket hoz létre, amelyek csatlakoznak a rulett szerverhez,
és különböző stratégiák szerint tesznek tétet. Méri a válaszidőket és statisztikákat
állít össze a teljesítményről.
"""

import asyncio
import socketio
import time
import statistics
from datetime import datetime
import random
import argparse
from typing import List, Dict, Tuple

class RouletteBot:
    """Egy rulett bot, amely csatlakozik a szerverhez és tesz tétet."""
    
    def __init__(self, bot_id: int, strategy: str = "random", server_url: str = "http://localhost:5000"):
        """
        Inicializál egy rulett botot.
        
        Args:
            bot_id: A bot egyedi azonosítója
            strategy: A tételési stratégia ('red', 'black', 'random')
            server_url: A szerver URL címe
        """
        self.bot_id = bot_id
        self.strategy = strategy
        self.name = f"Bot_{bot_id}_{strategy[:3]}"
        self.sio = socketio.AsyncClient()
        self.connected = False
        self.connection_time = None
        self.response_times = []  # Válaszidők tárolása
        self.server_url = server_url
        
        # Eseménykezelők regisztrálása
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('round_status', self.on_round_status)
        self.sio.on('countdown', self.on_countdown)
        self.sio.on('result', self.on_result)
        self.sio.on('update_players', self.on_update_players)
        self.sio.on('error', self.on_error)
        self.sio.on('name_accepted', self.on_name_accepted)
        self.sio.on('bet_placed', self.on_bet_placed)
        
        # Játékállapot
        self.balance = 10000
        self.round_open = False
        self.last_ping_time = None
        
    async def measure_response_time(self, event_name: str):
        """Méri az esemény válaszidejét."""
        start_time = time.time()
        def callback(*args):
            elapsed = time.time() - start_time
            self.response_times.append(elapsed)
        return callback
    
    async def on_connect(self):
        """Csatlakozás esemény."""
        print(f"[{self.bot_id}] Csatlakozva")
        self.connected = True
        self.connection_time = time.time()
        
        # Név regisztrálása
        await self.sio.emit('register_name', {'name': self.name})
    
    async def on_disconnect(self):
        """Lecsatlakozás esemény."""
        # print(f"[{self.bot_id}] Lecsatlakozva")
        self.connected = False
    
    async def on_name_accepted(self, data):
        """Név elfogadva esemény."""
        print(f"[{self.bot_id}] Név elfogadva: {self.name}")
    
    async def on_round_status(self, data):
        """Kör státusz változás."""
        self.round_open = (data['status'] == 'open')
        print(f"[{self.bot_id}] Kör státusz: {data['status']}")
        
        if self.round_open:
            # Tétel a kör megnyitásakor
            await self.place_bet()
    
    async def on_countdown(self, data):
        """Visszaszámlálás."""
        seconds = data['seconds']
        if seconds <= 2 and self.round_open:  # Utolsó pillanatban teszünk
            await self.place_bet()
    
    async def on_result(self, data):
        """Eredmény kihirdetése."""
        print(f"[{self.bot_id}] Nyertes szám: {data['number']} ({data['color']})")
    
    async def on_update_players(self, data):
        """Játékoslista frissítés."""
        # Frissítsük az egyenlegünket, ha benne vagyunk a listában
        if self.sio.sid in data:
            self.balance = data[self.sio.sid]['balance']
    
    async def on_error(self, data):
        """Hiba esemény."""
        print(f"[{self.bot_id}] Hiba: {data['message']}")
    
    async def on_bet_placed(self, data):
        """Másik játékos tétje."""
        pass
    
    async def place_bet(self):
        """Tétel a kiválasztott stratégia alapján."""
        if not self.round_open:
            return
        
        # Tét összege (véletlenszerű, de max az egyenleg 10%-a)
        max_bet = min(1000, self.balance // 10)
        amount = random.randint(10, max_bet) if max_bet > 10 else self.balance
        
        # Stratégia alapján választás
        if self.strategy == "red":
            choice = "red"
        elif self.strategy == "black":
            choice = "black"
        else:  # random
            choice = random.choice(["red", "black"])
        
        # Tétel méréssel
        start_time = time.time()
        try:
            await self.sio.emit('place_bet', {
                'type': 'color',
                'choice': choice,
                'amount': amount
            })
            elapsed = time.time() - start_time
            self.response_times.append(elapsed)
            print(f"[{self.bot_id}] Tét: {amount} a(z) {choice} színre, válaszidő: {elapsed:.3f}s")
        except Exception as e:
            print(f"[{self.bot_id}] Tétel hiba: {e}")
    
    async def connect(self):
        """Csatlakozás a szerverhez."""
        try:
            start_time = time.time()
            await self.sio.connect(self.server_url)
            elapsed = time.time() - start_time
            self.response_times.append(elapsed)
            return True
        except Exception as e:
            print(f"[{self.bot_id}] Csatlakozási hiba: {e}")
            return False
    
    async def disconnect(self):
        """Lecsatlakozás."""
        if self.connected:
            await self.sio.disconnect()
    
    def get_stats(self) -> Dict:
        """Visszaadja a bot statisztikáit."""
        if not self.response_times:
            return {
                'bot_id': self.bot_id,
                'strategy': self.strategy,
                'response_count': 0,
                'min': 0,
                'max': 0,
                'avg': 0,
                'median': 0
            }
        
        return {
            'bot_id': self.bot_id,
            'strategy': self.strategy,
            'response_count': len(self.response_times),
            'min': min(self.response_times),
            'max': max(self.response_times),
            'avg': statistics.mean(self.response_times),
            'median': statistics.median(self.response_times)
        }


class StressTester:
    """A stresszteszt koordináló osztály."""
    
    def __init__(self, server_url: str = "http://localhost:5000"):
        """
        Inicializál egy stresszteszt koordinátort.
        
        Args:
            server_url: A szerver URL címe
        """
        self.server_url = server_url
        self.bots = []
        self.start_time = None
        self.end_time = None
    
    async def create_bots(self, num_bots: int, ramp_up_time: float = 0):
        """
        Létrehozza és csatlakoztatja a botokat.
        
        Args:
            num_bots: Botok száma
            ramp_up_time: Másodperc, amennyi alatt minden bot csatlakozzon
        """
        print(f"\n=== {num_bots} bot létrehozása és csatlakoztatása ===")
        
        # Stratégiák eloszlása
        strategies = []
        for i in range(num_bots):
            if i % 3 == 0:
                strategies.append("red")
            elif i % 3 == 1:
                strategies.append("black")
            else:
                strategies.append("random")
        
        # Botok létrehozása
        self.bots = []
        for i in range(num_bots):
            bot = RouletteBot(i, strategies[i], self.server_url)
            self.bots.append(bot)
        
        # Ramp-up csatlakoztatás
        if ramp_up_time > 0:
            delay = ramp_up_time / num_bots
            for i, bot in enumerate(self.bots):
                print(f"Bot {i} csatlakoztatása...")
                await bot.connect()
                if i < len(self.bots) - 1:
                    await asyncio.sleep(delay)
        else:
            # Párhuzamos csatlakoztatás
            connect_tasks = [bot.connect() for bot in self.bots]
            await asyncio.gather(*connect_tasks, return_exceptions=True)
    
    async def run_test(self, duration: float):
        """
        Futtatja a tesztet a megadott időtartamban.
        
        Args:
            duration: A teszt időtartama másodpercben
        """
        print(f"\n=== Teszt futtatása {duration} másodpercig ===")
        self.start_time = time.time()
        
        try:
            await asyncio.sleep(duration)
        except KeyboardInterrupt:
            print("\nTeszt megszakítva")
        
        self.end_time = time.time()
    
    async def cleanup(self):
        """Lecsatlakoztatja a botokat."""
        # print(f"\n=== Botok lecsatlakoztatása ===")
        disconnect_tasks = [bot.disconnect() for bot in self.bots]
        await asyncio.gather(*disconnect_tasks, return_exceptions=True)
    
    def calculate_statistics(self) -> Dict:
        """Kiszámolja az összesített statisztikákat."""
        all_response_times = []
        for bot in self.bots:
            all_response_times.extend(bot.response_times)
        
        if not all_response_times:
            return {
                'total_requests': 0,
                'min_response': 0,
                'max_response': 0,
                'avg_response': 0,
                'median_response': 0,
                'bot_count': len(self.bots),
                'test_duration': self.end_time - self.start_time if self.end_time and self.start_time else 0
            }
        
        return {
            'total_requests': len(all_response_times),
            'min_response': min(all_response_times),
            'max_response': max(all_response_times),
            'avg_response': statistics.mean(all_response_times),
            'median_response': statistics.median(all_response_times),
            'bot_count': len(self.bots),
            'test_duration': self.end_time - self.start_time if self.end_time and self.start_time else 0,
            'requests_per_second': len(all_response_times) / (self.end_time - self.start_time) if self.end_time and self.start_time else 0
        }
    
    def print_statistics(self):
        """Kiírja a statisztikákat."""
        stats = self.calculate_statistics()
        bot_stats = [bot.get_stats() for bot in self.bots]
        
        print("\n" + "="*60)
        print("STRESSZTESZT EREDMÉNYEK")
        print("="*60)
        
        print(f"\nÖsszesített eredmények:")
        print(f"  Botok száma: {stats['bot_count']}")
        print(f"  Teszt időtartama: {stats['test_duration']:.2f} másodperc")
        print(f"  Összes kérés: {stats['total_requests']}")
        print(f"  Kérelmek másodpercenként: {stats['requests_per_second']:.2f}")
        print(f"  Minimális válaszidő: {stats['min_response']:.4f} másodperc")
        print(f"  Maximális válaszidő: {stats['max_response']:.4f} másodperc")
        print(f"  Átlagos válaszidő: {stats['avg_response']:.4f} másodperc")
        print(f"  Medián válaszidő: {stats['median_response']:.4f} másodperc")
        
        print(f"\nBot-onkénti statisztikák:")
        for bot_stat in bot_stats:
            if bot_stat['response_count'] > 0:
                print(f"  Bot {bot_stat['bot_id']} ({bot_stat['strategy']}): "
                      f"{bot_stat['response_count']} kérés, "
                      f"átlag: {bot_stat['avg']:.4f}s, "
                      f"min: {bot_stat['min']:.4f}s, "
                      f"max: {bot_stat['max']:.4f}s")
        
        # Stratégia szerinti csoportosítás
        strategies = {}
        for bot in self.bots:
            strat = bot.strategy
            if strat not in strategies:
                strategies[strat] = []
            strategies[strat].extend(bot.response_times)
        
        print(f"\nStratégia szerinti statisztikák:")
        for strategy, times in strategies.items():
            if times:
                print(f"  {strategy.capitalize()}: {len(times)} kérés, "
                      f"átlag: {statistics.mean(times):.4f}s, "
                      f"min: {min(times):.4f}s, "
                      f"max: {max(times):.4f}s")


async def main():
    """Főprogram."""
    parser = argparse.ArgumentParser(description='Rulett szerver stresszteszt')
    parser.add_argument('--url', type=str, default='http://localhost:5000',
                       help='Szerver URL (alapértelmezett: http://localhost:5000)')
    parser.add_argument('--bots', type=int, default=10,
                       help='Botok száma (alapértelmezett: 10)')
    parser.add_argument('--duration', type=float, default=60,
                       help='Teszt időtartama másodpercben (alapértelmezett: 60)')
    parser.add_argument('--ramp-up', type=float, default=0,
                       help='Ramp-up idő másodpercben (alapértelmezett: 0 - azonnal)')
    parser.add_argument('--output', type=str,
                       help='Eredmények mentése fájlba (opcionális)')
    
    args = parser.parse_args()
    
    print(f"\nRulett Szerver Stresszteszt")
    print(f"Szerver: {args.url}")
    print(f"Botok: {args.bots}")
    print(f"Időtartam: {args.duration} másodperc")
    print(f"Ramp-up: {args.ramp_up} másodperc")
    
    tester = StressTester(args.url)
    
    try:
        # Botok létrehozása és csatlakoztatása
        await tester.create_bots(args.bots, args.ramp_up)
        
        # Teszt futtatása
        await tester.run_test(args.duration)
        
        # Statisztikák kiírása
        tester.print_statistics()
        
        # Eredmények mentése fájlba, ha kérték
        if args.output:
            import json
            stats = tester.calculate_statistics()
            with open(args.output, 'w') as f:
                json.dump(stats, f, indent=2)
            print(f"\nEredmények elmentve: {args.output}")
    
    except KeyboardInterrupt:
        print("\nTeszt megszakítva")
    except Exception as e:
        print(f"\nHiba történt: {e}")
    finally:
        # Botok lecsatlakoztatása
        await tester.cleanup()


if __name__ == "__main__":
    # Aszinkron főprogram futtatása
    asyncio.run(main())