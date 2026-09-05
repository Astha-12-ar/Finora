const { z } = require('zod');

const ALERT_TYPES = ['large_transaction', 'low_balance', 'upcoming_bill', 'unusual_spending'];

const createAlertSchema = z.object({
  type: z.enum(ALERT_TYPES, { error: `Type must be one of: ${ALERT_TYPES.join(', ')}` }),
  message: z.string().trim().min(1).max(500),
  date: z.string().trim().min(1)
});

const markReadSchema = z.object({
  read: z.coerce.boolean().optional().default(true)
}).optional().default({});

module.exports = { createAlertSchema, markReadSchema };
