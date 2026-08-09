"""rent payment overdue workflow flag

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-08-09 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, Sequence[str], None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('rent_payments', sa.Column('overdue_workflow_fired', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column('rent_payments', 'overdue_workflow_fired', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('rent_payments', 'overdue_workflow_fired')
