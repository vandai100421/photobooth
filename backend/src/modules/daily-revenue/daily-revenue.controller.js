const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const dailyRevenueService = require('./daily-revenue.service');

const list = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await dailyRevenueService.findAll({ from, to });
  return success(res, data);
});

const detail = asyncHandler(async (req, res) => {
  const data = await dailyRevenueService.findById(req.params.id);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await dailyRevenueService.upsertByDate({
    ...req.body,
    created_by: req.user.id,
  });
  return success(res, data, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = await dailyRevenueService.update(req.params.id, req.body);
  return success(res, data);
});

const remove = asyncHandler(async (req, res) => {
  await dailyRevenueService.remove(req.params.id);
  return res.status(204).end();
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
};
