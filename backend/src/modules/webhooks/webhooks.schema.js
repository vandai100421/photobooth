const { z } = require('zod');

// SePay gửi payload camelCase theo tài liệu hiện tại, nhưng có client test
// gửi snake_case — chấp nhận cả hai dạng (service sẽ chuẩn hoá lại).
const sepayWebhookSchema = {
  body: z
    .object({
      id: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional(),
      sepay_id: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional(),
      gateway: z.string().max(50).nullable().optional(),
      transactionDate: z.string().max(30).nullable().optional(),
      transaction_date: z.string().max(30).nullable().optional(),
      accountNumber: z.string().max(50).nullable().optional(),
      account_number: z.string().max(50).nullable().optional(),
      subAccount: z.string().max(100).nullable().optional(),
      sub_account: z.string().max(100).nullable().optional(),
      code: z.string().max(100).nullable().optional(),
      content: z.string().max(1000).nullable().optional(),
      transferType: z.enum(['in', 'out']).nullable().optional(),
      transfer_type: z.enum(['in', 'out']).nullable().optional(),
      transferAmount: z.union([z.number(), z.string()]).nullable().optional(),
      transfer_amount: z.union([z.number(), z.string()]).nullable().optional(),
      accumulated: z.union([z.number(), z.string()]).nullable().optional(),
      referenceCode: z.string().max(100).nullable().optional(),
      reference_code: z.string().max(100).nullable().optional(),
      description: z.string().max(1000).nullable().optional(),
    })
    .passthrough(),
};

module.exports = {
  sepayWebhookSchema,
};
