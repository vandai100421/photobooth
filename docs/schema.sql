-- =============================================================================
-- TAP Photobooth Management — Database Schema Migration
-- Target: PostgreSQL 15+ (Supabase)
-- Version: 1.0.0
--
-- This script creates the complete database schema for the photobooth
-- management system: 11 tables, indexes, triggers, RLS policies, and
-- baseline seed data.
--
-- Run order: fresh database (idempotent where supported).
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

-- pgcrypto provides gen_random_uuid() for UUID primary keys.
-- On PG13+ gen_random_uuid() is built-in, but we enable pgcrypto explicitly
-- for compatibility and to support any legacy pgcrypto functions.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- 2. UTILITY FUNCTIONS
-- =============================================================================

-- Auto-refresh updated_at on every UPDATE.
-- Attached via BEFORE UPDATE trigger to every table that has an updated_at column.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- 3. TABLES  (created in FK dependency order)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1  employees
--      Staff accounts. Soft-deleted via deleted_at (never hard-delete to
--      preserve referential integrity for shifts, bookings, vouchers, posts).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(255)  NOT NULL,
  phone         VARCHAR(20)   UNIQUE NOT NULL,
  email         VARCHAR(255),
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(20)   NOT NULL
    CHECK (role IN ('admin', 'manager', 'staff')),
  avatar_url    TEXT,
  is_active     BOOLEAN       DEFAULT TRUE,
  hire_date     DATE,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3.2  customers
--      End customers (guests who use the photobooth).
--      total_visits / total_spent are maintained by a trigger on bookings.
--      Soft-deleted via deleted_at.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(255)  NOT NULL,
  phone         VARCHAR(20)   UNIQUE NOT NULL,
  email         VARCHAR(255),
  birthday      DATE,
  gender        VARCHAR(10)
    CHECK (gender IN ('male', 'female', 'other')),
  zalo_id       VARCHAR(100),
  total_visits  INTEGER       DEFAULT 0
    CHECK (total_visits >= 0),
  total_spent   DECIMAL(12,2) DEFAULT 0
    CHECK (total_spent >= 0),
  status        VARCHAR(20)   DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'vip')),
  registered_at TIMESTAMPTZ   DEFAULT NOW(),
  last_visit_at TIMESTAMPTZ,
  notes         TEXT,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3.3  message_templates
--      Reusable message bodies with {{variable}} placeholders.
--      Created before holidays / message_logs which reference it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_templates (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255)  NOT NULL,
  occasion   VARCHAR(20)   NOT NULL
    CHECK (occasion IN (
      'birthday', 'tet', 'giangsinh', '8_3', '20_10',
      'valentine', 'promo', 'welcome', 'custom'
    )),
  channel    VARCHAR(10)   NOT NULL
    CHECK (channel IN ('zalo', 'email', 'sms')),
  subject    VARCHAR(255),
  body       TEXT          NOT NULL,
  is_active  BOOLEAN       DEFAULT TRUE,
  created_at TIMESTAMPTZ   DEFAULT NOW(),
  updated_at TIMESTAMPTZ   DEFAULT NOW()
);

-- Unique constraint on (name, channel) so seed data is idempotent on re-run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_templates_name_channel_key'
  ) THEN
    ALTER TABLE public.message_templates
      ADD CONSTRAINT message_templates_name_channel_key UNIQUE (name, channel);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3.4  vouchers
--      Voucher definitions (templates). total_quantity = -1 means unlimited.
--      issued to customers via customer_vouchers.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vouchers (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50)   UNIQUE NOT NULL,
  name           VARCHAR(255)  NOT NULL,
  type           VARCHAR(20)   NOT NULL
    CHECK (type IN ('birthday', 'holiday', 'promo', 'welcome')),
  discount_type  VARCHAR(10)   NOT NULL
    CHECK (discount_type IN ('percent', 'fixed')),
  value          DECIMAL(12,2) NOT NULL
    CHECK (value >= 0),
  min_order      DECIMAL(12,2) DEFAULT 0
    CHECK (min_order >= 0),
  max_discount   DECIMAL(12,2),
  total_quantity INTEGER       DEFAULT -1
    CHECK (total_quantity >= -1),
  used_count     INTEGER       DEFAULT 0
    CHECK (used_count >= 0),
  valid_from     DATE          NOT NULL,
  valid_until    DATE          NOT NULL,
  is_active      BOOLEAN       DEFAULT TRUE,
  per_customer   INTEGER       DEFAULT 1
    CHECK (per_customer >= 1),
  created_by     UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW(),
  CONSTRAINT vouchers_valid_range CHECK (valid_until >= valid_from)
);

-- -----------------------------------------------------------------------------
-- 3.5  shifts
--      Work shifts assigned to employees. Includes check-in/out tracking.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID        NOT NULL
    REFERENCES public.employees(id) ON DELETE CASCADE,
  date           DATE        NOT NULL,
  start_time     TIMESTAMPTZ NOT NULL,
  end_time       TIMESTAMPTZ NOT NULL,
  check_in_time  TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  status         VARCHAR(20) DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'absent')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT shifts_time_order CHECK (end_time > start_time)
);

-- -----------------------------------------------------------------------------
-- 3.6  bookings
--      Photobooth sessions. voucher_id FK to customer_vouchers is added
--      AFTER customer_vouchers is created (circular dependency).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID          NOT NULL
    REFERENCES public.customers(id) ON DELETE RESTRICT,
  employee_id  UUID
    REFERENCES public.employees(id) ON DELETE SET NULL,
  booking_date TIMESTAMPTZ   NOT NULL,
  package_name VARCHAR(255),
  amount       DECIMAL(12,2) DEFAULT 0
    CHECK (amount >= 0),
  status       VARCHAR(20)   DEFAULT 'completed'
    CHECK (status IN ('completed', 'cancelled', 'no-show')),
  voucher_id   UUID,
  photo_count  INTEGER       DEFAULT 0
    CHECK (photo_count >= 0),
  notes        TEXT,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3.7  customer_vouchers
--      Vouchers issued to specific customers. booking_id records which
--      booking consumed the voucher (back-reference to bookings).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_vouchers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID        NOT NULL
    REFERENCES public.customers(id) ON DELETE CASCADE,
  voucher_id       UUID        NOT NULL
    REFERENCES public.vouchers(id) ON DELETE CASCADE,
  status           VARCHAR(20) DEFAULT 'issued'
    CHECK (status IN ('issued', 'used', 'expired')),
  issued_at        TIMESTAMPTZ DEFAULT NOW(),
  used_at          TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  booking_id       UUID
    REFERENCES public.bookings(id) ON DELETE SET NULL,
  zalo_message_id  VARCHAR(100),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3.8  posts
--      Marketing posts / articles. Soft-deleted via deleted_at.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(255)  NOT NULL,
  slug         VARCHAR(255)  UNIQUE NOT NULL,
  content      TEXT          NOT NULL,
  excerpt      VARCHAR(500),
  image_url    TEXT,
  status       VARCHAR(20)   DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'published')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  author_id    UUID
    REFERENCES public.employees(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3.9  holidays
--      Recurring date-based holidays for automated messaging.
--      date is VARCHAR(5) in MM-DD format so recurring holidays don't need
--      a year component.  specific_year overrides for one-off holidays.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.holidays (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  date          VARCHAR(5)   NOT NULL
    CHECK (date ~ '^\d{2}-\d{2}$'),
  is_recurring  BOOLEAN      DEFAULT TRUE,
  specific_year INTEGER,
  template_id   UUID
    REFERENCES public.message_templates(id) ON DELETE SET NULL,
  is_active     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Unique constraint on (name, date) so seed data is idempotent on re-run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'holidays_name_date_key'
  ) THEN
    ALTER TABLE public.holidays ADD CONSTRAINT holidays_name_date_key UNIQUE (name, date);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3.10  message_logs
--       Audit trail of every message sent (or attempted) via Zalo / Email.
--       No updated_at — logs are append-only.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID        NOT NULL
    REFERENCES public.customers(id) ON DELETE CASCADE,
  template_id   UUID
    REFERENCES public.message_templates(id) ON DELETE SET NULL,
  voucher_id    UUID
    REFERENCES public.vouchers(id) ON DELETE SET NULL,
  channel       VARCHAR(10) NOT NULL
    CHECK (channel IN ('zalo', 'email', 'sms')),
  status        VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  content_sent  TEXT,
  error_message TEXT,
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3.11  settings
--       Key-value application settings (Zalo OA, Gmail, shop config).
--       No created_at — only updated_at (settings are mutated, not appended).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) UNIQUE NOT NULL,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);


-- =============================================================================
-- 4. INDEXES
--    UNIQUE constraints above already created implicit indexes on:
--    employees.phone, customers.phone, vouchers.code, posts.slug,
--    settings.key.  Below are the additional indexes for query performance.
-- =============================================================================

-- employees
CREATE INDEX IF NOT EXISTS idx_employees_role      ON public.employees (role);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON public.employees (is_active);
CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON public.employees (deleted_at);

-- shifts
CREATE INDEX IF NOT EXISTS idx_shifts_employee_id ON public.shifts (employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date        ON public.shifts (date);
CREATE INDEX IF NOT EXISTS idx_shifts_status      ON public.shifts (status);

-- customers
CREATE INDEX IF NOT EXISTS idx_customers_birthday ON public.customers (birthday);
CREATE INDEX IF NOT EXISTS idx_customers_status   ON public.customers (status);
CREATE INDEX IF NOT EXISTS idx_customers_zalo_id  ON public.customers (zalo_id);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers (deleted_at);

-- bookings
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id  ON public.bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_employee_id  ON public.bookings (employee_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON public.bookings (booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_voucher_id   ON public.bookings (voucher_id);

-- vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_type       ON public.vouchers (type);
CREATE INDEX IF NOT EXISTS idx_vouchers_is_active  ON public.vouchers (is_active);
CREATE INDEX IF NOT EXISTS idx_vouchers_valid_until ON public.vouchers (valid_until);

-- customer_vouchers
CREATE INDEX IF NOT EXISTS idx_customer_vouchers_customer_id ON public.customer_vouchers (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_vouchers_voucher_id  ON public.customer_vouchers (voucher_id);
CREATE INDEX IF NOT EXISTS idx_customer_vouchers_status      ON public.customer_vouchers (status);
CREATE INDEX IF NOT EXISTS idx_customer_vouchers_expires_at  ON public.customer_vouchers (expires_at);

-- posts
CREATE INDEX IF NOT EXISTS idx_posts_status       ON public.posts (status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts (published_at);
CREATE INDEX IF NOT EXISTS idx_posts_author_id    ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at   ON public.posts (deleted_at);

-- holidays
CREATE INDEX IF NOT EXISTS idx_holidays_date        ON public.holidays (date);
CREATE INDEX IF NOT EXISTS idx_holidays_is_active   ON public.holidays (is_active);
CREATE INDEX IF NOT EXISTS idx_holidays_is_recurring ON public.holidays (is_recurring);

-- message_templates
CREATE INDEX IF NOT EXISTS idx_message_templates_occasion  ON public.message_templates (occasion);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel   ON public.message_templates (channel);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON public.message_templates (is_active);

-- message_logs  (composite index on scheduled_at + status for the cron
-- scheduler's most common query: "find pending messages due now")
CREATE INDEX IF NOT EXISTS idx_message_logs_scheduled_status ON public.message_logs (scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_message_logs_customer_id      ON public.message_logs (customer_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status           ON public.message_logs (status);
CREATE INDEX IF NOT EXISTS idx_message_logs_channel          ON public.message_logs (channel);


-- =============================================================================
-- 5. CIRCULAR FOREIGN KEY
--    bookings.voucher_id → customer_vouchers.id
--    Could not be declared inline because customer_vouchers didn't exist
--    when bookings was created.  Both sides are nullable so no deferral needed.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bookings_voucher_id_fkey'
      AND table_name = 'bookings'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_voucher_id_fkey
      FOREIGN KEY (voucher_id) REFERENCES public.customer_vouchers(id)
      ON DELETE SET NULL;
  END IF;
END $$;


-- =============================================================================
-- 6. TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6.1  updated_at triggers — one per table that has an updated_at column.
--      message_logs is excluded (append-only, no updated_at).
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'employees',
    'shifts',
    'customers',
    'bookings',
    'vouchers',
    'customer_vouchers',
    'posts',
    'holidays',
    'message_templates',
    'settings'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON public.%s
         FOR EACH ROW
         EXECUTE FUNCTION public.update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 6.2  Customer stats trigger on bookings
--      Keeps customers.total_visits, total_spent, last_visit_at in sync
--      whenever a completed booking is inserted or its status changes.
--
--      Cases handled:
--        INSERT  + status='completed'          → increment stats
--        UPDATE  → 'completed' (was other)     → increment stats
--        UPDATE  → other (was 'completed')     → revert stats
--        UPDATE  still 'completed', amount changed → adjust difference
--
--      NOTE: Changing customer_id on a completed booking is not auto-handled.
--      The application should avoid reassigning completed bookings to a
--      different customer; if needed, revert old then apply new manually.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_customer_stats_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN
    UPDATE public.customers
    SET total_visits  = total_visits + 1,
        total_spent   = total_spent + COALESCE(NEW.amount, 0),
        last_visit_at = NEW.booking_date
    WHERE id = NEW.customer_id;

  ELSIF (TG_OP = 'UPDATE') THEN

    -- Transitioned TO completed
    IF (NEW.status = 'completed' AND OLD.status <> 'completed') THEN
      UPDATE public.customers
      SET total_visits  = total_visits + 1,
          total_spent   = total_spent + COALESCE(NEW.amount, 0),
          last_visit_at = NEW.booking_date
      WHERE id = NEW.customer_id;

    -- Transitioned FROM completed (e.g. cancelled / no-show after the fact)
    ELSIF (NEW.status <> 'completed' AND OLD.status = 'completed') THEN
      UPDATE public.customers
      SET total_visits = GREATEST(total_visits - 1, 0),
          total_spent  = GREATEST(total_spent - COALESCE(OLD.amount, 0), 0)
      WHERE id = OLD.customer_id;

    -- Still completed but amount was corrected
    ELSIF (NEW.status = 'completed' AND OLD.status = 'completed'
           AND COALESCE(NEW.amount, 0) <> COALESCE(OLD.amount, 0)) THEN
      UPDATE public.customers
      SET total_spent   = total_spent
                       + (COALESCE(NEW.amount, 0) - COALESCE(OLD.amount, 0)),
          last_visit_at = NEW.booking_date
      WHERE id = NEW.customer_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_customer_stats ON public.bookings;
CREATE TRIGGER trg_bookings_customer_stats
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_stats_on_booking();


-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7.1  Helper: current_employee_role()
--      Returns the role string of the authenticated user by looking up
--      auth.uid() in the employees table.  Marked SECURITY DEFINER so it
--      bypasses RLS (otherwise we'd have a chicken-and-egg problem: RLS on
--      employees needs to read employees to determine the role).
--
--      Assumes employees.id = auth.users.id (Supabase Auth user UUID is
--      stored as the employee UUID at sign-up time).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_employee_role()
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT e.role INTO v_role
  FROM public.employees e
  WHERE e.id = auth.uid()
    AND e.deleted_at IS NULL;
  RETURN v_role;
END;
$$;


-- -----------------------------------------------------------------------------
-- 7.2  Enable RLS on every table
-- -----------------------------------------------------------------------------
ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_vouchers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 7.3  RLS Policies
--
--      Role matrix:
--      ┌──────────┬───────────────────┬──────────────────┬───────────────┐
--      │ Table    │ admin             │ manager          │ staff         │
--      ├──────────┼───────────────────┼──────────────────┼───────────────┤
--      │ employees│ ALL               │ SELECT, UPDATE   │ SELECT        │
--      │ shifts   │ ALL               │ SELECT           │ SELECT        │
--      │ customers│ ALL               │ SELECT,INS,UPD   │ SELECT,INS,UPD│
--      │ bookings │ ALL               │ SELECT,INS,UPD   │ SELECT,INS,UPD│
--      │ vouchers │ ALL               │ SELECT,INS,UPD   │ SELECT,INS,UPD│
--      │ cust_vouc│ ALL               │ SELECT,INS,UPD   │ SELECT,INS,UPD│
--      │ posts    │ ALL               │ SELECT           │ SELECT        │
--      │ holidays │ ALL               │ SELECT           │ SELECT        │
--      │ templates│ ALL               │ SELECT           │ SELECT        │
--      │ msg_logs │ ALL               │ SELECT           │ SELECT        │
--      │ settings │ ALL               │ SELECT           │ SELECT        │
--      └──────────┴───────────────────┴──────────────────┴───────────────┘
--
--      The service_role key (used by cron / backend) bypasses RLS entirely,
--      so automated jobs can INSERT into message_logs etc. without policies.
-- -----------------------------------------------------------------------------


-- =============== employees ===============
-- All authenticated employees can browse the staff directory
DROP POLICY IF EXISTS employees_select_all ON public.employees;
CREATE POLICY employees_select_all
  ON public.employees FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

-- Admin: full CRUD
DROP POLICY IF EXISTS employees_admin_all ON public.employees;
CREATE POLICY employees_admin_all
  ON public.employees FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');

-- Manager: can update employee info (e.g. assign shifts, toggle active)
DROP POLICY IF EXISTS employees_manager_update ON public.employees;
CREATE POLICY employees_manager_update
  ON public.employees FOR UPDATE
  USING (public.current_employee_role() = 'manager')
  WITH CHECK (public.current_employee_role() = 'manager');


-- =============== shifts ===============
DROP POLICY IF EXISTS shifts_select_all ON public.shifts;
CREATE POLICY shifts_select_all
  ON public.shifts FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS shifts_admin_all ON public.shifts;
CREATE POLICY shifts_admin_all
  ON public.shifts FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============== customers ===============
-- Read: all staff levels
DROP POLICY IF EXISTS customers_select_all ON public.customers;
CREATE POLICY customers_select_all
  ON public.customers FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

-- Admin: full CRUD
DROP POLICY IF EXISTS customers_admin_all ON public.customers;
CREATE POLICY customers_admin_all
  ON public.customers FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');

-- Manager + staff: create and update (no delete — protect customer data)
DROP POLICY IF EXISTS customers_staff_insert ON public.customers;
CREATE POLICY customers_staff_insert
  ON public.customers FOR INSERT
  WITH CHECK (public.current_employee_role() IN ('manager', 'staff'));

DROP POLICY IF EXISTS customers_staff_update ON public.customers;
CREATE POLICY customers_staff_update
  ON public.customers FOR UPDATE
  USING (public.current_employee_role() IN ('manager', 'staff'))
  WITH CHECK (public.current_employee_role() IN ('manager', 'staff'));


-- =============== bookings ===============
DROP POLICY IF EXISTS bookings_select_all ON public.bookings;
CREATE POLICY bookings_select_all
  ON public.bookings FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS bookings_admin_all ON public.bookings;
CREATE POLICY bookings_admin_all
  ON public.bookings FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');

DROP POLICY IF EXISTS bookings_staff_insert ON public.bookings;
CREATE POLICY bookings_staff_insert
  ON public.bookings FOR INSERT
  WITH CHECK (public.current_employee_role() IN ('manager', 'staff'));

DROP POLICY IF EXISTS bookings_staff_update ON public.bookings;
CREATE POLICY bookings_staff_update
  ON public.bookings FOR UPDATE
  USING (public.current_employee_role() IN ('manager', 'staff'))
  WITH CHECK (public.current_employee_role() IN ('manager', 'staff'));


-- =============== vouchers ===============
DROP POLICY IF EXISTS vouchers_select_all ON public.vouchers;
CREATE POLICY vouchers_select_all
  ON public.vouchers FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS vouchers_admin_all ON public.vouchers;
CREATE POLICY vouchers_admin_all
  ON public.vouchers FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');

DROP POLICY IF EXISTS vouchers_staff_insert ON public.vouchers;
CREATE POLICY vouchers_staff_insert
  ON public.vouchers FOR INSERT
  WITH CHECK (public.current_employee_role() IN ('manager', 'staff'));

DROP POLICY IF EXISTS vouchers_staff_update ON public.vouchers;
CREATE POLICY vouchers_staff_update
  ON public.vouchers FOR UPDATE
  USING (public.current_employee_role() IN ('manager', 'staff'))
  WITH CHECK (public.current_employee_role() IN ('manager', 'staff'));


-- =============== customer_vouchers ===============
DROP POLICY IF EXISTS customer_vouchers_select_all ON public.customer_vouchers;
CREATE POLICY customer_vouchers_select_all
  ON public.customer_vouchers FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS customer_vouchers_admin_all ON public.customer_vouchers;
CREATE POLICY customer_vouchers_admin_all
  ON public.customer_vouchers FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');

DROP POLICY IF EXISTS customer_vouchers_staff_insert ON public.customer_vouchers;
CREATE POLICY customer_vouchers_staff_insert
  ON public.customer_vouchers FOR INSERT
  WITH CHECK (public.current_employee_role() IN ('manager', 'staff'));

DROP POLICY IF EXISTS customer_vouchers_staff_update ON public.customer_vouchers;
CREATE POLICY customer_vouchers_staff_update
  ON public.customer_vouchers FOR UPDATE
  USING (public.current_employee_role() IN ('manager', 'staff'))
  WITH CHECK (public.current_employee_role() IN ('manager', 'staff'));


-- =============== posts ===============
DROP POLICY IF EXISTS posts_select_all ON public.posts;
CREATE POLICY posts_select_all
  ON public.posts FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS posts_admin_all ON public.posts;
CREATE POLICY posts_admin_all
  ON public.posts FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============== holidays ===============
DROP POLICY IF EXISTS holidays_select_all ON public.holidays;
CREATE POLICY holidays_select_all
  ON public.holidays FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS holidays_admin_all ON public.holidays;
CREATE POLICY holidays_admin_all
  ON public.holidays FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============== message_templates ===============
DROP POLICY IF EXISTS templates_select_all ON public.message_templates;
CREATE POLICY templates_select_all
  ON public.message_templates FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS templates_admin_all ON public.message_templates;
CREATE POLICY templates_admin_all
  ON public.message_templates FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============== message_logs ===============
DROP POLICY IF EXISTS message_logs_select_all ON public.message_logs;
CREATE POLICY message_logs_select_all
  ON public.message_logs FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS message_logs_admin_all ON public.message_logs;
CREATE POLICY message_logs_admin_all
  ON public.message_logs FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============== settings ===============
-- All staff can read settings (needed for shop_name, cron config, etc.)
-- NOTE: settings may contain sensitive values (gmail_app_password).
-- Consider restricting sensitive keys at the application layer if needed.
DROP POLICY IF EXISTS settings_select_all ON public.settings;
CREATE POLICY settings_select_all
  ON public.settings FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS settings_admin_all ON public.settings;
CREATE POLICY settings_admin_all
  ON public.settings FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============================================================================
-- 8. SEED DATA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 8.1  Default application settings
--      Values left empty for secrets — populate via UI / env after deploy.
-- -----------------------------------------------------------------------------
INSERT INTO public.settings (key, value, description) VALUES
  ('zalo_oa_id',         '',                'Zalo Official Account ID for sending messages'),
  ('gmail_address',      '',                'Gmail address used as SMTP sender'),
  ('gmail_app_password', '',                'Gmail App Password for SMTP authentication'),
  ('shop_name',          'TAP Photobooth',  'Display name of the photobooth shop'),
  ('cron_schedule',      '0 8 * * *',       'node-cron expression for daily automation jobs (8:00 AM)'),
  ('voucher_expiry_days','7',               'Number of days before an issued voucher expires')
ON CONFLICT (key) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 8.2  Vietnamese holidays (recurring, MM-DD format)
--      These drive the holiday broadcast cron job.
-- -----------------------------------------------------------------------------
INSERT INTO public.holidays (name, date, is_recurring, specific_year, is_active) VALUES
  ('Tết Dương Lịch',          '01-01', TRUE, NULL, TRUE),
  ('Quốc tế Phụ nữ',          '03-08', TRUE, NULL, TRUE),
  ('Giải phóng miền Nam',     '04-30', TRUE, NULL, TRUE),
  ('Quốc tế Lao động',        '05-01', TRUE, NULL, TRUE),
  ('Quốc khánh',              '09-02', TRUE, NULL, TRUE),
  ('Phụ nữ Việt Nam',         '10-20', TRUE, NULL, TRUE),
  ('Quân đội Nhân dân',       '12-22', TRUE, NULL, TRUE),
  ('Valentine',               '02-14', TRUE, NULL, TRUE),
  ('Halloween',               '10-31', TRUE, NULL, TRUE),
  ('Giáng Sinh',              '12-25', TRUE, NULL, TRUE)
ON CONFLICT (name, date) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 8.3  Default message templates (Zalo channel, Vietnamese)
--      Placeholders: {{customer_name}} {{voucher_code}} {{shop_name}} {{year}}
--      The template engine replaces these at send time.
-- -----------------------------------------------------------------------------
INSERT INTO public.message_templates (name, occasion, channel, subject, body, is_active) VALUES
  (
    'Birthday Zalo',
    'birthday',
    'zalo',
    NULL,
    'Chuc mung sinh nhat {{customer_name}}! 🎂 {{shop_name}} tang ban voucher {{voucher_code}} giam gia dac biet nhan dip sinh nhat. Chuc ban mot ngay sinh nhat that vui ve va y nghia!',
    TRUE
  ),
  (
    'Tet Zalo',
    'tet',
    'zalo',
    NULL,
    'Chuc {{customer_name}} nam moi {{year}} an khang thinh vuong! 🎉 {{shop_name}} gui tang voucher {{voucher_code}} nhu mot loi chuc nam moi. Chuc gia dinh ban mot nam nhieu may man va hanh phuc!',
    TRUE
  ),
  (
    '8/3 Zalo',
    '8_3',
    'zalo',
    NULL,
    'Nhan ngay 8/3, {{shop_name}} gui loi chuc tot dep nhat den {{customer_name}}! 💐 Tang ban voucher {{voucher_code}} nhu mot mon qua nho. Chuc ban luon xinh dep va hanh phuc!',
    TRUE
  ),
  (
    'Promo Zalo',
    'promo',
    'zalo',
    NULL,
    '{{shop_name}} co uu dai dac biet danh cho {{customer_name}}! 🎁 Su dung ma voucher {{voucher_code}} de nhan uu dai hap dan. Dung bo lo co hoi luu giu nhung khoanh khac dep cung nguoi than!',
    TRUE
  )
ON CONFLICT (name, channel) DO NOTHING;


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
