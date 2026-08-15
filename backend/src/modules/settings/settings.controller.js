const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const settingsService = require('./settings.service');

const list = asyncHandler(async (_req, res) => {
  const data = await settingsService.findAll();
  return success(res, data);
});

const update = asyncHandler(async (req, res) => {
  const data = await settingsService.update(req.body);
  return success(res, data);
});

const zaloQR = asyncHandler(async (_req, res) => {
  const data = await settingsService.getZaloQR();
  return success(res, data);
});

module.exports = {
  list,
  update,
  zaloQR,
};
