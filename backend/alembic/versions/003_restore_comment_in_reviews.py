"""restore comment column in reviews (legacy field for migrated data)

Revision ID: 003
Revises: 002
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reviews", sa.Column("comment", sa.Text(), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("reviews", "comment")
