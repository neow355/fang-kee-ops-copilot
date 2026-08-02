import argparse
import re
import shutil
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import SessionLocal, initialize_database
from .models import ROLE_RANK, Document, DocumentChunk, Role, User
from .rag import deterministic_embedding
from .security import hash_password


DEMO_TEXT = """## 服務時間 {#hours}

方記門市營業時間為星期一至星期六上午九時至下午六時，星期日休息。

## 回覆流程 {#response}

客戶查詢應在一個工作天內首次回覆。退款申請須由管理員審批並保留處理紀錄。"""


def _sections(text: str) -> list[tuple[str, str, str]]:
    matches = list(re.finditer(r"^##\s+.+?\s+\{#([A-Za-z0-9._-]+)\}\s*$", text, re.MULTILINE))
    output: list[tuple[str, str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        section_text = text[match.start() : end].strip()
        visibility_match = re.search(
            r"`visibility:\s*(public|client|staff|manager|admin)`", section_text
        )
        output.append(
            (
                match.group(1),
                visibility_match.group(1) if visibility_match else Role.public.value,
                section_text,
            )
        )
    return output


def _seed_users(db: Session) -> User:
    settings = get_settings()
    admin: User | None = None
    for role in ROLE_RANK:
        email = (
            settings.seed_admin_email.lower()
            if role == Role.admin.value
            else f"{role}@fangkee.example"
        )
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(
                email=email,
                password_hash=hash_password(settings.seed_admin_password),
                role=role,
            )
            db.add(user)
            db.flush()
        if role == Role.admin.value:
            admin = user
    assert admin is not None
    return admin


def _add_document(
    db: Session,
    owner: User,
    source: Path,
    source_id: str,
    default_visibility: str,
) -> None:
    if db.scalar(select(Document).where(Document.source_id == source_id)):
        return
    settings = get_settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    target = (settings.storage_dir / f"{source_id}.md").resolve()
    shutil.copyfile(source, target)
    text = target.read_text(encoding="utf-8")
    parsed = _sections(text)
    document = Document(
        source_id=source_id,
        title=source.stem.replace("-", " ").title(),
        filename=target.name,
        storage_path=str(target),
        content_type="text/markdown",
        size_bytes=len(text.encode("utf-8")),
        visibility=default_visibility,
        uploaded_by=owner.id,
    )
    for paragraph, (section_id, visibility, section_text) in enumerate(parsed, 1):
        document.chunks.append(
            DocumentChunk(
                page=None,
                paragraph=paragraph,
                section_id=section_id,
                visibility=visibility,
                text=section_text,
                embedding=deterministic_embedding(section_text),
            )
        )
    db.add(document)


def seed(db: Session, include_demo: bool = True) -> User:
    settings = get_settings()
    user = _seed_users(db)
    demo_files = {
        "company-handbook.md": ("handbook", Role.public.value),
        "access-control.md": ("access-control", Role.public.value),
        "synthetic-projects.md": ("synthetic-projects", Role.staff.value),
    }
    available = settings.demo_data_dir.resolve()
    if include_demo and available.exists():
        for filename, (source_id, visibility) in demo_files.items():
            source = available / filename
            if source.exists():
                _add_document(db, user, source, source_id, visibility)
    elif include_demo and not db.scalar(select(Document).where(Document.source_id == "demo-policy")):
        settings.storage_dir.mkdir(parents=True, exist_ok=True)
        path = (settings.storage_dir / "demo-policy.md").resolve()
        path.write_text(DEMO_TEXT, encoding="utf-8")
        document = Document(
            source_id="demo-policy",
            title="方記營運示範指引",
            filename="demo-policy.md",
            storage_path=str(path),
            content_type="text/markdown",
            size_bytes=len(DEMO_TEXT.encode()),
            visibility="staff",
            uploaded_by=user.id,
        )
        for paragraph, (section_id, visibility, text) in enumerate(_sections(DEMO_TEXT), 1):
            document.chunks.append(
                DocumentChunk(
                    page=None,
                    paragraph=paragraph,
                    section_id=section_id,
                    visibility=visibility,
                    text=text,
                    embedding=deterministic_embedding(text),
                )
            )
        db.add(document)
    db.commit()
    return user


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed 方記 AI demo data")
    parser.add_argument("--no-demo", action="store_true", help="Only create the admin user")
    args = parser.parse_args()
    initialize_database()
    with SessionLocal() as db:
        user = seed(db, include_demo=not args.no_demo)
        print(f"Seeded admin: {user.email}")


if __name__ == "__main__":
    main()
