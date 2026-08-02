from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class UserOutput(BaseModel):
    id: str
    email: EmailStr
    role: str
    model_config = ConfigDict(from_attributes=True)


class InquiryInput(BaseModel):
    customer_name: str | None = Field(default=None, max_length=200)
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=10_000)
    channel: str = Field(default="other", max_length=32)
    priority: str = Field(default="normal", max_length=32)


class InquiryOutput(BaseModel):
    id: str
    customer_name: str | None
    subject: str
    message: str
    channel: str
    priority: str
    status: str
    created_by: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DocumentOutput(BaseModel):
    id: str
    source_id: str
    title: str
    filename: str
    content_type: str
    size_bytes: int
    visibility: str
    status: str = "indexed"
    chunk_count: int = 0
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChatInput(BaseModel):
    question: str = Field(min_length=2, max_length=4000)


class Citation(BaseModel):
    document_id: str
    section_id: str
    title: str
    page: int | None
    excerpt: str


class ChatOutput(BaseModel):
    answer: str
    citations: list[Citation]
    refused: bool
    latency_ms: int
    cost_usd: float
