const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const holidaysService = require('./holidays.service');

const list = asyncHandler(async (req, res) => {
  const { search, is_active } = req.query;
  const data = await holidaysService.findAll({ search, is_active });
  return success(res, data);
});

const detail = asyncHandler(async (req, res) => {
  const data = await holidaysService.findById(req.params.id);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await holidaysService.insert(req.body);
  return success(res, data, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = await holidaysService.update(req.params.id, req.body);
  return success(res, data);
});

const remove = asyncHandler(async (req, res) => {
  await holidaysService.remove(req.params.id);
  return res.status(204).end();
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
};
