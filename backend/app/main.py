from contextlib import asynccontextmanager
import json
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Integer, func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db, initialize_database
from .models import ROLE_RANK, ChatMetric, Document, Inquiry, Role, User
from .rag import (
    ALLOWED_SUFFIXES,
    LocalStorage,
    has_prompt_injection,
    index_document,
    llm_answer,
    policy_matches,
    refusal_sections,
    retrieve,
)
from .schemas import (
    ChatInput,
    ChatOutput,
    Citation,
    DocumentOutput,
    InquiryInput,
    InquiryOutput,
    LoginInput,
    UserOutput,
)
from .security import create_session_token, current_user, require_admin, verify_password
from .seed import seed

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    if settings.seed_on_start:
        from .database import SessionLocal

        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(title="方記 AI 營運助理 API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=UserOutput)
def login(payload: LoginInput, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    response.set_cookie(
        key=settings.session_cookie,
        value=create_session_token(user),
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    return user


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(
        settings.session_cookie,
        path="/",
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
    )


@app.get("/api/auth/me", response_model=UserOutput)
def me(user: User = Depends(current_user)):
    return user


@app.get("/api/inquiries", response_model=list[InquiryOutput])
def list_inquiries(user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(Inquiry).order_by(Inquiry.created_at.desc())
    if user.role != Role.admin.value:
        query = query.where(Inquiry.created_by == user.id)
    return db.scalars(query).all()


@app.post("/api/inquiries", response_model=InquiryOutput, status_code=status.HTTP_201_CREATED)
def create_inquiry(
    payload: InquiryInput,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    inquiry = Inquiry(**payload.model_dump(), created_by=user.id)
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)
    return inquiry


@app.get("/api/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    inquiry_query = select(func.count(Inquiry.id))
    if user.role != Role.admin.value:
        inquiry_query = inquiry_query.where(Inquiry.created_by == user.id)
    visible_roles = [role for role, rank in ROLE_RANK.items() if rank <= ROLE_RANK.get(user.role, -1)]
    return {
        "inquiry_count": db.scalar(inquiry_query) or 0,
        "document_count": db.scalar(
            select(func.count(Document.id)).where(Document.visibility.in_(visible_roles))
        )
        or 0,
        "query_count": db.scalar(
            select(func.count(ChatMetric.id))
            if user.role == Role.admin.value
            else select(func.count(ChatMetric.id)).where(ChatMetric.user_id == user.id)
        )
        or 0,
        "service_status": "正常",
    }


@app.get("/api/documents", response_model=list[DocumentOutput])
def list_documents(user: User = Depends(current_user), db: Session = Depends(get_db)):
    visible_roles = [role for role, rank in ROLE_RANK.items() if rank <= ROLE_RANK.get(user.role, -1)]
    query = (
        select(Document)
        .where(Document.visibility.in_(visible_roles))
        .order_by(Document.created_at.desc())
    )
    return db.scalars(query).all()


@app.post("/api/documents", response_model=DocumentOutput, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    visibility: str = Form(default="staff"),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    suffix = Path(file.filename or "").suffix.lower()
    allowed_mimes = {
        ".pdf": {"application/pdf"},
        ".txt": {"text/plain", "application/octet-stream"},
        ".md": {"text/markdown", "text/plain", "application/octet-stream"},
    }
    if suffix not in ALLOWED_SUFFIXES or file.content_type not in allowed_mimes[suffix]:
        raise HTTPException(415, "Only PDF, TXT and MD files are accepted")
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, "File exceeds 10MB limit")
    if not data:
        raise HTTPException(400, "Empty file")
    storage = LocalStorage(settings.storage_dir)
    clean_name, storage_path = storage.save(file, data)
    document = Document(
        source_id=f"upload-{uuid4().hex}",
        title=(title or Path(clean_name).stem)[:255],
        filename=clean_name,
        storage_path=storage_path,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(data),
        visibility=visibility if visibility in {"staff", "admin"} else "staff",
        uploaded_by=user.id,
    )
    try:
        index_document(db, document)
        db.refresh(document)
    except Exception as exc:
        Path(storage_path).unlink(missing_ok=True)
        raise HTTPException(422, f"Document could not be parsed: {type(exc).__name__}")
    return document


@app.post("/api/chat", response_model=ChatOutput)
def chat(
    payload: ChatInput,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    started = perf_counter()
    required_policy = refusal_sections(payload.question)
    explicitly_refused = bool(required_policy)
    relevant_matches = (
        []
        if has_prompt_injection(payload.question)
        else retrieve(db, user, payload.question, limit=2 if explicitly_refused else 4)
    )
    matches = policy_matches(db, required_policy) + relevant_matches
    matches = list({match.chunk.id: match for match in matches}.values())
    refused = explicitly_refused or not matches or max(match.score for match in matches) < settings.retrieval_threshold
    if refused and not matches:
        matches = policy_matches(db, ["refusal"])

    if refused:
        answer, input_tokens, output_tokens = (
            "我無法提供所要求的判斷或資料。請依引用政策採取安全替代流程，並交由獲授權或合資格人員處理。",
            len(payload.question.split()),
            0,
        )
        provider = "local"
    else:
        answer, input_tokens, output_tokens, provider = llm_answer(payload.question, matches, settings)
    citation_matches = matches if refused else matches[:2]
    citations = [
        Citation(
            document_id=match.chunk.document.source_id,
            section_id=match.chunk.section_id,
            title=match.chunk.document.title,
            page=match.chunk.page,
            excerpt=match.chunk.text[:400],
        )
        for match in citation_matches
        if match.chunk.text and match.chunk.text[:400] in match.chunk.text
    ]
    if not citations:
        refused = True
        answer = "來源引用驗證失敗，無法回答。"

    latency_ms = max(1, round((perf_counter() - started) * 1000))
    # Approximate configurable demo cost for gpt-4o-mini; local mode is always free.
    cost_usd = (
        round(input_tokens * 0.15 / 1_000_000 + output_tokens * 0.60 / 1_000_000, 8)
        if provider == "openai"
        else 0.0
    )
    db.add(
        ChatMetric(
            user_id=user.id,
            question=payload.question,
            latency_ms=latency_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            refused=refused,
            provider=provider,
        )
    )
    db.commit()
    return ChatOutput(
        answer=answer,
        citations=citations,
        refused=refused,
        latency_ms=latency_ms,
        cost_usd=cost_usd,
    )


@app.get("/api/metrics")
def metrics(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = db.execute(
        select(
            func.count(ChatMetric.id),
            func.coalesce(func.avg(ChatMetric.latency_ms), 0),
            func.coalesce(func.sum(ChatMetric.input_tokens), 0),
            func.coalesce(func.sum(ChatMetric.output_tokens), 0),
            func.coalesce(func.sum(ChatMetric.cost_usd), 0),
            func.coalesce(func.sum(func.cast(ChatMetric.refused, Integer)), 0),
        )
    ).one()
    chat_count = int(row[0])
    refused_count = int(row[5])
    average_latency = round(float(row[1]), 2)
    total_cost = round(float(row[4]), 8)
    refusal_rate = refused_count / chat_count if chat_count else 0.0
    accuracy_value = None
    accuracy_description = "請執行 50 題固定評估集後查看；系統不自行臆測。"
    report_path = settings.evaluation_report_path
    if report_path.exists():
        try:
            summary = json.loads(report_path.read_text(encoding="utf-8"))["summary"]
            rates = [
                float(summary["retrieval_hit_rate"]),
                float(summary["refusal_correctness"]),
                float(summary["citation_validity"]),
            ]
            accuracy_value = round(sum(rates) / len(rates) * 100, 2)
            accuracy_description = (
                f"固定合成評估綜合分數；完成 {summary['completed']}/{summary['total']} 題，"
                "不代表真實工程正確性。"
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            accuracy_description = "評估報告格式無效，未顯示正確性數值。"
    return {
        "accuracy": {
            "value": accuracy_value,
            "unit": "%" if accuracy_value is not None else "",
            "description": accuracy_description,
        },
        "refusal_rate": {
            "value": round(refusal_rate * 100, 2),
            "unit": "%",
            "description": f"{refused_count}/{chat_count} 次問答被安全拒答",
        },
        "latency": {
            "value": average_latency,
            "unit": " ms",
            "description": "後端平均處理時間",
        },
        "cost": {
            "value": total_cost,
            "unit": " USD",
            "description": "目前統計期間的模型估算總成本",
        },
        "chat_count": row[0],
        "average_latency_ms": average_latency,
        "input_tokens": row[2],
        "output_tokens": row[3],
        "cost_usd": total_cost,
        "refused_count": refused_count,
    }
