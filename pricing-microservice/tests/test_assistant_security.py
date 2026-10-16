from types import SimpleNamespace
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
import pytest
from fastapi import HTTPException
from app.services import assistant
from app.services.authz import ACTOR


@pytest.mark.parametrize(
    "repository",
    [
        "other/repo",
        "BrianDWalker/AXIOM",
        "BrianDWalker/BDWUS/extra",
        "BrianDWalker/%2e%2e",
        "../BDWUS",
    ],
)
def test_repository_denied_before_credentials(monkeypatch, repository):
    monkeypatch.setenv("ASSISTANT_ALLOWED_REPOSITORIES", "BrianDWalker/BDWUS")
    monkeypatch.setattr(
        assistant,
        "github_token",
        lambda: pytest.fail("must reject before accessing credentials"),
    )
    with pytest.raises(HTTPException):
        assistant.get_github_branches(repository)


def test_empty_allowlist_denies_and_casefold_matches(monkeypatch):
    monkeypatch.delenv("ASSISTANT_ALLOWED_REPOSITORIES", raising=False)
    with pytest.raises(HTTPException):
        assistant.normalize_github_repository("BrianDWalker/BDWUS")
    monkeypatch.setenv("ASSISTANT_ALLOWED_REPOSITORIES", "BrianDWalker/BDWUS")
    assert (
        assistant.normalize_github_repository("briandwalker/bdwus")
        == "briandwalker/bdwus"
    )


@pytest.mark.parametrize(
    "enabled,actor,mode,allowed",
    [
        (None, "owner", "entra", False),
        ("true", "other", "entra", False),
        ("true", "owner", "local", False),
        ("true", "owner", "entra", True),
    ],
)
def test_commits_require_explicit_owner_enablement(
    monkeypatch, enabled, actor, mode, allowed
):
    monkeypatch.setenv("PLATFORM_AUTH_MODE", mode)
    monkeypatch.setenv("ASSISTANT_OWNER_OBJECT_ID", "owner")
    if enabled:
        monkeypatch.setenv("ASSISTANT_GITHUB_WRITES_ENABLED", enabled)
    else:
        monkeypatch.delenv("ASSISTANT_GITHUB_WRITES_ENABLED", raising=False)
    token = ACTOR.set(actor)
    try:
        if allowed:
            assistant.require_github_write()
        else:
            with pytest.raises(HTTPException):
                assistant.require_github_write()
    finally:
        ACTOR.reset(token)


def test_low_level_github_writer_cannot_bypass_gate(monkeypatch):
    monkeypatch.setenv("ASSISTANT_ALLOWED_REPOSITORIES", "BrianDWalker/BDWUS")
    monkeypatch.setattr(
        assistant, "github_token", lambda: pytest.fail("no credential access")
    )
    with pytest.raises(HTTPException):
        assistant.github_request("POST", "/repos/BrianDWalker/BDWUS/git/commits", {})


def test_claim_is_atomic_conditional_update(monkeypatch):
    captured = []

    class Connection:
        def cursor(self):
            return self

        def execute(self, sql, *args):
            captured.append(sql)
            return self

        def fetchone(self):
            return None

        def commit(self):
            captured.append("COMMIT")

        def close(self):
            pass

    monkeypatch.setattr(assistant, "get_sql_connection", Connection)
    assert not assistant.claim_change_request(uuid4())
    assert "OUTPUT inserted.ChangeRequestId" in captured[0]
    assert "Status = 'Proposed'" in captured[0]
    assert "Status = 'Applying'" in captured[0]
    assert captured[1] == "COMMIT"


def test_concurrent_or_retried_approval_never_repeats_uncertain_effect(monkeypatch):
    record = SimpleNamespace(status="Proposed", kind="lead_create", patch={"leadDraft": {"accountName": "Demo"}})
    lock = Lock()
    effects = []
    monkeypatch.setattr(assistant, "ensure_ai_storage", lambda: None)
    monkeypatch.setattr(assistant, "get_change_request", lambda _: record)

    def claim(_):
        with lock:
            if record.status != "Proposed":
                return False
            record.status = "Applying"
            return True

    def effect(_):
        effects.append(1)
        raise RuntimeError("lost result after effect")

    monkeypatch.setattr(assistant, "claim_change_request", claim)
    monkeypatch.setattr(assistant, "execute_lead_create", effect)

    def approve():
        try:
            assistant.approve_change_request(
                uuid4(), SimpleNamespace(approvedBy="forged")
            )
        except (HTTPException, RuntimeError):
            pass

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: approve(), range(2)))
    approve()
    assert effects == [1]
    assert record.status == "Applying"


def test_completed_approval_returns_without_side_effect(monkeypatch):
    record = SimpleNamespace(status="Approved")
    monkeypatch.setattr(assistant, "ensure_ai_storage", lambda: None)
    monkeypatch.setattr(assistant, "get_change_request", lambda _: record)
    monkeypatch.setattr(
        assistant, "execute_lead_create", lambda _: pytest.fail("must not repeat")
    )
    assert assistant.approve_change_request(uuid4(), SimpleNamespace()) is record


@pytest.mark.parametrize("kind,patch", [("lead_create", {}), ("github_update", {"github": {"repository": "BrianDWalker/BDWUS"}}), ("ui_override", {"overrides": [{"value": "missing target"}]})])
def test_invalid_proposal_remains_proposed(monkeypatch, kind, patch):
    record = SimpleNamespace(status="Proposed", kind=kind, patch=patch)
    monkeypatch.setattr(assistant, "ensure_ai_storage", lambda: None)
    monkeypatch.setattr(assistant, "get_change_request", lambda _: record)
    monkeypatch.setattr(assistant, "require_github_write", lambda: None)
    monkeypatch.setenv("ASSISTANT_ALLOWED_REPOSITORIES", "BrianDWalker/BDWUS")
    monkeypatch.setattr(assistant, "claim_change_request", lambda _: pytest.fail("must validate before claim"))
    with pytest.raises(HTTPException) as error:
        assistant.approve_change_request(uuid4(), SimpleNamespace())
    assert error.value.status_code == 400
    assert record.status == "Proposed"


def test_note_proposal_is_valid_without_side_effects():
    assistant.validate_proposal_payload(SimpleNamespace(kind="note", patch={}))


@pytest.mark.parametrize("path", ["../../../../user/repos", "%2e%2e/%2e%2e/user/repos", "%252e%252e/user/repos", "folder/../secret", "folder/./secret"])
def test_github_traversal_denied_before_credentials(monkeypatch, path):
    monkeypatch.setenv("ASSISTANT_ALLOWED_REPOSITORIES", "BrianDWalker/BDWUS")
    monkeypatch.setattr(assistant, "github_token", lambda: pytest.fail("no credentials for traversal"))
    with pytest.raises(HTTPException):
        assistant.get_github_file("BrianDWalker/BDWUS", "main", path)
    with pytest.raises(HTTPException):
        assistant.github_request("GET", "/repos/BrianDWalker/BDWUS/contents/" + path)


def test_github_redirects_do_not_forward_credentials():
    assert assistant.NoGithubRedirect().redirect_request(None, None, 301, "Moved", {}, "https://other.example/") is None
