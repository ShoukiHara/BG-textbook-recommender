"""baseline: 現在のDB全体の状態

Revision ID: 001
Revises:
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "instructors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "books",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("ai_guide_cache", sa.Text(), nullable=True),
        sa.Column("review_summary_cache", JSONB(), nullable=True),
        sa.UniqueConstraint("title", "subject"),
    )

    op.create_table(
        "reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("book_id", UUID(as_uuid=True),
                  sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("instructor_id", UUID(as_uuid=True),
                  sa.ForeignKey("instructors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("layer", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False, server_default=""),
        sa.Column("period", sa.Text(), nullable=False, server_default=""),
        sa.Column("before_connection", sa.Text(), nullable=False, server_default=""),
        sa.Column("after_connection", sa.Text(), nullable=False, server_default=""),
        sa.Column("usage_feel", sa.Text(), nullable=False, server_default=""),
        sa.Column("explanation_quality", sa.Text(), nullable=False, server_default=""),
        sa.Column("problem_volume", sa.Text(), nullable=False, server_default=""),
        sa.Column("strengthens_weaknesses", sa.Text(), nullable=False, server_default=""),
        sa.Column("target_deviation", sa.Text(), nullable=False, server_default=""),
        sa.Column("completion_period", sa.Text(), nullable=False, server_default=""),
        sa.Column("self_study_suitability", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("layer in (1, 2, 3)", name="reviews_layer_check"),
        sa.CheckConstraint("rating >= 0 and rating <= 5", name="reviews_rating_check"),
    )


def downgrade() -> None:
    op.drop_table("reviews")
    op.drop_table("books")
    op.drop_table("instructors")
