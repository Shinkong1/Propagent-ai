"""owner message reply fields

Revision ID: c1a2b3d4e5f6
Revises: b6e9733d2bc7
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'b6e9733d2bc7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('owner_messages', sa.Column('reply_body', sa.Text(), nullable=True))
    op.add_column('owner_messages', sa.Column('reply_status', sa.String(length=20), nullable=True))
    op.add_column('owner_messages', sa.Column('replied_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('owner_messages', 'replied_at')
    op.drop_column('owner_messages', 'reply_status')
    op.drop_column('owner_messages', 'reply_body')
