const { z } = require('zod');

// Keys whose values must never be returned to the client (even admins read
// back a mask; they can still write them). Anything else is returned as-is.
const SENSITIVE_KEYS = new Set([
  'gmail_app_password',
  'zalo_access_token',
]);

// Update payload: { settings: { key: value, ... } } or a flat { key: value }
// object. Accept both for convenience; the service normalises.
const updateSettingsSchema = {
  body: z
    .object({
      settings: z.record(z.string(), z.string()).optional(),
    })
    .passthrough()
    .superRefine((data, ctx) => {
      const hasFlat = Object.keys(data).some(
        (k) => k !== 'settings' && typeof data[k] === 'string',
      );
      if (!data.settings && !hasFlat) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settings'],
          message: 'Provide a settings object or individual key/value pairs',
        });
      }
    }),
};

module.exports = {
  updateSettingsSchema,
  SENSITIVE_KEYS,
};
