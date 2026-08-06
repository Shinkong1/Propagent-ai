"""property public listing opt-in flag

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'properties',
        sa.Column('is_public_listing', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('properties', 'is_public_listing')
