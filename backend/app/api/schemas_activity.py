from pydantic import BaseModel, field_validator

from app.services.activity_service import ALLOWED_EMOJI


class ReactionRequest(BaseModel):
    emoji: str

    @field_validator("emoji")
    @classmethod
    def _check(cls, v: str) -> str:
        if v not in ALLOWED_EMOJI:
            raise ValueError("unsupported emoji")
        return v
