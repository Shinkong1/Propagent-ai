"""site_visits table (first-party website traffic) + organizations.signup_source

Revision ID: d3b7c9e1a5f2
Revises: e7f8a9b0c1d2
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d3b7c9e1a5f2"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "site_visits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("path", sa.String(300), nullable=False),
        sa.Column("is_entry", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source", sa.String(120), nullable=True),
        sa.Column("referrer_host", sa.String(200), nullable=True),
        sa.Column("utm_medium", sa.String(120), nullable=True),
        sa.Column("utm_campaign", sa.String(120), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("device", sa.String(10), nullable=True),
        sa.Column("visitor_hash", sa.String(64), nullable=True),
    )
    op.create_index("ix_site_visits_created_at", "site_visits", ["created_at"])
    op.add_column("organizations", sa.Column("signup_source", sa.String(160), nullable=True))


def downgrade():
    op.drop_column("organizations", "signup_source")
    op.drop_index("ix_site_visits_created_at", table_name="site_visits")
    op.drop_table("site_visits")
