import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.api.auth import get_me


@pytest.mark.asyncio
async def test_get_me_includes_content_factory_access_flag():
    member = SimpleNamespace(
        id=uuid.uuid4(),
        telegram_id=123,
        telegram_username="cf_user",
        full_name="CF User",
        name_variants=[],
        role="member",
        is_test=False,
        is_active=True,
        has_content_factory_access=True,
        position=None,
        department_id=None,
        extra_department_ids=[],
        avatar_url=None,
        email=None,
        birthday=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    result = await get_me(member=member)

    assert result["has_content_factory_access"] is True
