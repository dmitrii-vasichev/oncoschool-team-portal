"""Service for Content module access control."""

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ContentAccess, ContentRole, ContentSubSection, TeamMember
from app.db.repositories import ContentAccessRepository

logger = logging.getLogger(__name__)

_repo = ContentAccessRepository()


class ContentAccessService:
    @staticmethod
    async def has_access(
        session: AsyncSession,
        member: TeamMember,
        sub_section: ContentSubSection,
    ) -> ContentRole | None:
        """Check if member has access to a content sub-section.

        Checks direct member_id match and department_id match.
        Returns highest role (editor > operator) or None.
        """
        # Admins have implicit editor access to everything
        if member.role == "admin":
            return ContentRole.editor

        department_ids = []
        if member.department_id:
            department_ids.append(member.department_id)
        department_ids.extend(member.extra_department_ids)

        grants = await _repo.get_access_for_member(
            session, member.id, department_ids, sub_section
        )
        if not grants:
            return None

        # Return highest role
        roles = {g.role for g in grants}
        if ContentRole.editor in roles:
            return ContentRole.editor
        return ContentRole.operator

    @staticmethod
    async def is_editor(
        session: AsyncSession,
        member: TeamMember,
        sub_section: ContentSubSection,
    ) -> bool:
        role = await ContentAccessService.has_access(session, member, sub_section)
        return role == ContentRole.editor

    @staticmethod
    async def is_operator_or_editor(
        session: AsyncSession,
        member: TeamMember,
        sub_section: ContentSubSection,
    ) -> bool:
        role = await ContentAccessService.has_access(session, member, sub_section)
        return role is not None

    @staticmethod
    async def grant_access(
        session: AsyncSession,
        sub_section: ContentSubSection,
        role: ContentRole,
        member_id: uuid.UUID | None = None,
        department_id: uuid.UUID | None = None,
    ) -> ContentAccess:
        return await _repo.grant(
            session,
            sub_section=sub_section,
            role=role,
            member_id=member_id,
            department_id=department_id,
        )

    @staticmethod
    async def revoke_access(session: AsyncSession, access_id: uuid.UUID) -> bool:
        return await _repo.revoke(session, access_id)

    @staticmethod
    async def list_access(
        session: AsyncSession,
        sub_section: ContentSubSection | None = None,
    ) -> list[ContentAccess]:
        return await _repo.get_all(session, sub_section)

    @staticmethod
    async def can_access_any_content(
        session: AsyncSession,
        member: TeamMember,
    ) -> bool:
        """Check if member has access to ANY content sub-section (for sidebar visibility)."""
        if member.role == "admin":
            return True

        department_ids = []
        if member.department_id:
            department_ids.append(member.department_id)
        department_ids.extend(member.extra_department_ids)

        grants = await _repo.get_access_for_member(
            session, member.id, department_ids
        )
        return len(grants) > 0
