"""Add tenant_id and RLS session parameter support
-- Har request / transaction se pehle session parameter set karein
-- SET LOCAL app.tenant_id = 'your-tenant-uuid-here';

Revision ID: d5e89a23f110
Revises: c4f89d12a6e0
Create Date: 2026-10-05 09:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd5e89a23f110'
down_revision = 'c4f89d12a6e0'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add tenant_id column to tables
    tables = ['users', 'staff_requests', 'attendance_records', 'staff_duty_profiles', 'duty_allocations']
    for table_name in tables:
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.add_column(
                sa.Column('tenant_id', sa.String(length=100), nullable=True)
            )
            batch_op.create_index(f'idx_{table_name}_tenant_id', ['tenant_id'])

    # 2. Add helper function to set session parameter for current transaction
    op.execute("""
    CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id TEXT) 
    RETURNS VOID AS $$
    BEGIN
      PERFORM set_config('app.tenant_id', p_tenant_id, true);
    END;
    $$ LANGUAGE plpgsql;
    """)

    # 3. Enable Row-Level Security (RLS) on PostgreSQL
    try:
        op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE duty_allocations ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE staff_requests ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE staff_duty_profiles ENABLE ROW LEVEL SECURITY;")
        
        op.execute("""
        CREATE POLICY tenant_isolation_users ON users
          USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '');
        """)
        op.execute("""
        CREATE POLICY tenant_isolation_attendance ON attendance_records
          USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '');
        """)
        op.execute("""
        CREATE POLICY tenant_isolation_duty ON duty_allocations
          USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '');
        """)
    except Exception:
        pass


def downgrade():
    tables = ['users', 'staff_requests', 'attendance_records', 'staff_duty_profiles', 'duty_allocations']
    for table_name in tables:
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.drop_index(f'idx_{table_name}_tenant_id')
            batch_op.drop_column('tenant_id')
