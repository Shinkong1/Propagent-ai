"""inquiry triage fields

Revision ID: b2c3d4e5f6b7
Revises: a1c2d3e4f5a6
Create Date: 2026-08-08 02:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6b7'
down_revision: Union[str, Sequence[str], None] = 'a1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('rental_inquiries', sa.Column('priority_label', sa.String(length=10), nullable=True))
    op.add_column('rental_inquiries', sa.Column('priority_score', sa.Integer(), nullable=True))
    op.add_column('rental_inquiries', sa.Column('priority_reasoning', sa.Text(), nullable=True))
    op.add_column('rental_inquiries', sa.Column('triaged_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('rental_inquiries', 'triaged_at')
    op.drop_column('rental_inquiries', 'priority_reasoning')
    op.drop_column('rental_inquiries', 'priority_score')
    op.drop_column('rental_inquiries', 'priority_label')
