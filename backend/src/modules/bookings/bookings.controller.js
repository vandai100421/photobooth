const { success, paginated } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const bookingsService = require('./bookings.service');

const list = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    customer_id,
    employee_id,
    status,
    from,
    to,
    sort,
  } = req.query;
  const result = await bookingsService.findAll({
    page,
    limit,
    customer_id,
    employee_id,
    status,
    from,
    to,
    sort,
  });
  return paginated(res, result.data, result.pagination);
});

const detail = asyncHandler(async (req, res) => {
  const data = await bookingsService.findById(req.params.id);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await bookingsService.insert(req.body);
  return success(res, data, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = await bookingsService.update(req.params.id, req.body);
  return success(res, data);
});

const remove = asyncHandler(async (req, res) => {
  await bookingsService.remove(req.params.id);
  return res.status(204).end();
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
};
