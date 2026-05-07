import uuid

from app.db.schemas import (
    MeetingAIProcessingResponse,
    MeetingBoardSettingsResponse,
    MeetingBoardTaskDraft,
)


def test_board_settings_response_defaults_are_empty() -> None:
    response = MeetingBoardSettingsResponse(
        id=uuid.uuid4(),
        meeting_id=uuid.uuid4(),
        added_member_ids=[],
        added_department_ids=[],
        pinned_task_ids=[],
        materials=[],
        board_notes=None,
        created_by_id=None,
        updated_by_id=None,
        created_at=None,
        updated_at=None,
    )

    assert response.added_member_ids == []
    assert response.materials == []


def test_ai_processing_response_supports_openai_audio_source() -> None:
    response = MeetingAIProcessingResponse(
        id=uuid.uuid4(),
        meeting_id=uuid.uuid4(),
        status="draft_ready",
        transcript_source="openai_audio",
        transcription_model="gpt-4o-mini-transcribe",
        started_at=None,
        completed_at=None,
        error_message=None,
        transcript_char_count=123,
        audio_duration_seconds=None,
        estimated_cost_usd=None,
        draft_summary="Summary",
        draft_decisions=["Decision"],
        draft_tasks=[
            MeetingBoardTaskDraft(
                title="Prepare deck",
                description=None,
                assignee_name=None,
                assignee_id=None,
                deadline=None,
                priority="normal",
                selected=True,
            )
        ],
        published_at=None,
        published_by_id=None,
    )

    assert response.transcript_source == "openai_audio"
    assert response.draft_tasks[0].selected is True
