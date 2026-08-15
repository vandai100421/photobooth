const success = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

const error = (res, message, status = 400) =>
  res.status(status).json({ success: false, error: message });

const paginated = (res, data, pagination) =>
  res.json({ success: true, data, pagination });

module.exports = { success, error, paginated };
