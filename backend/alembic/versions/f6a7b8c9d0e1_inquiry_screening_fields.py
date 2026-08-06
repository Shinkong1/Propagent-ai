"""inquiry screening fields

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('rental_inquiries', sa.Column('annual_income', sa.Float(), nullable=True))
    op.add_column('rental_inquiries', sa.Column('credit_score', sa.Float(), nullable=True))
    op.add_column('rental_inquiries', sa.Column('employment_status', sa.String(length=100), nullable=True))
    op.add_column('rental_inquiries', sa.Column('employer', sa.String(length=255), nullable=True))
    op.add_column('rental_inquiries', sa.Column('screening_approved', sa.Boolean(), nullable=True))
    op.add_column('rental_inquiries', sa.Column('screening_score', sa.Float(), nullable=True))
    op.add_column('rental_inquiries', sa.Column('screening_notes', sa.Text(), nullable=True))
    op.add_column('rental_inquiries', sa.Column('screened_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('rental_inquiries', 'screened_at')
    op.drop_column('rental_inquiries', 'screening_notes')
    op.drop_column('rental_inquiries', 'screening_score')
    op.drop_column('rental_inquiries', 'screening_approved')
    op.drop_column('rental_inquiries', 'employer')
    op.drop_column('rental_inquiries', 'employment_status')
    op.drop_column('rental_inquiries', 'credit_score')
    op.drop_column('rental_inquiries', 'annual_income')
