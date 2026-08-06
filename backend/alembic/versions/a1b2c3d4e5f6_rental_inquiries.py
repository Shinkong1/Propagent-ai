"""rental inquiries table

Revision ID: a1b2c3d4e5f6
Revises: f4a5b6c7d8e9
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

inquiry_status_enum = postgresql.ENUM(
    'new', 'contacted', 'tour_scheduled', 'applied', 'converted', 'closed',
    name='inquirystatus',
)


def upgrade() -> None:
    """Upgrade schema."""
    inquiry_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'rental_inquiries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('property_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('properties.id'), nullable=False),
        sa.Column('unit_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('units.id'), nullable=True),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('desired_move_in', sa.Date(), nullable=True),
        sa.Column('status', inquiry_status_enum, nullable=False, server_default='new'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index(op.f('ix_rental_inquiries_organization_id'), 'rental_inquiries', ['organization_id'])
    op.create_index(op.f('ix_rental_inquiries_property_id'), 'rental_inquiries', ['property_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_rental_inquiries_property_id'), table_name='rental_inquiries')
    op.drop_index(op.f('ix_rental_inquiries_organization_id'), table_name='rental_inquiries')
    op.drop_table('rental_inquiries')
    inquiry_status_enum.drop(op.get_bind(), checkfirst=True)
