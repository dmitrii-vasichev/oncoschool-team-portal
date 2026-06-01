import uuid

from pydantic import BaseModel, Field, field_validator

from app.services.activity_service import ALLOWED_EMOJI


class ReactionRequest(BaseModel):
    emoji: str

    @field_validator("emoji")
    @classmethod
    def _check(cls, v: str) -> str:
        if v not in ALLOWED_EMOJI:
            raise ValueError("unsupported emoji")
        return v


class KudosRequest(BaseModel):
    recipient_id: uuid.UUID
    message: str = Field(..., max_length=280)

    @field_validator("message")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message required")
        return v
