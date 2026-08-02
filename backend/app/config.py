from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./fangkee.db"
    secret_key: str = "change-me-in-production"
    session_cookie: str = "fangkee_session"
    session_hours: int = 12
    secure_cookies: bool = False
    cors_origins: str = "http://localhost:3000"
    storage_dir: Path = Path("./storage")
    demo_data_dir: Path = Path("../demo-data")
    evaluation_report_path: Path = Path("../evaluation/reports/evaluation-report.json")
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    seed_on_start: bool = False
    seed_admin_email: str = "admin@fangkee.example"
    seed_admin_password: str = "ChangeMe123!"
    max_upload_bytes: int = 10 * 1024 * 1024
    retrieval_threshold: float = 0.08

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
