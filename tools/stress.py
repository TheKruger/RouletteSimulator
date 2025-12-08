"""
Konfigurálható stresszteszt - config.json fájlból olvassa a beállításokat
"""

import json
import asyncio
from tools.stress_tester import StressTester

async def run_from_config(config_file="config.json"):
    """Konfigurációs fájlból futtatja a tesztet."""
    
    with open(config_file, 'r') as f:
        config = json.load(f)
    
    tester = StressTester(config.get('server_url', 'http://localhost:5000'))
    
    print(f"\nKonfiguráció betöltve: {config_file}")
    
    await tester.create_bots(
        config.get('num_bots', 10),
        config.get('ramp_up_time', 0)
    )
    
    await tester.run_test(config.get('duration', 60))
    
    tester.print_statistics()
    
    # Eredmények mentése
    if config.get('output_file'):
        stats = tester.calculate_statistics()
        with open(config.get('output_file'), 'w') as f:
            json.dump(stats, f, indent=2)
    
    await tester.cleanup()

# Példa config.json:
"""
{
    "server_url": "http://localhost:5000",
    "num_bots": 50,
    "duration": 120,
    "ramp_up_time": 10,
    "output_file": "stress_test_results.json"
}
"""