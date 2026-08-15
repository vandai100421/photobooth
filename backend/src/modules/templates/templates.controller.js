const { success, paginated } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const templatesService = require('./templates.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, channel, occasion, is_active, sort } = req.query;
  const result = await templatesService.findAll({
    page,
    limit,
    search,
    channel,
    occasion,
    is_active,
    sort,
  });
  return paginated(res, result.data, result.pagination);
});

const detail = asyncHandler(async (req, res) => {
  const data = await templatesService.findById(req.params.id);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await templatesService.insert(req.body);
  return success(res, data, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = await templatesService.update(req.params.id, req.body);
  return success(res, data);
});

const remove = asyncHandler(async (req, res) => {
  await templatesService.remove(req.params.id);
  return res.status(204).end();
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
};
