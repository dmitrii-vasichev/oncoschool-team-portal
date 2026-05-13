import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api import ideas as ideas_api
from app.db.models import Department, TeamMember
from app.db.schemas import IdeaCreate, IdeaLinkedTaskCreate, IdeaStatusChange


def request_with_no_bot():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(bot=None)))


def linked_task_data():
    return IdeaLinkedTaskCreate(title="Create landing flow")


def active_member(member_id: uuid.UUID | None = None):
    return SimpleNamespace(id=member_id or uuid.uuid4(), is_active=True, role="member")


def active_department(department_id: uuid.UUID | None = None):
    return SimpleNamespace(id=department_id or uuid.uuid4(), is_active=True)


@pytest.mark.asyncio
async def test_create_idea_returns_service_response_and_commits(monkeypatch):
    member = SimpleNamespace(id=uuid.uuid4())
    review_owner_id = uuid.uuid4()
    idea_id = uuid.uuid4()
    data = IdeaCreate(
        title="Improve reports",
        description="Add a useful summary",
        review_owner_id=review_owner_id,
        department_ids=[],
    )
    session = AsyncMock()
    created_idea = SimpleNamespace(id=idea_id)
    shaped_response = SimpleNamespace(id=idea_id)

    async def get_model(model, item_id):
        if model is TeamMember and item_id == review_owner_id:
            return active_member(review_owner_id)
        return None

    session.get.side_effect = get_model
    monkeypatch.setattr(
        ideas_api.idea_service.repo,
        "create",
        AsyncMock(return_value=created_idea),
    )
    monkeypatch.setattr(
        ideas_api.idea_service.repo,
        "add_event",
        AsyncMock(),
    )
    monkeypatch.setattr(
        ideas_api.idea_service.repo,
        "get_by_id",
        AsyncMock(return_value=created_idea),
    )
    monkeypatch.setattr(
        ideas_api.idea_service,
        "shape_response",
        AsyncMock(return_value=shaped_response),
    )

    response = await ideas_api.create_idea(
        data=data,
        member=member,
        session=session,
    )

    assert response.id == idea_id
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_change_idea_status_raises_404_when_idea_does_not_exist(monkeypatch):
    monkeypatch.setattr(
        ideas_api.idea_service.repo,
        "get_by_id",
        AsyncMock(return_value=None),
    )

    with pytest.raises(HTTPException) as exc_info:
        await ideas_api.change_idea_status(
            idea_id=uuid.uuid4(),
            data=IdeaStatusChange(status="accepted"),
            member=SimpleNamespace(id=uuid.uuid4()),
            session=AsyncMock(),
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_create_idea_deduplicates_initial_department_ids(monkeypatch):
    member = active_member()
    review_owner_id = uuid.uuid4()
    department_id = uuid.uuid4()
    idea_id = uuid.uuid4()
    session = AsyncMock()
    data = IdeaCreate(
        title="Improve reports",
        description="Add a useful summary",
        review_owner_id=review_owner_id,
        department_ids=[department_id, department_id],
    )
    created_idea = SimpleNamespace(id=idea_id)
    shaped_response = SimpleNamespace(id=idea_id)

    async def get_model(model, item_id):
        if model is TeamMember and item_id == review_owner_id:
            return active_member(review_owner_id)
        if model is Department and item_id == department_id:
            return active_department(department_id)
        return None

    session.get.side_effect = get_model
    add_department = AsyncMock()
    monkeypatch.setattr(
        ideas_api.idea_service.repo,
        "create",
        AsyncMock(return_value=created_idea),
    )
    monkeypatch.setattr(ideas_api.idea_service.repo, "add_department", add_department)
    monkeypatch.setattr(ideas_api.idea_service.repo, "add_event", AsyncMock())
    monkeypatch.setattr(
        ideas_api.idea_service.repo,
        "get_by_id",
        AsyncMock(return_value=created_idea),
    )
    monkeypatch.setattr(
        ideas_api.idea_service,
        "shape_response",
        AsyncMock(return_value=shaped_response),
    )

    await ideas_api.create_idea(data=data, member=member, session=session)

    add_department.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_idea_returns_404_for_missing_initial_department(monkeypatch):
    review_owner_id = uuid.uuid4()
    missing_department_id = uuid.uuid4()
    session = AsyncMock()

    async def get_model(model, item_id):
        if model is TeamMember and item_id == review_owner_id:
            return active_member(review_owner_id)
        return None

    session.get.side_effect = get_model
    monkeypatch.setattr(ideas_api.idea_service.repo, "create", AsyncMock())

    with pytest.raises(HTTPException) as exc_info:
        await ideas_api.create_idea(
            data=IdeaCreate(
                title="Improve reports",
                description="Add a useful summary",
                review_owner_id=review_owner_id,
                department_ids=[missing_department_id],
            ),
            member=active_member(),
            session=session,
        )

    assert exc_info.value.status_code == 404
    ideas_api.idea_service.repo.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_idea_returns_404_for_inactive_review_owner(monkeypatch):
    review_owner_id = uuid.uuid4()
    session = AsyncMock()

    async def get_model(model, item_id):
        if model is TeamMember and item_id == review_owner_id:
            return SimpleNamespace(id=review_owner_id, is_active=False)
        return None

    session.get.side_effect = get_model
    monkeypatch.setattr(ideas_api.idea_service.repo, "create", AsyncMock())

    with pytest.raises(HTTPException) as exc_info:
        await ideas_api.create_idea(
            data=IdeaCreate(
                title="Improve reports",
                description="Add a useful summary",
                review_owner_id=review_owner_id,
                department_ids=[],
            ),
            member=active_member(),
            session=session,
        )

    assert exc_info.value.status_code == 404
    ideas_api.idea_service.repo.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_idea_task_rejects_invalid_idea_status(monkeypatch):
    member = active_member()
    idea = SimpleNamespace(
        id=uuid.uuid4(),
        status="new",
        review_owner_id=member.id,
        departments=[],
    )
    monkeypatch.setattr(
        ideas_api.idea_service.repo,
        "get_by_id",
        AsyncMock(return_value=idea),
    )
    create_linked_task = AsyncMock(return_value=SimpleNamespace(id=idea.id))
    monkeypatch.setattr(ideas_api, "_create_linked_task", create_linked_task)

    with pytest.raises(HTTPException) as exc_info:
        await ideas_api.create_idea_task(
            idea_id=idea.id,
            data=linked_task_data(),
            request=request_with_no_bot(),
            member=member,
            session=AsyncMock(),
        )

    assert exc_info.value.status_code == 400
    create_linked_task.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_idea_department_task_rejects_invalid_idea_status(monkeypatch):
    member = active_member()
    idea_department = SimpleNamespace(
        id=uuid.uuid4(),
        owner_id=member.id,
        department=SimpleNamespace(head_id=None),
    )
    idea = SimpleNamespace(
        id=uuid.uuid4(),
        status="completed",
        review_owner_id=member.id,
        departments=[idea_department],
    )
    monkeypatch.setattr(
        ideas_api.idea_service.repo,
        "get_by_id",
        AsyncMock(return_value=idea),
    )
    create_linked_task = AsyncMock(return_value=SimpleNamespace(id=idea.id))
    monkeypatch.setattr(ideas_api, "_create_linked_task", create_linked_task)

    with pytest.raises(HTTPException) as exc_info:
        await ideas_api.create_idea_department_task(
            idea_id=idea.id,
            idea_department_id=idea_department.id,
            data=linked_task_data(),
            request=request_with_no_bot(),
            member=member,
            session=AsyncMock(),
        )

    assert exc_info.value.status_code == 400
    create_linked_task.assert_not_awaited()
