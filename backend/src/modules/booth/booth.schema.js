const { z } = require('zod');

const SYSTEM_ENUM = z.enum(['photobooth', 'selfbooth']);

const systemParamSchema = {
  params: z.object({ system: SYSTEM_ENUM }),
};

// Body cho POST /accounts/:system/login (Selfbooth cần turnstile_token 1 lần).
const loginSchema = {
  params: systemParamSchema.params,
  body: z.object({
    turnstileToken: z.string().max(4000).optional(),
  }),
};

const listSchema = {
  params: systemParamSchema.params,
  query: z.object({
    from: z.string().date('from phải là YYYY-MM-DD').optional(),
    to: z.string().date('to phải là YYYY-MM-DD').optional(),
  }),
};

const syncSchema = {
  params: systemParamSchema.params,
  body: z.object({
    from: z.string().date('from phải là YYYY-MM-DD'),
    to: z.string().date('to phải là YYYY-MM-DD'),
    // Photobooth: lọc mã theo trạng thái (mặc định 'used' nếu bỏ trống).
    status: z.string().max(30).optional(),
  }),
};

// Ràng buộc chi tiết theo từng hệ thống được kiểm tra ở controller/service
// (package_id bắt buộc với Selfbooth, type/value bắt buộc với Photobooth).
const createCodeSchema = {
  params: systemParamSchema.params,
  body: z.object({
    count: z.number().int().min(1).max(100).default(1),
    note: z.string().max(500).nullish(),
    // Selfbooth (boothme.tech /v1/web/codes)
    code: z.string().max(100).optional(),
    kind: z.enum(['single', 'reusable']).optional(),
    code_kind: z.string().max(50).optional(),
    package_id: z.string().max(200).optional(),
    // Photobooth
    type: z.enum(['cash', 'cash_code']).optional(),
    value: z.number().min(0).optional(),
    valid_from: z.string().max(40).nullish(),
    valid_until: z.string().max(40).nullish(),
  }),
};

const reconciliationSchema = {
  params: systemParamSchema.params,
  body: z.object({
    reconciliation_date: z.string().date('reconciliation_date phải là YYYY-MM-DD'),
    machine_cash: z.number().min(0).default(0),
    actual_cash: z.number().min(0).default(0),
    note: z.string().max(500).nullish(),
  }),
};

// Ghi chú / trạng thái xử lý mã do nhân viên nhập.
const codeReviewSchema = {
  params: z.object({
    system: SYSTEM_ENUM,
    code: z.string().min(1).max(100),
  }),
  body: z.object({
    staff_status: z.enum(['ok', 'error', 'resolved']).nullish(),
    staff_reason: z.string().max(200).nullish(),
    staff_note: z.string().max(1000).nullish(),
  }),
};

const saveAccountsSchema = {
  params: systemParamSchema.params,
  body: z.object({
    baseUrl: z.string().url('baseUrl không hợp lệ').optional(),
    loginPath: z.string().max(200).optional(),
    studioId: z.string().max(50).optional(),
    tenant: z.string().max(200).optional(),
    branchId: z.string().max(100).optional(),
    machineHwid: z.string().max(200).optional(),
    turnstileToken: z.string().max(4000).optional(),
    email: z.string().email('email không hợp lệ').optional(),
    password: z.string().max(200).optional(),
    token: z.string().max(8000).optional(),
  }),
};

module.exports = {
  SYSTEM_ENUM,
  systemParamSchema,
  loginSchema,
  listSchema,
  syncSchema,
  createCodeSchema,
  reconciliationSchema,
  codeReviewSchema,
  saveAccountsSchema,
};
