"""Add duty types and ot request fields

Revision ID: c4f89d12a6e0
Revises: b12a87ef43d1
Create Date: 2026-09-12 08:57:05.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c4f89d12a6e0'
down_revision = 'b12a87ef43d1'
branch_labels = None
depends_on = None


def upgrade():
    # =========================================================================
    # 1. Update 'users' table with duty allocation and reliever override fields
    # =========================================================================
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('duty_type', sa.String(length=30), nullable=False, server_default='FIXED')
        )
        batch_op.add_column(
            sa.Column('fixed_department', sa.String(length=50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('is_temp_reliever', sa.Boolean(), nullable=False, server_default=sa.text('false'))
        )
        batch_op.add_column(
            sa.Column('temp_department', sa.String(length=50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('raw_password_vault', sa.String(length=255), nullable=True)
        )

    # =========================================================================
    # 2. Update 'staff_requests' table (proposed shift)
    # =========================================================================
    with op.batch_alter_table('staff_requests', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('proposed_shift', sa.String(length=20), nullable=True, server_default='7-3')
        )

    # =========================================================================
    # 3. Update 'attendance_records' table with regular & overtime tracking fields
    # =========================================================================
    with op.batch_alter_table('attendance_records', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('regular_hours', sa.Float(), nullable=False, server_default='0.0')
        )
        batch_op.add_column(
            sa.Column('ot_hours', sa.Float(), nullable=False, server_default='0.0')
        )
        batch_op.add_column(
            sa.Column('ot_status', sa.String(length=20), nullable=False, server_default='NONE')
        )


def downgrade():
    # =========================================================================
    # Revert attendance_records columns
    # =========================================================================
    with op.batch_alter_table('attendance_records', schema=None) as batch_op:
        batch_op.drop_column('ot_status')
        batch_op.drop_column('ot_hours')
        batch_op.drop_column('regular_hours')

    # =========================================================================
    # Revert staff_requests columns
    # =========================================================================
    with op.batch_alter_table('staff_requests', schema=None) as batch_op:
        batch_op.drop_column('proposed_shift')

    # =========================================================================
    # Revert users columns
    # =========================================================================
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('raw_password_vault')
        batch_op.drop_column('temp_department')
        batch_op.drop_column('is_temp_reliever')
        batch_op.drop_column('fixed_department')
        batch_op.drop_column('duty_type')
