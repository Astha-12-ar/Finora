const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// All transaction routes are protected
router.use(authenticateToken);

// GET /api/transactions
router.get('/', (req, res, next) => {
  try {
    const transactions = db.prepare(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC'
    ).all(req.user.id);

    res.json({ success: true, data: transactions });
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions
router.post('/', (req, res, next) => {
  try {
    const { date, merchant, category, amount, status = 'completed' } = req.body;
    if (!date || !merchant || !category || amount === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required transaction fields' });
    }

    const id = 't_' + Date.now();
    db.prepare(`
      INSERT INTO transactions (id, user_id, date, merchant, category, amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, date, merchant, category, Number(amount), status);

    const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
