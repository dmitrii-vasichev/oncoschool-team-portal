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

    async def test_update_publication_creates_history_on_status_change(self):
        session = AsyncMock()
        publication = SimpleNamespace(
            id=uuid.uuid4(),
            bundle_id=uuid.uuid4(),
            body_text="ready text",
            version_number=1,
            status="needs_copy",
            title="t",
        )
        PublicationService.get = AsyncMock(return_value=publication)

        editor_id = uuid.uuid4()
        result = await PublicationService.update(
            session,
            publication.id,
            CFPublicationUpdate(status="factcheck"),
            editor_id=editor_id,
        )

        self.assertEqual(result.status, "factcheck")
        self.assertEqual(result.version_number, 2)
        version = session.add.call_args.args[0]
        self.assertEqual(version.version_number, 2)
        self.assertEqual(version.body_text, "ready text")
        self.assertEqual(version.edited_by_id, editor_id)
        self.assertEqual(version.approval_event, "reviewed")
        self.assertEqual(version.notes, "Статус: Нужен текст -> Фактчек")

    async def test_update_publication_body_and_status_creates_one_history_row(self):
        session = AsyncMock()
        publication = SimpleNamespace(
            id=uuid.uuid4(),
            bundle_id=uuid.uuid4(),
            body_text="old",
            version_number=1,
            status="doctor_review",
            title="t",
        )
        PublicationService.get = AsyncMock(return_value=publication)

        editor_id = uuid.uuid4()
        result = await PublicationService.update(
            session,
            publication.id,
            CFPublicationUpdate(body_text="new", status="approved"),
            editor_id=editor_id,
            approval_event="doctor_approved",
        )

        self.assertEqual(result.body_text, "new")
        self.assertEqual(result.status, "approved")
        self.assertEqual(result.version_number, 2)
        self.assertEqual(session.add.call_count, 1)
        version = session.add.call_args.args[0]
        self.assertEqual(version.body_text, "new")
        self.assertEqual(version.approval_event, "doctor_approved")
        self.assertEqual(version.notes, "Статус: Проверка врача -> Одобрено")

    async def test_update_publication_metadata_without_body_version(self):
        session = AsyncMock()
        platform_id = uuid.uuid4()
        format_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        nosology_id = uuid.uuid4()
        responsible_id = uuid.uuid4()
        publication = SimpleNamespace(
            id=uuid.uuid4(),
            bundle_id=uuid.uuid4(),
            platform_id=uuid.uuid4(),
            format_id=uuid.uuid4(),
            rubric_id=None,
            nosology_id=None,
            responsible_id=uuid.uuid4(),
            body_text="stable body",
            version_number=1,
            status="draft",
            title="t",
        )
        PublicationService.get = AsyncMock(return_value=publication)

        result = await PublicationService.update(
            session,
            publication.id,
            CFPublicationUpdate(
                platform_id=platform_id,
                format_id=format_id,
                rubric_id=rubric_id,
                nosology_id=nosology_id,
                responsible_id=responsible_id,
            ),
            editor_id=responsible_id,
            approval_event="reviewed",
        )

        self.assertEqual(result.platform_id, platform_id)
        self.assertEqual(result.format_id, format_id)
        self.assertEqual(result.rubric_id, rubric_id)
        self.assertEqual(result.nosology_id, nosology_id)
        self.assertEqual(result.responsible_id, responsible_id)
        self.assertEqual(result.version_number, 1)
        session.add.assert_not_called()


if __name__ == "__main__":
    unittest.main()
