import unittest
import uuid
from types import SimpleNamespace

from app.services.permission_service import PermissionService


class TaskPermissionServiceTests(unittest.TestCase):
    def test_assignee_member_allowed_fields(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        task = SimpleNamespace(
            assignee_id=member.id,
            created_by_id=uuid.uuid4(),
            status="new",
        )

        allowed = PermissionService.allowed_task_edit_fields(member, task)

        self.assertEqual(allowed, {"status", "checklist", "title", "reminder_at", "reminder_comment"})
        self.assertTrue(PermissionService.can_create_task_for_others(member))
        self.assertTrue(PermissionService.can_edit_task(member, task))
        self.assertFalse(PermissionService.can_assign_task(member, task))
        self.assertTrue(PermissionService.can_change_task_status(member, task))
        self.assertTrue(PermissionService.can_add_task_update(member, task))
        self.assertTrue(PermissionService.can_manage_task_reminder(member, task))

    def test_author_member_allowed_fields_and_assign(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        task = SimpleNamespace(
            assignee_id=uuid.uuid4(),
            created_by_id=member.id,
            status="new",
        )

        allowed = PermissionService.allowed_task_edit_fields(member, task)

        self.assertEqual(
            allowed,
            {"status", "checklist", "title", "description", "priority", "deadline", "assignee_id"},
        )
        self.assertTrue(PermissionService.can_edit_task(member, task))
        self.assertTrue(PermissionService.can_assign_task(member, task))
        self.assertTrue(PermissionService.can_change_task_status(member, task))
        self.assertTrue(PermissionService.can_add_task_update(member, task))
        self.assertFalse(PermissionService.can_manage_task_reminder(member, task))

    def test_moderator_has_full_task_permissions(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        task = SimpleNamespace(
            assignee_id=uuid.uuid4(),
            created_by_id=uuid.uuid4(),
            status="new",
        )

        allowed = PermissionService.allowed_task_edit_fields(member, task)

        self.assertEqual(
            allowed,
            {
                "status",
                "checklist",
                "title",
                "description",
                "priority",
                "deadline",
                "assignee_id",
                "reminder_at",
                "reminder_comment",
            },
        )
        self.assertTrue(PermissionService.can_create_task_for_others(member))
        self.assertTrue(PermissionService.can_edit_task(member, task))
        self.assertTrue(PermissionService.can_assign_task(member, task))
        self.assertTrue(PermissionService.can_change_task_status(member, task))
        self.assertTrue(PermissionService.can_add_task_update(member, task))
        self.assertTrue(PermissionService.can_manage_task_reminder(member, task))

    def test_unrelated_member_has_no_edit_permissions(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        task = SimpleNamespace(
            assignee_id=uuid.uuid4(),
            created_by_id=uuid.uuid4(),
            status="new",
        )

        self.assertEqual(PermissionService.allowed_task_edit_fields(member, task), set())
        self.assertTrue(PermissionService.can_create_task_for_others(member))
        self.assertFalse(PermissionService.can_edit_task(member, task))
        self.assertFalse(PermissionService.can_assign_task(member, task))
        self.assertFalse(PermissionService.can_change_task_status(member, task))
        self.assertFalse(PermissionService.can_add_task_update(member, task))
        self.assertFalse(PermissionService.can_manage_task_reminder(member, task))

    def test_assignee_cannot_manage_reminder_for_closed_task(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        task = SimpleNamespace(
            assignee_id=member.id,
            created_by_id=uuid.uuid4(),
            status="done",
        )

        self.assertFalse(PermissionService.can_manage_task_reminder(member, task))

    def test_unknown_role_cannot_create_task_for_others(self) -> None:
        guest = SimpleNamespace(id=uuid.uuid4(), role="guest")
        self.assertFalse(PermissionService.can_create_task_for_others(guest))
