const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const zaloService = require('../../services/zalo.service');
const { SENSITIVE_KEYS } = require('./settings.schema');

const TABLE = 'settings';
const MASK = '***';

// Mask sensitive values before returning to the client.
const maskRow = (row) => ({
  key: row.key,
  value: SENSITIVE_KEYS.has(row.key) ? MASK : row.value,
  description: row.description || null,
});

// Return all settings as a { key: value } map. Sensitive keys are masked.
const findAll = async () => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('key, value, description')
    .order('key', { ascending: true });
  if (error) {
    throw new AppError(`Failed to fetch settings: ${error.message}`, 500);
  }
  const rows = data || [];
  return rows.map(maskRow);
};

// Upsert each key/value pair. Returns the refreshed list (with masks).
// Empty string values are stored as-is so admins can clear a setting.
const update = async (payload = {}) => {
  const flat = payload.settings && typeof payload.settings === 'object'
    ? payload.settings
    : payload;

  const entries = Object.entries(flat).filter(
    ([key, value]) =>
      typeof key === 'string' &&
      key.length > 0 &&
      typeof value === 'string',
  );

  if (entries.length === 0) {
    throw new AppError('No settings provided to update', 400);
  }

  // upsert keeps the existing description when only the value changes.
  for (const [key, value] of entries) {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value }, { onConflict: 'key' });
    if (error) {
      logger.error(`settings update failed for key=${key}: ${error.message}`);
      throw new AppError(
        `Failed to update setting '${key}': ${error.message}`,
        500,
      );
    }
  }

  logger.info(`settings updated ${entries.length} key(s) by user`);
  return findAll();
};

// Proxy to the Zalo OA service for the OA follow QR code.
const getZaloQR = async () => {
  return zaloService.getQRCode();
};

module.exports = {
  findAll,
  update,
  getZaloQR,
};
