const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { createReminderSchema, updateReminderSchema } = require('../validators/reminders.validators');

router.use(authenticateToken);

function addOneMonth(dateStr) {
  const parts = dateStr.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  let day = parseInt(parts[2], 10);

  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }

  const maxDays = new Date(year, month, 0).getDate();
  if (day > maxDays) {
    day = maxDays;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// GET /api/reminders
router.get('/', (req, res, next) => {
  try {
    const reminders = db.prepare(
      'SELECT * FROM reminders WHERE user_id = ? ORDER BY due_date ASC'
    ).all(req.user.id);

    const formatted = reminders.map(r => ({
      ...r,
      recurring: Boolean(r.recurring),
      is_recurring: Boolean(r.recurring)
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders
router.post('/', (req, res, next) => {
  try {
    const parsed = createReminderSchema.parse(req.body);
    const resolvedName = parsed.billName || parsed.bill_name;
    const resolvedDueDate = parsed.dueDate || parsed.due_date;
    const isRecurring = parsed.is_recurring !== undefined ? parsed.is_recurring : parsed.recurring;

    const id = 'r_' + Date.now();
    db.prepare(`
      INSERT INTO reminders (id, user_id, bill_name, amount, due_date, recurring, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, resolvedName, parsed.amount, resolvedDueDate, isRecurring ? 1 : 0, parsed.status);

    const created = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(id, req.user.id);
    res.status(201).json({
      success: true,
      data: {
        ...created,
        recurring: Boolean(created.recurring),
        is_recurring: Boolean(created.recurring)
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reminders/:id
router.patch('/:id', (req, res, next) => {
  try {
    const { status, recurring, is_recurring } = updateReminderSchema.parse(req.body);
    const existing = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.id
    );

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }

    const resolvedRecurringInput = recurring !== undefined ? recurring : is_recurring;
    const updatedRecurring = resolvedRecurringInput !== undefined ? (resolvedRecurringInput ? 1 : 0) : existing.recurring;
    const updatedStatus = status !== undefined ? status : existing.status;

    let nextReminder = null;

    const updateTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE reminders
        SET status = ?, recurring = ?
        WHERE id = ? AND user_id = ?
      `).run(updatedStatus, updatedRecurring, req.params.id, req.user.id);

      // Automated rollover for recurring bills marked as 'paid'
      const isCurrentlyRecurring = Boolean(existing.recurring) || Boolean(updatedRecurring);
      if (updatedStatus === 'paid' && existing.status !== 'paid' && isCurrentlyRecurring) {
        const nextDueDate = addOneMonth(existing.due_date);
        const nextId = 'r_' + Date.now();
        db.prepare(`
          INSERT INTO reminders (id, user_id, bill_name, amount, due_date, recurring, status)
          VALUES (?, ?, ?, ?, ?, ?, 'upcoming')
        `).run(nextId, req.user.id, existing.bill_name, existing.amount, nextDueDate, 1);

        nextReminder = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(nextId, req.user.id);
      }
    });

    updateTransaction();

    const updated = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    res.json({
      success: true,
      data: {
        ...updated,
        recurring: Boolean(updated.recurring),
        is_recurring: Boolean(updated.recurring)
      },
      nextReminder: nextReminder ? {
        ...nextReminder,
        recurring: Boolean(nextReminder.recurring),
        is_recurring: Boolean(nextReminder.recurring)
      } : null
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }

    res.json({ success: true, message: 'Reminder deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
