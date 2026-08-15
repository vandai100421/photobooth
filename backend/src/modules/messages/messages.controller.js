const { success, paginated } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const messagesService = require('./messages.service');

const logs = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    customer_id,
    channel,
    status,
    from,
    to,
    sort,
  } = req.query;
  const result = await messagesService.findLogs({
    page,
    limit,
    customer_id,
    channel,
    status,
    from,
    to,
    sort,
  });
  return paginated(res, result.data, result.pagination);
});

const sendNow = asyncHandler(async (req, res) => {
  const data = await messagesService.sendNow(req.body);
  return success(res, data, 201);
});

const scheduled = asyncHandler(async (req, res) => {
  const { page, limit, from, to } = req.query;
  const result = await messagesService.findScheduled({
    page,
    limit,
    from,
    to,
  });
  return paginated(res, result.data, result.pagination);
});

const schedule = asyncHandler(async (req, res) => {
  const data = await messagesService.scheduleMessage(req.body);
  return success(res, data, 201);
});

const stats = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await messagesService.findStats({ from, to });
  return success(res, data);
});

module.exports = {
  logs,
  sendNow,
  scheduled,
  schedule,
  stats,
};
