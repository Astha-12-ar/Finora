/**
 * src/services/alertEngine.js
 * Automated Banking Anomaly & Risk Evaluation Engine
 */

const db = require('../db');

/**
 * Evaluates anomaly rules upon insertion or update of a transaction.
 * Must be executed synchronously within the active database connection or transaction.
 *
 * @param {Object} tx - The transaction record: { id, user_id, date, merchant, category, amount, status }
 * @returns {Array<Object>} List of created alerts
 */
function evaluateTransactionAlerts(tx) {
  const alertsCreated = [];
  const userId = tx.user_id;
  const txDate = tx.date || new Date().toISOString().split('T')[0];
  const txAmount = Number(tx.amount);
  const isExpense = txAmount < 0;
  const absAmount = Math.abs(txAmount);

  // Helper statement to insert alert
  const insertAlert = db.prepare(`
    INSERT INTO alerts (id, user_id, type, message, date, read, severity)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `);

  // Helper statement to check for duplicate alert today
  const findDuplicateAlert = db.prepare(`
    SELECT id FROM alerts
    WHERE user_id = ? AND type = ? AND date = ? AND message = ?
    LIMIT 1
  `);

  function recordAlert(type, message, severity) {
    const existing = findDuplicateAlert.get(userId, type, txDate, message);
    if (!existing) {
      const alertId = 'a_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      insertAlert.run(alertId, userId, type, message, txDate, severity);
      alertsCreated.push({
        id: alertId,
        user_id: userId,
        type,
        message,
        date: txDate,
        read: false,
        severity
      });
    }
  }

  // 1. RULE: large_transaction
  // If transaction is an expense and amount >= 5000 (threshold ₹5,000)
  if (isExpense && absAmount >= 5000) {
    const msg = `Large transaction of ₹${absAmount.toLocaleString()} for ${tx.merchant}`;
    recordAlert('large_transaction', msg, 'warning');
  }

  // 2. RULE: low_balance
  // Calculate updated net balance for this user across all completed transactions
  const balanceRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS net_balance
    FROM transactions
    WHERE user_id = ? AND status = 'completed'
  `).get(userId);

  const netBalance = balanceRow ? Number(balanceRow.net_balance) : 0;
  if (netBalance < 5000) {
    const formattedBalance = netBalance < 0
      ? `-₹${Math.abs(netBalance).toLocaleString()}`
      : `₹${netBalance.toLocaleString()}`;
    const msg = `Your balance dropped to ${formattedBalance} after ${tx.merchant}`;
    recordAlert('low_balance', msg, 'danger');
  }

  // 3. RULE: unusual_spending
  // If category expenditure over trailing 7 days exceeds the rolling weekly average for that category by >50%
  if (isExpense && tx.category && tx.category.toLowerCase() !== 'income') {
    const trailing7DaysRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) AS total_spend
      FROM transactions
      WHERE user_id = ?
        AND category = ?
        AND amount < 0
        AND status = 'completed'
        AND date <= ?
        AND date >= date(?, '-7 days')
    `).get(userId, tx.category, txDate, txDate);

    const trailing7Spend = trailing7DaysRow ? Number(trailing7DaysRow.total_spend) : 0;

    const prior28DaysRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) AS prior_spend
      FROM transactions
      WHERE user_id = ?
        AND category = ?
        AND amount < 0
        AND status = 'completed'
        AND date < date(?, '-7 days')
        AND date >= date(?, '-35 days')
    `).get(userId, tx.category, txDate, txDate);

    const priorSpend = prior28DaysRow ? Number(prior28DaysRow.prior_spend) : 0;
    const weeklyAverage = priorSpend / 4.0;

    if (weeklyAverage > 0 && trailing7Spend > (1.5 * weeklyAverage)) {
      const percentHigher = Math.round(((trailing7Spend - weeklyAverage) / weeklyAverage) * 100);
      const msg = `${tx.category} spend this week is ${percentHigher}% higher than usual`;
      recordAlert('unusual_spending', msg, 'warning');
    }
  }

  return alertsCreated;
}

module.exports = {
  evaluateTransactionAlerts
};
