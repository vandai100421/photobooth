const { success, paginated } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const postsService = require('./posts.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, status, sort } = req.query;
  const result = await postsService.findAll({
    page,
    limit,
    search,
    status,
    sort,
  });
  return paginated(res, result.data, result.pagination);
});

const detail = asyncHandler(async (req, res) => {
  const data = await postsService.findById(req.params.id);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await postsService.insert(req.body, req.user.id);
  return success(res, data, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = await postsService.update(req.params.id, req.body);
  return success(res, data);
});

const remove = asyncHandler(async (req, res) => {
  await postsService.remove(req.params.id);
  return res.status(204).end();
});

const publish = asyncHandler(async (req, res) => {
  const data = await postsService.publish(req.params.id);
  return success(res, data);
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
  publish,
};
