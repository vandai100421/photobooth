-- =============================================================================
-- Migration: daily_revenue
--   Cho phép nhập doanh thu theo ngày (thủ công) bên cạnh doanh thu từ booking.
--   Chạy trong Supabase SQL Editor sau docs/schema.sql (idempotent).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bảng daily_revenue
--    Mỗi ngày chỉ có MỘT dòng doanh thu nhập tay (UNIQUE revenue_date).
--    Người nhập ghi nhận bằng created_by (FK -> employees).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_revenue (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_date DATE          NOT NULL
    UNIQUE
    CHECK (revenue_date IS NOT NULL),
  amount       DECIMAL(12,2) NOT NULL
    DEFAULT 0
    CHECK (amount >= 0),
  note         TEXT,
  created_by   UUID
    REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_revenue_revenue_date_idx
  ON public.daily_revenue (revenue_date DESC);

COMMENT ON TABLE public.daily_revenue IS
  'Doanh thu nhập tay theo ngày, được cộng vào doanh thu dashboard/báo cáo.';
COMMENT ON COLUMN public.daily_revenue.revenue_date IS
  'Ngày ghi doanh thu (YYYY-MM-DD). Duy nhất — upsert theo ngày.';
COMMENT ON COLUMN public.daily_revenue.created_by IS
  'Nhân viên nhập dòng doanh thu này.';

-- -----------------------------------------------------------------------------
-- 2. Trigger: updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_revenue_updated_at ON public.daily_revenue;
CREATE TRIGGER trg_daily_revenue_updated_at
  BEFORE UPDATE ON public.daily_revenue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--    Role matrix:
--      admin/manager: SELECT + INSERT/UPDATE/DELETE (sổ doanh thu — ít người sửa)
--      staff        : SELECT
-- -----------------------------------------------------------------------------
ALTER TABLE public.daily_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_revenue_select_all ON public.daily_revenue;
CREATE POLICY daily_revenue_select_all
  ON public.daily_revenue FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS daily_revenue_admin_manager_all ON public.daily_revenue;
CREATE POLICY daily_revenue_admin_manager_all
  ON public.daily_revenue FOR ALL
  USING (public.current_employee_role() IN ('admin', 'manager'))
  WITH CHECK (public.current_employee_role() IN ('admin', 'manager'));

-- -----------------------------------------------------------------------------
-- 4. Quyền ngầm định
-- -----------------------------------------------------------------------------
-- authenticated: nghiêm cấm UPDATE/DELETE bảng public.* trừ chính sách RLS.
REVOKE ALL ON public.daily_revenue FROM anon, authenticated;
GRANT SELECT ON public.daily_revenue TO authenticated;
GRANT ALL ON public.daily_revenue TO service_role;