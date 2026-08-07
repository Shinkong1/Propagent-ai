"""voice call inquiry attribution

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, Sequence[str], None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'voice_calls',
        sa.Column('inquiry_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('rental_inquiries.id'), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('voice_calls', 'inquiry_id')
