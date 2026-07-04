import os
import struct
import time
from contextlib import contextmanager

import pyodbc
from azure.identity import DefaultAzureCredential


SQL_SERVER = os.getenv("SQL_SERVER", "bdwus.database.windows.net")
SQL_DATABASE = os.getenv("SQL_DATABASE", "AZBDWUSP")
ODBC_DRIVER = os.getenv("ODBC_DRIVER", "ODBC Driver 18 for SQL Server")
SQL_COPT_SS_ACCESS_TOKEN = 1256

# Connection pool settings
MAX_RETRIES = int(os.getenv("SQL_MAX_RETRIES", "3"))
RETRY_DELAY_SECONDS = float(os.getenv("SQL_RETRY_DELAY_SECONDS", "0.5"))
LOCK_TIMEOUT_MS = int(os.getenv("SQL_LOCK_TIMEOUT_MS", "5000"))


def get_sql_connection() -> pyodbc.Connection:
    """
    Get a SQL Server connection with retry logic for transient failures.
    
    Implements exponential backoff to handle lock timeouts and transient connection issues.
    """
    credential = DefaultAzureCredential(exclude_interactive_browser_credential=False)
    token = credential.get_token("https://database.windows.net/.default").token.encode("utf-16-le")
    token_struct = struct.pack(f"<I{len(token)}s", len(token), token)

    conn_str = (
        f"Driver={{{ODBC_DRIVER}}};"
        f"Server=tcp:{SQL_SERVER},1433;"
        f"Database={SQL_DATABASE};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            conn = pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct})
            # Set lock timeout to prevent indefinite waits
            conn.execute(f"SET LOCK_TIMEOUT {LOCK_TIMEOUT_MS}")
            return conn
        except pyodbc.OperationalError as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                # Use exponential backoff: 0.5s, 1s, 2s, etc.
                delay = RETRY_DELAY_SECONDS * (2 ** attempt)
                print(f"Connection attempt {attempt + 1}/{MAX_RETRIES} failed, retrying in {delay}s: {e}")
                time.sleep(delay)
            else:
                print(f"All {MAX_RETRIES} connection attempts failed")
                raise
    
    raise last_error or Exception("Failed to acquire SQL connection")


@contextmanager
def get_sql_connection_context():
    """
    Context manager for SQL connections ensuring proper cleanup.
    
    Usage:
        with get_sql_connection_context() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
    """
    conn = get_sql_connection()
    try:
        yield conn
    finally:
        try:
            conn.close()
        except Exception as e:
            print(f"Error closing connection: {e}")
