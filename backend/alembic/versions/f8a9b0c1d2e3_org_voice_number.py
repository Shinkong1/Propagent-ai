"""organization dedicated voice ai number

Revision ID: f8a9b0c1d2e3
Revises: e4f5a6b7c8d9
Create Date: 2026-08-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, Sequence[str], None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # E.164 phone number Twilio has provisioned for this org's Voice AI
    # calls, e.g. "+15125550101" -- null until the org buys the addon.
    op.add_column('organizations', sa.Column('voice_number', sa.String(length=20), nullable=True))
    # Twilio's own PhoneNumberSid for the number above -- needed to release
    # it via Twilio's API if the org ever cancels the addon, since Twilio
    # identifies numbers by SID, not the phone number string itself.
    op.add_column('organizations', sa.Column('voice_number_sid', sa.String(length=64), nullable=True))
    # Stripe subscription item ID for the addon charge, separate from the
    # org's main plan subscription_id -- lets the addon be canceled
    # independently of the base plan.
    op.add_column('organizations', sa.Column('voice_number_subscription_item_id', sa.String(length=255), nullable=True))
    op.create_index('ix_organizations_voice_number', 'organizations', ['voice_number'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_organizations_voice_number', table_name='organizations')
    op.drop_column('organizations', 'voice_number_subscription_item_id')
    op.drop_column('organizations', 'voice_number_sid')
    op.drop_column('organizations', 'voice_number')
