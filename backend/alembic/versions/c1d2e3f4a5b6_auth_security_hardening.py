"""auth security hardening: single-use reset tokens, account lockout, hashed API keys

Revision ID: c1d2e3f4a5b6
Revises: a9b0c1d2e3f4
Create Date: 2026-08-18 20:30:00.000000

"""
import hashlib
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'a9b0c1d2e3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # -- users: single-use password reset token marker + brute-force lockout --
    op.add_column('users', sa.Column('password_reset_jti', sa.String(length=32), nullable=True))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(), nullable=True))

    # -- organizations: move the API key from plaintext to a hashed digest --
    op.add_column('organizations', sa.Column('api_key_hash', sa.String(length=64), nullable=True))
    op.add_column('organizations', sa.Column('api_key_prefix', sa.String(length=20), nullable=True))
    op.add_column('organizations', sa.Column('api_key_created_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_organizations_api_key_hash'), 'organizations', ['api_key_hash'], unique=True)

    # Backfill: every org that already generated a key gets its hash/prefix
    # computed from the plaintext value while it's still here to read, so
    # existing integrations keep working with zero rotation required —
    # only the "view the full key again later" affordance goes away (same
    # tradeoff already accepted for user passwords and MFA backup codes in
    # this codebase, and the standard pattern for API keys everywhere).
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, api_key FROM organizations WHERE api_key IS NOT NULL")).fetchall()
    for org_id, api_key in rows:
        digest = hashlib.sha256(api_key.encode()).hexdigest()
        prefix = api_key[:12] + "…"
        bind.execute(
            sa.text(
                "UPDATE organizations SET api_key_hash = :h, api_key_prefix = :p, api_key_created_at = now() "
                "WHERE id = :id"
            ),
            {"h": digest, "p": prefix, "id": org_id},
        )

    op.drop_index(op.f('ix_organizations_api_key'), table_name='organizations')
    op.drop_column('organizations', 'api_key')


def downgrade() -> None:
    """Downgrade schema."""
    # Note: plaintext keys are not recoverable from their hash (by design) --
    # a downgrade restores the column but every org must regenerate a key.
    op.add_column('organizations', sa.Column('api_key', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_organizations_api_key'), 'organizations', ['api_key'], unique=True)

    op.drop_index(op.f('ix_organizations_api_key_hash'), table_name='organizations')
    op.drop_column('organizations', 'api_key_created_at')
    op.drop_column('organizations', 'api_key_prefix')
    op.drop_column('organizations', 'api_key_hash')

    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'password_reset_jti')
