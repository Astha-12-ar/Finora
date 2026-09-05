const { z } = require('zod');

const createReminderSchema = z.object({
  billName: z.string().trim().min(1).max(150).optional(),
  bill_name: z.string().trim().min(1).max(150).optional(),
  amount: z.coerce.number().finite(),
  dueDate: z.string().trim().min(1).optional(),
  due_date: z.string().trim().min(1).optional(),
  recurring: z.coerce.boolean().optional().default(false),
  status: z.enum(['upcoming', 'overdue', 'paid']).optional().default('upcoming')
})
  .refine(d => d.billName || d.bill_name, { message: 'Bill name is required', path: ['billName'] })
  .refine(d => d.dueDate || d.due_date, { message: 'Due date is required', path: ['dueDate'] });

const updateReminderSchema = z.object({
  status: z.enum(['upcoming', 'overdue', 'paid']).optional(),
  recurring: z.coerce.boolean().optional()
});

module.exports = { createReminderSchema, updateReminderSchema };
