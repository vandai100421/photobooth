const { success, paginated } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const customersService = require('./customers.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, status, birthday_month, sort } = req.query;
  const result = await customersService.findAll({
    page,
    limit,
    search,
    status,
    birthday_month,
    sort,
  });
  return paginated(res, result.data, result.pagination);
});

const detail = asyncHandler(async (req, res) => {
  const data = await customersService.findById(req.params.id);
  return success(res, data);
});

const birthdays = asyncHandler(async (req, res) => {
  const { range } = req.query;
  const data = await customersService.findBirthdays({ range });
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await customersService.insert(req.body);
  return success(res, data, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = await customersService.update(req.params.id, req.body);
  return success(res, data);
});

const remove = asyncHandler(async (req, res) => {
  await customersService.remove(req.params.id);
  return res.status(204).end();
});

const listBookings = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await customersService.findBookings(req.params.id, {
    page,
    limit,
  });
  return paginated(res, result.data, result.pagination);
});

const listVouchers = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await customersService.findVouchers(req.params.id, {
    page,
    limit,
  });
  return paginated(res, result.data, result.pagination);
});

module.exports = {
  list,
  detail,
  birthdays,
  create,
  update,
  remove,
  listBookings,
  listVouchers,
};
