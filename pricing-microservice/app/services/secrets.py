"""Retrieve optional third-party credentials only from Key Vault."""
import os
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient


def github_token() -> str | None:
    vault_url = os.getenv("AZURE_KEY_VAULT_URL", "")
    if not vault_url:
        return None
    client = SecretClient(vault_url=vault_url, credential=DefaultAzureCredential(
        managed_identity_client_id=os.getenv("AZURE_CLIENT_ID"),
        exclude_environment_credential=True,
        exclude_interactive_browser_credential=True,
    ))
    return client.get_secret("github-token").value
