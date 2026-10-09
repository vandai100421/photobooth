const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./rewards.service');

const kpi = asyncHandler(async (req, res) => {
  const data = await service.getKpi(req.query);
  return success(res, data);
});

const leaderboard = asyncHandler(async (req, res) => {
  const data = await service.getLeaderboard(req.query);
  return success(res, data);
});

const listBonusRules = asyncHandler(async (_req, res) => {
  const data = await service.listBonusRules();
  return success(res, data);
});

const upsertBonusRules = asyncHandler(async (req, res) => {
  const data = await service.upsertBonusRules(req.body.rules);
  return success(res, data);
});

const listPayouts = asyncHandler(async (req, res) => {
  const data = await service.listPayouts(req.query);
  return success(res, data);
});

const createPayout = asyncHandler(async (req, res) => {
  const data = await service.createPayout(req.body);
  return success(res, data, 201);
});

const updatePayout = asyncHandler(async (req, res) => {
  const data = await service.updatePayout(req.params.id, req.body);
  return success(res, data);
});

const listAdjustments = asyncHandler(async (req, res) => {
  const data = await service.listAdjustments(req.query);
  return success(res, data);
});

const createAdjustment = asyncHandler(async (req, res) => {
  const data = await service.createAdjustment(req.body, req.user?.id);
  return success(res, data, 201);
});

const removeAdjustment = asyncHandler(async (req, res) => {
  await service.removeAdjustment(req.params.id);
  return success(res, { id: req.params.id, deleted: true });
});

const listFeedback = asyncHandler(async (req, res) => {
  const data = await service.listFeedback(req.query);
  return success(res, data);
});

const createFeedback = asyncHandler(async (req, res) => {
  const data = await service.createFeedback(req.body);
  return success(res, data, 201);
});

module.exports = {
  kpi,
  leaderboard,
  listBonusRules,
  upsertBonusRules,
  listPayouts,
  createPayout,
  updatePayout,
  listAdjustments,
  createAdjustment,
  removeAdjustment,
  listFeedback,
  createFeedback,
};
