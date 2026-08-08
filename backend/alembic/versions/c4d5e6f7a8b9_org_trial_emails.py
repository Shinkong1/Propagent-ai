"""org trial emails

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6b7
Create Date: 2026-08-07 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'org_trial_emails',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('milestone', sa.Enum(
            'day3_add_property', 'day7_checkin', 'day13_trial_ending',
            name='trialemailmilestone',
        ), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('organization_id', 'milestone', name='uq_org_trial_email_org_milestone'),
    )
    op.create_index(op.f('ix_org_trial_emails_organization_id'), 'org_trial_emails', ['organization_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_org_trial_emails_organization_id'), table_name='org_trial_emails')
    op.drop_table('org_trial_emails')
    sa.Enum(name='trialemailmilestone').drop(op.get_bind(), checkfirst=True)
