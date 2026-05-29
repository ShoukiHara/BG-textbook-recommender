"""drop comment from reviews

Revision ID: 002
Revises: 001
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("reviews", "comment")


def downgrade() -> None:
    op.add_column("reviews", sa.Column("comment", sa.Text(), nullable=False, server_default=""))
