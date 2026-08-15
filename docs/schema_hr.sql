-- =============================================================================
-- TAP Photobooth Management — HR Extension Migration
-- Version: 1.1.0
--
-- Bổ sung nhóm Quản lý nhân sự mở rộng:
--   - locations            : địa điểm photobooth (cố định + sự kiện)
--   - employee_skills      : tag kỹ năng NV (photographer/setup/cskh/...)
--   - employee_areas       : khu vực phụ trách
--   - shift extensions     : location_id + tọa độ GPS cho check-in
--   - shift_swap_requests  : xin đổi ca / nghỉ → manager duyệt
--   - employee_bonus_rules : quy tắc tính thưởng (config)
--   - customer_feedback    : đánh giá sao của KH cho NV
--   - employee_payouts     : khoản thù lao/thưởng đã chốt theo tháng
--
-- Idempotent: chạy an toàn trên DB đã có schema.sql (Phase 1).
-- =============================================================================


-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1  locations
--      Địa điểm hoạt động: cửa hàng cố định hoặc địa điểm sự kiện.
--      Dùng cho shifts (ca làm) và gợi ý auto-assign theo khoảng cách.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255)  NOT NULL,
  address     TEXT,
  latitude    NUMERIC(9,6),
  longitude   NUMERIC(9,6),
  is_active   BOOLEAN       DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 1.2  employee_skills
--      Tag kỹ năng + level (1-5). Hỗ trợ auto-assign NV đúng vai trò.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID        NOT NULL
    REFERENCES public.employees(id) ON DELETE CASCADE,
  skill       VARCHAR(50) NOT NULL
    CHECK (skill IN ('photographer','setup','cskh','transport','sales')),
  level       SMALLINT    DEFAULT 1
    CHECK (level BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT employee_skills_employee_skill_key UNIQUE (employee_id, skill)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_skills_employee_skill_key'
  ) THEN
    ALTER TABLE public.employee_skills
      ADD CONSTRAINT employee_skills_employee_skill_key UNIQUE (employee_id, skill);
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 1.3  employee_areas
--      Khu vực/quận NV quen phụ trách → ưu tiên khi phân bổ booking/ca.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_areas (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID          NOT NULL
    REFERENCES public.employees(id) ON DELETE CASCADE,
  area        VARCHAR(100)  NOT NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  CONSTRAINT employee_areas_employee_area_key UNIQUE (employee_id, area)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_areas_employee_area_key'
  ) THEN
    ALTER TABLE public.employee_areas
      ADD CONSTRAINT employee_areas_employee_area_key UNIQUE (employee_id, area);
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 1.4  shift extensions
--      Mở rộng bảng shifts có sẵn (từ schema.sql) bằng địa điểm + GPS.
-- -----------------------------------------------------------------------------
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS location_id    UUID REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS location_name  VARCHAR(255);
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS latitude       NUMERIC(9,6);
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS longitude      NUMERIC(9,6);


-- -----------------------------------------------------------------------------
-- 1.5  shift_swap_requests
--      NV xin đổi ca / nghỉ. Manager/admin duyệt.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id             UUID         NOT NULL
    REFERENCES public.shifts(id) ON DELETE CASCADE,
  requesting_employee  UUID         NOT NULL
    REFERENCES public.employees(id) ON DELETE CASCADE,
  target_employee_id   UUID
    REFERENCES public.employees(id) ON DELETE SET NULL,
  reason               TEXT,
  status               VARCHAR(20)  DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reviewed_by          UUID
    REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 1.6  employee_bonus_rules
--      Config quy tắc thưởng. amount = số tiền cố định, multiplier = hệ số
--      áp lên tổng (vd ca cuối tuần ×1.5). Backend tính KPI dựa trên rules.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_bonus_rules (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)   UNIQUE NOT NULL,
  name        VARCHAR(255)  NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  multiplier  NUMERIC(5,2)  DEFAULT 1,
  is_active   BOOLEAN       DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 1.7  customer_feedback
--      Đánh giá sao (1-5) của KH cho NV sau booking. Ảnh hưởng thưởng tháng.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_feedback (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID         NOT NULL
    REFERENCES public.bookings(id) ON DELETE CASCADE,
  employee_id UUID
    REFERENCES public.employees(id) ON DELETE SET NULL,
  customer_id UUID
    REFERENCES public.customers(id) ON DELETE SET NULL,
  rating      SMALLINT     NOT NULL
    CHECK (rating BETWEEN 1 AND 5),
  note        TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Mỗi booking chỉ có 1 feedback.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_feedback_booking_id_key'
  ) THEN
    ALTER TABLE public.customer_feedback
      ADD CONSTRAINT customer_feedback_booking_id_key UNIQUE (booking_id);
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 1.8  employee_payouts
--      Khoản thù lao/thưởng chốt theo tháng. breakdown = JSON chi tiết.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_payouts (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID          NOT NULL
    REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month VARCHAR(7)    NOT NULL,
  total_amount DECIMAL(12,2) DEFAULT 0,
  breakdown    JSONB,
  status       VARCHAR(20)   DEFAULT 'pending'
    CHECK (status IN ('pending','paid')),
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW(),
  CONSTRAINT employee_payouts_employee_month_key UNIQUE (employee_id, period_month)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_payouts_employee_month_key'
  ) THEN
    ALTER TABLE public.employee_payouts
      ADD CONSTRAINT employee_payouts_employee_month_key UNIQUE (employee_id, period_month);
  END IF;
END $$;


-- =============================================================================
-- 2. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee_id ON public.employee_skills (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill       ON public.employee_skills (skill);

CREATE INDEX IF NOT EXISTS idx_employee_areas_employee_id  ON public.employee_areas (employee_id);

CREATE INDEX IF NOT EXISTS idx_shifts_location_id          ON public.shifts (location_id);

CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_shift_id            ON public.shift_swap_requests (shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_requesting_employee ON public.shift_swap_requests (requesting_employee);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_status              ON public.shift_swap_requests (status);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_employee_id ON public.customer_feedback (employee_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_rating      ON public.customer_feedback (rating);

CREATE INDEX IF NOT EXISTS idx_employee_payouts_employee_id  ON public.employee_payouts (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_period_month ON public.employee_payouts (period_month);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_status       ON public.employee_payouts (status);

CREATE INDEX IF NOT EXISTS idx_locations_is_active ON public.locations (is_active);


-- =============================================================================
-- 3. TRIGGERS  (updated_at cho các bảng mới có updated_at)
-- =============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'locations',
    'shift_swap_requests',
    'employee_bonus_rules',
    'employee_payouts'
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


-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.locations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_areas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swap_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_bonus_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payouts      ENABLE ROW LEVEL SECURITY;

-- =============== locations ===============
DROP POLICY IF EXISTS locations_select_all ON public.locations;
CREATE POLICY locations_select_all
  ON public.locations FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS locations_admin_all ON public.locations;
CREATE POLICY locations_admin_all
  ON public.locations FOR ALL
  USING (public.current_employee_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_employee_role() IN ('admin', 'manager'));


-- =============== employee_skills ===============
DROP POLICY IF EXISTS employee_skills_select_all ON public.employee_skills;
CREATE POLICY employee_skills_select_all
  ON public.employee_skills FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS employee_skills_manage ON public.employee_skills;
CREATE POLICY employee_skills_manage
  ON public.employee_skills FOR ALL
  USING (public.current_employee_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_employee_role() IN ('admin', 'manager'));

-- Staff có thể đọc skill của mình (đã cover bởi select_all).

-- =============== employee_areas ===============
DROP POLICY IF EXISTS employee_areas_select_all ON public.employee_areas;
CREATE POLICY employee_areas_select_all
  ON public.employee_areas FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS employee_areas_manage ON public.employee_areas;
CREATE POLICY employee_areas_manage
  ON public.employee_areas FOR ALL
  USING (public.current_employee_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_employee_role() IN ('admin', 'manager'));


-- =============== shift_swap_requests ===============
DROP POLICY IF EXISTS shift_swap_requests_select_all ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_select_all
  ON public.shift_swap_requests FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

-- Staff tự tạo yêu cầu đổi ca của chính mình.
DROP POLICY IF EXISTS shift_swap_requests_staff_insert ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_staff_insert
  ON public.shift_swap_requests FOR INSERT
  WITH CHECK (
    public.current_employee_role() IN ('admin', 'manager', 'staff')
    AND requesting_employee = auth.uid()
  );

-- Admin/manager duyệt (update status, reviewed_*).
DROP POLICY IF EXISTS shift_swap_requests_admin_update ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_admin_update
  ON public.shift_swap_requests FOR UPDATE
  USING (public.current_employee_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_employee_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS shift_swap_requests_admin_all ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_admin_all
  ON public.shift_swap_requests FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============== employee_bonus_rules ===============
DROP POLICY IF EXISTS bonus_rules_select_all ON public.employee_bonus_rules;
CREATE POLICY bonus_rules_select_all
  ON public.employee_bonus_rules FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS bonus_rules_admin_all ON public.employee_bonus_rules;
CREATE POLICY bonus_rules_admin_all
  ON public.employee_bonus_rules FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============== customer_feedback ===============
DROP POLICY IF EXISTS customer_feedback_select_all ON public.customer_feedback;
CREATE POLICY customer_feedback_select_all
  ON public.customer_feedback FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

-- Mọi staff đều có thể tạo feedback (thu thập sau booking).
DROP POLICY IF EXISTS customer_feedback_staff_insert ON public.customer_feedback;
CREATE POLICY customer_feedback_staff_insert
  ON public.customer_feedback FOR INSERT
  WITH CHECK (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS customer_feedback_admin_all ON public.customer_feedback;
CREATE POLICY customer_feedback_admin_all
  ON public.customer_feedback FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============== employee_payouts ===============
DROP POLICY IF EXISTS employee_payouts_select_all ON public.employee_payouts;
CREATE POLICY employee_payouts_select_all
  ON public.employee_payouts FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS employee_payouts_admin_all ON public.employee_payouts;
CREATE POLICY employee_payouts_admin_all
  ON public.employee_payouts FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');


-- =============================================================================
-- 5. SEED DATA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1  Quy tắc thưởng mặc định
--      code là khoá duy nhất dùng để Upsert từ UI.
-- -----------------------------------------------------------------------------
INSERT INTO public.employee_bonus_rules (code, name, amount, multiplier, is_active) VALUES
  ('booking_completed', 'Hoàn thành 1 booking',          50000,  1.00, TRUE),
  ('weekend_holiday',   'Ca cuối tuần / ngày lễ',        0,      1.50, TRUE),
  ('voucher_redeemed',  'Voucher phát & KH sử dụng',     10000,  1.00, TRUE),
  ('customer_return',   'KH quay lại trong 30 ngày',     20000,  1.00, TRUE),
  ('high_rating',       'Đánh giá TB >= 4.5 (tháng)',   500000, 1.00, TRUE),
  ('late_penalty',      'Đi muộn (từ lần 4/tháng)',     -100000,1.00, TRUE)
ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
