const { z } = require('zod');

const createTransactionSchema = z.object({
  date: z.string().trim().min(1),
  merchant: z.string().trim().min(1).max(150),
  category: z.string().trim().min(1).max(100),
  amount: z.coerce.number().finite(),
  status: z.enum(['completed', 'pending']).optional().default('completed')
});

module.exports = { createTransactionSchema };
