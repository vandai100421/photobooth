const { success, paginated } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const vouchersService = require('./vouchers.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, type, is_active, sort } = req.query;
  const result = await vouchersService.findAll({
    page,
    limit,
    search,
    type,
    is_active,
    sort,
  });
  return paginated(res, result.data, result.pagination);
});

const detail = asyncHandler(async (req, res) => {
  const data = await vouchersService.findById(req.params.id);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await vouchersService.insert({
    ...req.body,
    created_by: req.user.id,
  });
  return success(res, data, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = await vouchersService.update(req.params.id, req.body);
  return success(res, data);
});

const remove = asyncHandler(async (req, res) => {
  await vouchersService.remove(req.params.id);
  return res.status(204).end();
});

const check = asyncHandler(async (req, res) => {
  const data = await vouchersService.checkCode(req.query.code);
  return success(res, data);
});

const issue = asyncHandler(async (req, res) => {
  const data = await vouchersService.issue(req.params.id, req.body);
  return success(res, data, 201);
});

const usage = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await vouchersService.findUsage(req.params.id, {
    page,
    limit,
  });
  return paginated(res, result.data, result.pagination);
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
  check,
  issue,
  usage,
};
