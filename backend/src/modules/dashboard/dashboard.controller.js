const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const dashboardService = require('./dashboard.service');

const stats = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getStats();
  return success(res, data);
});

const revenue = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await dashboardService.getRevenue({ from, to });
  return success(res, data);
});

const customers = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await dashboardService.getCustomers({ from, to });
  return success(res, data);
});

const vouchers = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await dashboardService.getVouchers({ from, to });
  return success(res, data);
});

module.exports = {
  stats,
  revenue,
  customers,
  vouchers,
};
