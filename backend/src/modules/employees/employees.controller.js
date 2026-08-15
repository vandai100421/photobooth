const { success, paginated } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const employeesService = require('./employees.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, role, is_active, sort } = req.query;
  const result = await employeesService.findAll({
    page,
    limit,
    search,
    role,
    is_active,
    sort,
  });
  return paginated(res, result.data, result.pagination);
});

const detail = asyncHandler(async (req, res) => {
  const data = await employeesService.findById(req.params.id);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await employeesService.insert(req.body);
  return success(res, data, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = await employeesService.update(req.params.id, req.body);
  return success(res, data);
});

const remove = asyncHandler(async (req, res) => {
  await employeesService.remove(req.params.id);
  return res.status(204).end();
});

const listShifts = asyncHandler(async (req, res) => {
  const { page, limit, from, to } = req.query;
  const result = await employeesService.findShifts(req.params.id, {
    page,
    limit,
    from,
    to,
  });
  return paginated(res, result.data, result.pagination);
});

const createShift = asyncHandler(async (req, res) => {
  const data = await employeesService.insertShift(req.params.id, req.body);
  return success(res, data, 201);
});

const updateShift = asyncHandler(async (req, res) => {
  const data = await employeesService.updateShift(req.params.shiftId, req.body);
  return success(res, data);
});

const listSkills = asyncHandler(async (req, res) => {
  const data = await employeesService.findSkills(req.params.id);
  return success(res, data);
});

const upsertSkill = asyncHandler(async (req, res) => {
  const data = await employeesService.upsertSkill(req.params.id, req.body);
  return success(res, data, 201);
});

const removeSkill = asyncHandler(async (req, res) => {
  await employeesService.removeSkill(req.params.id, req.params.skillId);
  return res.status(204).end();
});

const listAreas = asyncHandler(async (req, res) => {
  const data = await employeesService.findAreas(req.params.id);
  return success(res, data);
});

const upsertArea = asyncHandler(async (req, res) => {
  const data = await employeesService.upsertArea(req.params.id, req.body);
  return success(res, data, 201);
});

const removeArea = asyncHandler(async (req, res) => {
  await employeesService.removeArea(req.params.id, req.params.areaId);
  return res.status(204).end();
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
  listShifts,
  createShift,
  updateShift,
  listSkills,
  upsertSkill,
  removeSkill,
  listAreas,
  upsertArea,
  removeArea,
};
