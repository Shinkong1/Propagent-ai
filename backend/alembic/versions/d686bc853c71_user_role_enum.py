"""user role enum

Revision ID: d686bc853c71
Revises: 8e2343e1b88f
Create Date: 2026-08-02 23:53:53.370407

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd686bc853c71'
down_revision: Union[str, Sequence[str], None] = '8e2343e1b88f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    userrole = sa.Enum('owner', 'manager', 'staff', name='userrole')
    userrole.create(op.get_bind(), checkfirst=True)
    op.alter_column(
        'users', 'role',
        existing_type=sa.VARCHAR(length=50),
        type_=userrole,
        postgresql_using='role::userrole',
        nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'users', 'role',
        existing_type=sa.Enum('owner', 'manager', 'staff', name='userrole'),
        type_=sa.VARCHAR(length=50),
        nullable=True,
    )
    sa.Enum(name='userrole').drop(op.get_bind(), checkfirst=True)
