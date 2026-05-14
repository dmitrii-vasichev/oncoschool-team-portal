import uuid
from types import SimpleNamespace

from app.services.permission_service import PermissionService


def member(role: str = "member"):
    return SimpleNamespace(id=uuid.uuid4(), role=role, is_active=True)


def test_moderator_can_access_content_factory():
    assert PermissionService.can_access_content_factory(member("moderator")) is True
    assert PermissionService.can_access_content_factory(member("admin")) is True


def test_regular_member_cannot_access_content_factory():
    assert PermissionService.can_access_content_factory(member("member")) is False


def test_inactive_moderator_cannot_access_content_factory():
    m = member("moderator")
    m.is_active = False
    assert PermissionService.can_access_content_factory(m) is False


def test_moderator_can_approve_publication():
    assert PermissionService.can_approve_cf_publication(member("moderator")) is True


def test_regular_member_cannot_approve_publication():
    assert PermissionService.can_approve_cf_publication(member("member")) is False
