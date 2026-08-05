"""tenant portal auth + stripe connect fields

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, Sequence[str], None] = 'e3f4a5b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tenants', sa.Column('hashed_password', sa.String(length=255), nullable=True))
    op.add_column('tenants', sa.Column('portal_invite_token', sa.String(length=255), nullable=True))
    op.add_column('tenants', sa.Column('portal_invite_expires_at', sa.DateTime(), nullable=True))
    op.add_column('tenants', sa.Column('portal_invited_at', sa.DateTime(), nullable=True))
    op.add_column('tenants', sa.Column('portal_activated_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_tenants_portal_invite_token'), 'tenants', ['portal_invite_token'], unique=True)

    op.add_column('organizations', sa.Column('stripe_connect_account_id', sa.String(length=255), nullable=True))
    op.add_column('organizations', sa.Column('stripe_connect_onboarded', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('organizations', 'stripe_connect_onboarded')
    op.drop_column('organizations', 'stripe_connect_account_id')

    op.drop_index(op.f('ix_tenants_portal_invite_token'), table_name='tenants')
    op.drop_column('tenants', 'portal_activated_at')
    op.drop_column('tenants', 'portal_invited_at')
    op.drop_column('tenants', 'portal_invite_expires_at')
    op.drop_column('tenants', 'portal_invite_token')
    op.drop_column('tenants', 'hashed_password')
