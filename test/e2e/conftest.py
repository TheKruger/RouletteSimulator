import subprocess
import time
import pytest

@pytest.fixture(scope="session", autouse=True)
def start_server():
    # Indítjuk a teszt szervert
    p = subprocess.Popen(["python", "run_test_server.py"])

    # Várjuk, hogy felálljon
    time.sleep(5)

    yield

    # Teszt végén leállítjuk
    p.terminate()