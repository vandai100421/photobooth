const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./schedule.service');

const listShifts = asyncHandler(async (req, res) => {
  const data = await service.findShifts(req.query);
  return success(res, data);
});

const workload = asyncHandler(async (req, res) => {
  const data = await service.findWorkload(req.query);
  return success(res, data);
});

const autoAssign = asyncHandler(async (req, res) => {
  const data = await service.autoAssign(req.query);
  return success(res, data);
});

const createShift = asyncHandler(async (req, res) => {
  const data = await service.createShift(req.body);
  return success(res, data, 201);
});

const updateShift = asyncHandler(async (req, res) => {
  const data = await service.updateShift(req.params.id, req.body);
  return success(res, data);
});

const deleteShift = asyncHandler(async (req, res) => {
  await service.removeShift(req.params.id);
  return res.status(204).end();
});

const listSwapRequests = asyncHandler(async (req, res) => {
  const data = await service.listSwapRequests(req.query);
  return success(res, data);
});

const createSwapRequest = asyncHandler(async (req, res) => {
  const data = await service.createSwapRequest(req.body, req.user.id);
  return success(res, data, 201);
});

const reviewSwapRequest = asyncHandler(async (req, res) => {
  const data = await service.reviewSwapRequest(
    req.params.id,
    req.body,
    req.user.id,
  );
  return success(res, data);
});

const listLocations = asyncHandler(async (req, res) => {
  const data = await service.listLocations(req.query);
  return success(res, data);
});

const createLocation = asyncHandler(async (req, res) => {
  const data = await service.createLocation(req.body);
  return success(res, data, 201);
});

const updateLocation = asyncHandler(async (req, res) => {
  const data = await service.updateLocation(req.params.id, req.body);
  return success(res, data);
});

const removeLocation = asyncHandler(async (req, res) => {
  await service.removeLocation(req.params.id);
  return res.status(204).end();
});

module.exports = {
  listShifts,
  workload,
  autoAssign,
  createShift,
  updateShift,
  deleteShift,
  listSwapRequests,
  createSwapRequest,
  reviewSwapRequest,
  listLocations,
  createLocation,
  updateLocation,
  removeLocation,
};
