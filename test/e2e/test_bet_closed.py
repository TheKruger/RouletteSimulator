import subprocess
import time
import pytest
from playwright.sync_api import Page, expect

@pytest.fixture(scope="session", autouse=True)
def start_server():
    # elindítjuk a tesztszervert külön processzben
    p = subprocess.Popen(["python", "run_test_server.py"])
    
    # várunk hogy tényleg elinduljon
    time.sleep(2)

    yield

    # leállítjuk a szervert
    p.terminate()


def test_place_bet_when_closed(page: Page):

    page.goto("http://127.0.0.1:5001")

    # név megadása
    page.fill("#nameInput", "TesztElek")
    page.wait_for_timeout(500)
    page.click("#nameSubmit")

    # várunk, hogy a szerver regisztrálja
    page.wait_for_timeout(500)

    # megpróbálunk RED mezőre tétet rakni
    red_button = page.locator("[data-color='red']")
    red_button.click()

    # hibát várunk
    error_area = page.locator("#notifications")
    expect(error_area).to_contain_text("Jelenleg nem lehet tétet rakni!")