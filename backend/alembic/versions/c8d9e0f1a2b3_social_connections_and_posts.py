"""social connections and posts

Revision ID: c8d9e0f1a2b3
Revises: a2b3c4d5e6f7
Create Date: 2026-08-09 19:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, Sequence[str], None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    bind.execute(sa.text("DROP TABLE IF EXISTS social_posts"))
    bind.execute(sa.text("DROP TABLE IF EXISTS social_connections"))
    bind.execute(sa.text("DROP TYPE IF EXISTS socialplatform"))

    op.create_table(
        'social_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('platform', sa.Enum('facebook', 'instagram', 'linkedin', name='socialplatform'), nullable=False),
        sa.Column('access_token_encrypted', sa.Text(), nullable=False),
        sa.Column('page_id', sa.String(length=255), nullable=False),
        sa.Column('page_name', sa.String(length=255), nullable=True),
        sa.Column('connected_at', sa.DateTime(), nullable=False),
        sa.Column('connected_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('disconnected_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('organization_id', 'platform', 'page_id', name='uq_social_conn_org_platform_page'),
    )
    op.create_index(op.f('ix_social_connections_organization_id'), 'social_connections', ['organization_id'])

    op.create_table(
        'social_posts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('connection_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('social_connections.id'), nullable=False),
        sa.Column('property_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('properties.id'), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('image_url', sa.String(length=1000), nullable=True),
        sa.Column('link', sa.String(length=1000), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('platform_post_id', sa.String(length=255), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('trigger', sa.String(length=20), nullable=False, server_default='manual'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_index(op.f('ix_social_posts_organization_id'), 'social_posts', ['organization_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_social_posts_organization_id'), table_name='social_posts')
    op.drop_table('social_posts')
    op.drop_index(op.f('ix_social_connections_organization_id'), table_name='social_connections')
    op.drop_table('social_connections')
    sa.Enum(name='socialplatform').drop(op.get_bind(), checkfirst=True)
