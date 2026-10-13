"""Local checks only; no Azure calls or live database tests."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
COMMANDS = {
    "eslint": ["npm", "--prefix", str(ROOT / "web-ui"), "run", "lint"],
    "build": ["npm", "--prefix", str(ROOT / "web-ui"), "run", "build"],
    "pytest": [str(PYTHON), "-m", "pytest", "-q"],
}
if __name__ == "__main__":
    if sys.argv[1] == "pytest" and not PYTHON.exists():
        raise SystemExit("Create .venv and install pricing-microservice/requirements-dev.txt first")
    raise SystemExit(subprocess.call(COMMANDS[sys.argv[1]], cwd=ROOT))
