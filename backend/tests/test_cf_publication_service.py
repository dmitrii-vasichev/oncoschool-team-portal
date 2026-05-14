import uuid
import unittest
from unittest.mock import AsyncMock
from types import SimpleNamespace

from app.services.content_factory.publication_service import PublicationService
from app.db.schemas import CFPublicationCreate, CFPublicationUpdate


class TestPublicationService(unittest.IsolatedAsyncioTestCase):
    async def test_create_publication_with_initial_version(self):
        """Creating a publication should also create version 1 with approval_event=drafted."""
        session = AsyncMock()
        session.add = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        payload = CFPublicationCreate(
            bundle_id=uuid.uuid4(), platform_id=uuid.uuid4(),
            format_id=uuid.uuid4(), responsible_id=uuid.uuid4(),
            body_text="Initial draft text",
        )
        result = await PublicationService.create(session, payload, editor_id=payload.responsible_id)

        self.assertEqual(result.status, "draft")
        self.assertEqual(result.version_number, 1)
        # session.add called twice: once for publication, once for version
        self.assertEqual(session.add.call_count, 2)

    async def test_update_publication_creates_version_on_body_change(self):
        session = AsyncMock()
        publication = SimpleNamespace(
            id=uuid.uuid4(), bundle_id=uuid.uuid4(), body_text="old", version_number=1,
            status="draft", title="t",
        )
        PublicationService.get = AsyncMock(return_value=publication)

        editor_id = uuid.uuid4()
        result = await PublicationService.update(
            session, publication.id,
            CFPublicationUpdate(body_text="new text"),
            editor_id=editor_id,
            approval_event="reviewed",
        )
        self.assertEqual(result.body_text, "new text")
        self.assertEqual(result.version_number, 2)


if __name__ == "__main__":
    unittest.main()
