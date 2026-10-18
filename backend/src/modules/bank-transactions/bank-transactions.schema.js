const { z } = require('zod');

const listBankTransactionsSchema = {
  query: z.object({
    after_id: z.coerce.number().int().nonnegative().optional(),
    transfer_type: z.enum(['in', 'out']).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
};

module.exports = {
  listBankTransactionsSchema,
};
