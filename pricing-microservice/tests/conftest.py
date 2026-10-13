"""Tests must never acquire Azure credentials or connect to a real database."""
import os
os.environ["PLATFORM_AUTH_MODE"] = "local"
os.environ["AI_ASSISTANT_OFFLINE"] = "true"
import pytest
import pyodbc
from azure.identity import DefaultAzureCredential


@pytest.fixture(autouse=True)
def forbid_live_database_and_credentials(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Tests must mock database/credential access")
    monkeypatch.setattr(pyodbc, "connect", forbidden)
    monkeypatch.setattr(DefaultAzureCredential, "get_token", forbidden)
