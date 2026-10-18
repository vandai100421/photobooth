-- =============================================================================
-- Migration: bank_transactions
--   Lưu giao dịch ngân hàng nhận từ SePay webhook để hiển thị lịch sử biến động
--   và làm nguồn dữ liệu cho thông báo realtime (phát loa tại quầy).
--   Chạy trong Supabase SQL Editor sau docs/schema.sql (idempotent).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bảng bank_transactions
--    sepay_id là ID giao dịch phía SePay — UNIQUE để chống trùng khi SePay
--    retry webhook (SePay gửi lại cùng id nếu server trả lỗi).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sepay_id         BIGINT      NOT NULL UNIQUE,
  gateway          VARCHAR(50),
  transaction_date TIMESTAMPTZ,
  account_number   VARCHAR(50),
  sub_account      VARCHAR(100),
  code             VARCHAR(100),
  content          TEXT,
  transfer_type    VARCHAR(5)
    CHECK (transfer_type IN ('in', 'out')),
  transfer_amount  BIGINT      NOT NULL DEFAULT 0,
  accumulated      BIGINT,
  reference_code   VARCHAR(100),
  description      TEXT,
  raw_payload      JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard truy vấn theo thời gian gần nhất và lọc theo loại giao dịch.
CREATE INDEX IF NOT EXISTS idx_bank_transactions_created_at
  ON public.bank_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transfer_type
  ON public.bank_transactions (transfer_type);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_date
  ON public.bank_transactions (transaction_date DESC);

COMMENT ON TABLE public.bank_transactions IS
  'Giao dịch ngân hàng đồng bộ từ SePay webhook (tiền vào/ra).';
COMMENT ON COLUMN public.bank_transactions.sepay_id IS
  'ID giao dịch phía SePay — unique, dùng để chống ghi trùng khi retry.';
COMMENT ON COLUMN public.bank_transactions.transfer_type IS
  'in = tiền vào, out = tiền ra.';
COMMENT ON COLUMN public.bank_transactions.raw_payload IS
  'Payload gốc SePay gửi — giữ lại để đối soát khi cần.';

-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
--    Giao dịch do webhook (service_role) ghi. Nhân viên chỉ được đọc.
-- -----------------------------------------------------------------------------
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_transactions_select_all ON public.bank_transactions;
CREATE POLICY bank_transactions_select_all
  ON public.bank_transactions FOR SELECT
  USING (public.current_employee_role() IN ('admin', 'manager', 'staff'));

DROP POLICY IF EXISTS bank_transactions_admin_all ON public.bank_transactions;
CREATE POLICY bank_transactions_admin_all
  ON public.bank_transactions FOR ALL
  USING (public.current_employee_role() = 'admin')
  WITH CHECK (public.current_employee_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 3. Quyền ngầm định
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.bank_transactions FROM anon, authenticated;
GRANT SELECT ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
