const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/reminders
router.get('/', (req, res, next) => {
  try {
    const reminders = db.prepare(
      'SELECT * FROM reminders WHERE user_id = ? ORDER BY due_date ASC'
    ).all(req.user.id);

    const formatted = reminders.map(r => ({
      ...r,
      recurring: Boolean(r.recurring)
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders
router.post('/', (req, res, next) => {
  try {
    const { billName, bill_name, amount, dueDate, due_date, recurring = false, status = 'upcoming' } = req.body;
    const resolvedName = billName || bill_name;
    const resolvedDueDate = dueDate || due_date;

    if (!resolvedName || amount === undefined || !resolvedDueDate) {
      return res.status(400).json({ success: false, error: 'Bill name, amount, and due date are required' });
    }

    const id = 'r_' + Date.now();
    db.prepare(`
      INSERT INTO reminders (id, user_id, bill_name, amount, due_date, recurring, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, resolvedName, Number(amount), resolvedDueDate, recurring ? 1 : 0, status);

    const created = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    res.status(201).json({
      success: true,
      data: { ...created, recurring: Boolean(created.recurring) }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reminders/:id
router.patch('/:id', (req, res, next) => {
  try {
    const { status, recurring } = req.body;
    const existing = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.id
    );

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }

    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedRecurring = recurring !== undefined ? (recurring ? 1 : 0) : existing.recurring;

    db.prepare(`
      UPDATE reminders
      SET status = ?, recurring = ?
      WHERE id = ? AND user_id = ?
    `).run(updatedStatus, updatedRecurring, req.params.id, req.user.id);

    const updated = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      data: { ...updated, recurring: Boolean(updated.recurring) }
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
