const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/alerts
router.get('/', (req, res, next) => {
  try {
    const alerts = db.prepare(
      'SELECT * FROM alerts WHERE user_id = ? ORDER BY date DESC, created_at DESC'
    ).all(req.user.id);

    // SQLite stores booleans as 0 or 1, convert read to boolean
    const formatted = alerts.map(a => ({
      ...a,
      read: Boolean(a.read)
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/read
router.patch('/:id/read', (req, res, next) => {
  try {
    const { read = true } = req.body;
    const result = db.prepare(
      'UPDATE alerts SET read = ? WHERE id = ? AND user_id = ?'
    ).run(read ? 1 : 0, req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      data: { ...updated, read: Boolean(updated.read) }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts
router.post('/', (req, res, next) => {
  try {
    const { type, message, date } = req.body;
    if (!type || !message || !date) {
      return res.status(400).json({ success: false, error: 'Type, message, and date are required' });
    }

    const id = 'a_' + Date.now();
    db.prepare(`
      INSERT INTO alerts (id, user_id, type, message, date, read)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(id, req.user.id, type, message, date);

    const created = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: { ...created, read: false } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
