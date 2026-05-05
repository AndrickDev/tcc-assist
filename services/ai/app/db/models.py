from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TccMetadata(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    course: str
    institution: str
    work_type: str | None
    norma: str | None
    objective: str | None
    owner_id: str


class MessageRow(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    role: str
    content: str
    created_at: datetime


class ReferenceRow(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    authors: str
    year: int | None
    source: str
    abstract: str | None
    venue: str | None
    citation_count: int | None
    created_at: datetime
