const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const bankTransactionsService = require('./bank-transactions.service');

const list = asyncHandler(async (req, res) => {
  const { after_id, transfer_type, limit } = req.query;
  const data = await bankTransactionsService.findAll({
    after_id,
    transfer_type,
    limit,
  });
  return success(res, data);
});

const latest = asyncHandler(async (_req, res) => {
  const data = await bankTransactionsService.findLatest();
  return success(res, data);
});

module.exports = {
  list,
  latest,
};
