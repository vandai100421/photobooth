const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const boothService = require('./booth.service');

const accounts = asyncHandler(async (_req, res) => {
  const data = await boothService.getAccounts();
  return success(res, data);
});

const saveAccounts = asyncHandler(async (req, res) => {
  const data = await boothService.saveAccount(req.params.system, req.body);
  return success(res, data);
});

const login = asyncHandler(async (req, res) => {
  const data = await boothService.loginAccount(req.params.system, req.body);
  return success(res, data);
});

const packages = asyncHandler(async (req, res) => {
  const data = await boothService.fetchPackages(req.params.system);
  return success(res, data);
});

const sync = asyncHandler(async (req, res) => {
  const { from, to, status } = req.body;
  const data = await boothService.syncAll(req.params.system, { from, to, status });
  return success(res, data);
});

const codes = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.listCodesDetailed(req.params.system, { from, to });
  return success(res, data);
});

const sessions = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.listSessions(req.params.system, { from, to });
  return success(res, data);
});

const createCode = asyncHandler(async (req, res) => {
  const { system } = req.params;
  const body = req.body;

  if (system === 'selfbooth' && !body.package_id) {
    throw new AppError('Selfbooth cần chọn gói chụp (package_id)', 400);
  }
  if (system === 'photobooth' && !body.type) {
    throw new AppError('Photobooth cần chọn loại mã (type)', 400);
  }

  const data = await boothService.createCode(system, body);
  return success(res, data, 201);
});

const summary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.getSummary(req.params.system, { from, to });
  return success(res, data);
});

const revenue = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.getRevenue(req.params.system, { from, to });
  return success(res, data);
});

const mediaSessions = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.getLiveSessions(req.params.system, {
    from,
    to,
  });
  return success(res, data);
});

const dataStatus = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.getDataStatus({ from, to });
  return success(res, data);
});

const ledger = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.getLedger(req.params.system, { from, to });
  return success(res, data);
});

// Doanh thu thực nhận 2 hệ máy cho Dashboard (trừ các ca bị đánh dấu lỗi).
const revenueStats = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.getRevenueStats({ from, to });
  return success(res, data);
});

const saveCodeReview = asyncHandler(async (req, res) => {
  const data = await boothService.upsertCodeReview(
    req.params.system,
    { ...req.body, code: req.params.code },
    req.user.id,
  );
  return success(res, data);
});

// Gắn nhãn xử lý theo mã HOẶC theo lượt chụp (Dashboard — khách chụp trực tiếp).
const saveReview = asyncHandler(async (req, res) => {
  const data = await boothService.upsertCodeReview(
    req.params.system,
    req.body,
    req.user.id,
  );
  return success(res, data);
});

const reconciliations = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await boothService.listReconciliations(req.params.system, { from, to });
  return success(res, data);
});

const upsertReconciliation = asyncHandler(async (req, res) => {
  const data = await boothService.upsertReconciliation(
    req.params.system,
    req.body,
    req.user.id,
  );
  return success(res, data, 201);
});

const removeReconciliation = asyncHandler(async (req, res) => {
  await boothService.removeReconciliation(req.params.system, req.params.id);
  return res.status(204).end();
});

module.exports = {
  accounts,
  saveAccounts,
  login,
  packages,
  sync,
  codes,
  sessions,
  createCode,
  summary,
  revenue,
  mediaSessions,
  dataStatus,
  ledger,
  revenueStats,
  saveCodeReview,
  saveReview,
  reconciliations,
  upsertReconciliation,
  removeReconciliation,
};
