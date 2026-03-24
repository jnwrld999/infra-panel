import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from backend.discord_bot.bot import run
if __name__ == "__main__":
    run()
