import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test-ops-copilot.db"
os.environ["SECRET_KEY"] = "test-secret-key-only-with-at-least-32-bytes"
os.environ["STORAGE_DIR"] = "./test-storage"
os.environ["SEED_ADMIN_EMAIL"] = "admin@example.com"
os.environ["SEED_ADMIN_PASSWORD"] = "TestPassword123!"
os.environ["RETRIEVAL_THRESHOLD"] = "0.01"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Document, DocumentChunk, Role, User
from app.rag import deterministic_embedding
from app.security import hash_password


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        admin = User(
            email="admin@example.com",
            password_hash=hash_password("TestPassword123!"),
            role=Role.admin.value,
        )
        staff = User(
            email="staff@example.com",
            password_hash=hash_password("TestPassword123!"),
            role=Role.staff.value,
        )
        db.add_all([admin, staff])
        db.flush()
        document = Document(
            source_id="guide",
            title="營運指引",
            filename="guide.md",
            storage_path="test-storage/guide.md",
            content_type="text/markdown",
            size_bytes=30,
            visibility="staff",
            uploaded_by=admin.id,
        )
        text = "門市營業時間為星期一至星期六上午九時至下午六時。"
        document.chunks.append(
            DocumentChunk(
                page=None,
                paragraph=1,
                section_id="hours",
                visibility="staff",
                text=text,
                embedding=deterministic_embedding(text),
            )
        )
        policy = Document(
            source_id="access-control",
            title="存取控制政策",
            filename="access-control.md",
            storage_path="test-storage/access-control.md",
            content_type="text/markdown",
            size_bytes=100,
            visibility="public",
            uploaded_by=admin.id,
        )
        for paragraph, section_id in enumerate(["refusal", "injection", "roles", "visibility"], 1):
            policy_text = f"{section_id}：不得洩漏秘密、繞過角色或提供高風險專業判斷。"
            policy.chunks.append(
                DocumentChunk(
                    page=None,
                    paragraph=paragraph,
                    section_id=section_id,
                    visibility="public",
                    text=policy_text,
                    embedding=deterministic_embedding(policy_text),
                )
            )
        db.add_all([document, policy])
        db.commit()
    yield
    Base.metadata.drop_all(engine)
    storage = Path("test-storage")
    if storage.exists():
        for item in storage.iterdir():
            item.unlink(missing_ok=True)
        storage.rmdir()


def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    Path("test-ops-copilot.db").unlink(missing_ok=True)


@pytest.fixture
def client():
    with TestClient(app) as value:
        yield value


def login(client: TestClient, email: str = "admin@example.com"):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": "TestPassword123!"},
    )
