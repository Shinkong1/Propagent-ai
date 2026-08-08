"""referral reward fields

Revision ID: c5d6e7f8a9b0
Revises: c4d5e6f7a8b9
Create Date: 2026-08-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, Sequence[str], None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('organizations', sa.Column('referral_credits_earned', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('organizations', sa.Column('referral_reward_granted', sa.Boolean(), nullable=False, server_default='false'))
    # New OrgEventType member (models/platform.py) -- Postgres native enums
    # require an explicit ALTER TYPE to add a value; adding it to the Python
    # enum alone doesn't touch the DB-level type.
    op.execute("ALTER TYPE orgeventtype ADD VALUE IF NOT EXISTS 'referral_reward_granted'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres has no ALTER TYPE ... DROP VALUE -- removing an enum value
    # requires rebuilding the type, which isn't worth doing for a downgrade
    # path. The unused value is harmless to leave behind.
    op.drop_column('organizations', 'referral_reward_granted')
    op.drop_column('organizations', 'referral_credits_earned')
