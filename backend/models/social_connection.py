"""Social media account connections + post history for automated listing
announcements. Facebook Page + Instagram Business Account are connected
together via Meta's Graph API (Facebook Login for Business); LinkedIn
Company Page is connected separately via LinkedIn's Marketing API. See
routes/social.py for the OAuth flows and services/social_posting_service.py
for the actual posting calls.

X/Twitter is intentionally NOT a supported platform here -- see
routes/social.py's module docstring for why.
"""
import builtins
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class SocialPlatform(enum.Enum):
    facebook = "facebook"
    instagram = "instagram"
    linkedin = "linkedin"


class SocialConnection(Base):
    """One connected Page/Account per (organization, platform, page_id).
    access_token_encrypted is Fernet-encrypted at rest (key derived from
    SECRET_KEY -- see social_posting_service._fernet) and is never included
    in any Pydantic response schema (see schemas/social.py)."""
    __tablename__ = "social_connections"
    __table_args__ = (
        UniqueConstraint("organization_id", "platform", "page_id", name="uq_social_conn_org_platform_page"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    platform = Column(SAEnum(SocialPlatform), nullable=False)
    access_token_encrypted = Column(Text, nullable=False)
    # FB Page ID / IG Business Account ID / LinkedIn organization URN (e.g. "urn:li:organization:12345").
    page_id = Column(String(255), nullable=False)
    page_name = Column(String(255), nullable=True)
    connected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    connected_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    disconnected_at = Column(DateTime, nullable=True)

    organization = relationship("Organization")
    connected_by = relationship("User")


class SocialPost(Base):
    """Real send history -- one row per attempted post (manual compose or
    auto-triggered from a listing going public), whether it succeeded or
    failed. Never fabricated: status/platform_post_id/error_message are
    exactly what services/social_posting_service.py got back from the
    platform's own API."""
    __tablename__ = "social_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("social_connections.id"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=True)
    message = Column(Text, nullable=False)
    image_url = Column(String(1000), nullable=True)
    link = Column(String(1000), nullable=True)  # URL attached as a link card (FB 'link' param / LinkedIn ARTICLE media)
    status = Column(String(20), nullable=False)  # 'posted' | 'failed'
    platform_post_id = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    trigger = Column(String(20), nullable=False, default="manual")  # 'manual' | 'auto_listing' | 'draft_approved'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # null for auto-triggered posts

    organization = relationship("Organization")
    connection = relationship("SocialConnection")
    property = relationship("Property")

    @builtins.property
    def platform(self) -> str:
        return self.connection.platform.value if self.connection else None


class SocialPostDraft(Base):
    """A queued post awaiting a human's explicit 'Approve & Post' click --
    this table never causes a real post by itself. Populated either by a
    person typing a draft manually (routes/social.py POST /social/drafts)
    or by the /internal/cron/social-draft-cadence job (see
    services.social_posting_service.generate_cadence_drafts), which queues
    one templated draft per org on a regular cadence so there's always
    something fresh ready to review instead of the account going silent
    between manual posts / new listings. Approving a draft
    (POST /social/drafts/{id}/approve) calls the exact same publish_post()
    the manual composer uses -- this table only ever adds a review step in
    front of that call, it never bypasses it or lets a cron job post on
    its own."""
    __tablename__ = "social_post_drafts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=True)
    message = Column(Text, nullable=False)
    image_url = Column(String(1000), nullable=True)
    link = Column(String(1000), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # 'pending' | 'approved' | 'discarded'
    source = Column(String(20), nullable=False, default="manual")  # 'manual' | 'cadence'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # null for cadence-generated drafts
    approved_at = Column(DateTime, nullable=True)
    approved_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    organization = relationship("Organization")
    property = relationship("Property")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])
