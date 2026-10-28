const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { createTransactionSchema, updateTransactionSchema } = require('../validators/transactions.validators');
const { evaluateTransactionAlerts } = require('../services/alertEngine');

// All transaction routes are protected
router.use(authenticateToken);

// GET /api/transactions
// Supports server pagination (?page=1&limit=20), searching, category filtering, and sorting
router.get('/', (req, res, next) => {
  try {
    const { search, category, sort, page, limit } = req.query;

    let whereClauses = ['user_id = ?'];
    let params = [req.user.id];

    if (search && search.trim() !== '') {
      whereClauses.push('(LOWER(merchant) LIKE ? OR LOWER(category) LIKE ?)');
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      params.push(searchTerm, searchTerm);
    }

    if (category && category !== 'all' && category.trim() !== '') {
      whereClauses.push('category = ?');
      params.push(category.trim());
    }

    let orderBy = 'date DESC, rowid DESC';
    if (sort === 'date-asc') {
      orderBy = 'date ASC, rowid ASC';
    } else if (sort === 'amount-desc') {
      orderBy = 'amount DESC';
    } else if (sort === 'amount-asc') {
      orderBy = 'amount ASC';
    }

    const whereSql = whereClauses.join(' AND ');

    // Total records count matching filter
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM transactions WHERE ${whereSql}`);
    const totalRecords = countStmt.get(...params).count;

    // Determine pagination mode
    const isPaginated = page !== undefined || limit !== undefined;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 20);
    const totalPages = isPaginated ? Math.max(1, Math.ceil(totalRecords / parsedLimit)) : 1;
    const offset = (parsedPage - 1) * parsedLimit;

    let query = `SELECT * FROM transactions WHERE ${whereSql} ORDER BY ${orderBy}`;
    let queryParams = [...params];

    if (isPaginated) {
      query += ' LIMIT ? OFFSET ?';
      queryParams.push(parsedLimit, offset);
    }

    const transactions = db.prepare(query).all(...queryParams);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: isPaginated ? parsedPage : 1,
        limit: isPaginated ? parsedLimit : totalRecords,
        totalRecords,
        totalPages
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions
router.post('/', (req, res, next) => {
  try {
    const { date, merchant, category, amount, status } = createTransactionSchema.parse(req.body);

    const id = 't_' + Date.now();
    let created;
    let alertsCreated = [];

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO transactions (id, user_id, date, merchant, category, amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, date, merchant, category, amount, status);

      created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

      // Trigger automated alert rules engine inside transaction
      alertsCreated = evaluateTransactionAlerts(created);
    });

    insertTx();

    res.status(201).json({
      success: true,
      data: created,
      alertsCreated
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/transactions/:id
router.patch('/:id', (req, res, next) => {
  try {
    const parsed = updateTransactionSchema.parse(req.body);
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.id
    );

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const date = parsed.date !== undefined ? parsed.date : existing.date;
    const merchant = parsed.merchant !== undefined ? parsed.merchant : existing.merchant;
    const category = parsed.category !== undefined ? parsed.category : existing.category;
    const amount = parsed.amount !== undefined ? parsed.amount : existing.amount;
    const status = parsed.status !== undefined ? parsed.status : existing.status;

    let updated;
    let alertsCreated = [];

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE transactions
        SET date = ?, merchant = ?, category = ?, amount = ?, status = ?
        WHERE id = ? AND user_id = ?
      `).run(date, merchant, category, amount, status, req.params.id, req.user.id);

      updated = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(
        req.params.id,
        req.user.id
      );

      // Re-evaluate alert conditions if updated
      alertsCreated = evaluateTransactionAlerts(updated);
    });

    updateTx();

    res.json({
      success: true,
      data: updated,
      alertsCreated
    });
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
