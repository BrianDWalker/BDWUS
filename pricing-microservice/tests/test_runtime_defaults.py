import os
import subprocess
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[1]


def startup(**overrides):
    env = {k: v for k, v in os.environ.items() if k not in {"CONTAINER_APP_NAME", "CONTAINER_APP_REVISION", "WEBSITE_INSTANCE_ID", "IDENTITY_ENDPOINT", "PLATFORM_ENVIRONMENT", "PLATFORM_AUTH_MODE", "PLATFORM_RUNTIME_SMOKE_MODE", "ENABLE_TEST_SUPPORT_API"}}
    env.update(overrides)
    return subprocess.run([sys.executable, "-c", "from app.main import app; from app.services.test_support import TEST_SUPPORT_ENABLED; print(TEST_SUPPORT_ENABLED)"], cwd=ROOT, env=env, capture_output=True, text=True)


def test_test_support_is_disabled_without_setting():
    result = startup()
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "False"


@pytest.mark.parametrize("marker", ["CONTAINER_APP_NAME", "CONTAINER_APP_REVISION", "WEBSITE_INSTANCE_ID", "IDENTITY_ENDPOINT", "PLATFORM_ENVIRONMENT"])
@pytest.mark.parametrize("unsafe", [{"PLATFORM_RUNTIME_SMOKE_MODE": "true"}, {"PLATFORM_AUTH_MODE": "local"}])
def test_azure_refuses_unsafe_startup(marker, unsafe):
    result = startup(**{marker: "dev"}, **unsafe)
    assert result.returncode != 0
    assert "Azure requires Entra" in result.stderr


def test_local_smoke_can_start_and_safe_azure_can_start():
    assert startup(PLATFORM_RUNTIME_SMOKE_MODE="true").returncode == 0
    assert startup(CONTAINER_APP_NAME="portal", PLATFORM_AUTH_MODE="entra").returncode == 0
