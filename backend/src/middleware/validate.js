const AppError = require('../utils/AppError');

// Validate request against a zod schema. Schema may define `body`, `query`,
// and `params` keys. Usage: validate(schema) where schema = { body: z.object({...}) }
const validate = (schema) => (req, _res, next) => {
  const sources = ['body', 'query', 'params'];
  for (const src of sources) {
    if (schema[src]) {
      const result = schema[src].safeParse(req[src]);
      if (!result.success) {
        const messages = result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        return next(new AppError(messages, 400));
      }
      req[src] = result.data;
    }
  }
  next();
};

module.exports = validate;
