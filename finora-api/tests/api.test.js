// Ensure isolated test environment configuration before modules load
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'finora_test_jwt_secret_key_1234567890';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

describe('Finora API Integration Tests', () => {
  let authToken = '';
  let userId = '';

  beforeAll(() => {
    // Clean in-memory tables before running test suite
    db.prepare('DELETE FROM reminders').run();
    db.prepare('DELETE FROM alerts').run();
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM users').run();
  });

  afterAll(() => {
    db.close();
  });

  // ==========================================
  // 1. AUTHENTICATION & SECURITY TESTS
  // ==========================================
  describe('Task 1: Auth & Security Flow', () => {
    const testUser = {
      name: 'Alice Developer',
      email: 'alice@finora.test',
      password: 'securePassword123'
    };

    it('should successfully register a new user and return a JWT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.token).toBeDefined();

      authToken = res.body.data.token;
      userId = res.body.data.user.id;
    });

    it('should reject registration if email is already registered', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already registered/i);
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it('should successfully login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject access to protected endpoint without JWT', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject access to protected endpoint with invalid JWT', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return user profile with valid JWT', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
    });
  });

  // ==========================================
  // 2. TRANSACTIONS & ALERT ENGINE TESTS
  // ==========================================
  describe('Task 2 & 4: Transactions, Alert Engine & Pagination', () => {
    let transactionId = '';

    it('should record an initial salary credit', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: '2026-08-01',
          merchant: 'Tech Corp Salary',
          category: 'Income',
          amount: 50000,
          status: 'completed'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(50000);
    });

    it('should automatically trigger large_transaction alert on expense >= 5000', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: '2026-08-02',
          merchant: 'Rent Landlord',
          category: 'Housing',
          amount: -15000,
          status: 'completed'
        });

      expect(res.status).toBe(201);
      transactionId = res.body.data.id;

      // Verify that large_transaction alert was triggered
      const alerts = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(alerts.status).toBe(200);
      const largeTxAlert = alerts.body.data.find(a => a.type === 'large_transaction');
      expect(largeTxAlert).toBeDefined();
      expect(largeTxAlert.message).toContain('Rent Landlord');
      expect(largeTxAlert.read).toBe(false);
    });

    it('should automatically trigger low_balance alert when balance drops below 5000', async () => {
      // Current balance is 50000 - 15000 = 35000.
      // An expense of 32000 will bring net balance to 3000 (< 5000)
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: '2026-08-03',
          merchant: 'Electronics Store',
          category: 'Shopping',
          amount: -32000,
          status: 'completed'
        });

      expect(res.status).toBe(201);

      const alerts = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(alerts.status).toBe(200);
      const lowBalanceAlert = alerts.body.data.find(a => a.type === 'low_balance');
      expect(lowBalanceAlert).toBeDefined();
      expect(lowBalanceAlert.message).toContain('Electronics Store');
    });

    it('should support transaction editing via PATCH /api/transactions/:id', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          merchant: 'Apartment Rent (Updated)',
          amount: -16000
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant).toBe('Apartment Rent (Updated)');
      expect(res.body.data.amount).toBe(-16000);
    });

    it('should support server-side pagination on GET /api/transactions', async () => {
      const res = await request(app)
        .get('/api/transactions?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.totalRecords).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('should mark an alert as read via PATCH /api/alerts/:id/read', async () => {
      const alertsRes = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`);

      const alertToMark = alertsRes.body.data[0];
      expect(alertToMark).toBeDefined();

      const updateRes = await request(app)
        .patch(`/api/alerts/${alertToMark.id}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ read: true });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.read).toBe(true);
    });
  });

  // ==========================================
  // 3. REMINDERS & ROLLOVER AUTOMATION TESTS
  // ==========================================
  describe('Task 3: Bill Reminder Rollover Automation', () => {
    let reminderId = '';

    it('should create a recurring reminder', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bill_name: 'Broadband Internet',
          amount: 999,
          due_date: '2026-08-15',
          recurring: true,
          status: 'upcoming'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bill_name).toBe('Broadband Internet');
      expect(res.body.data.recurring).toBe(true);
      reminderId = res.body.data.id;
    });

    it('should mark recurring reminder as paid and generate rollover for next month', async () => {
      const res = await request(app)
        .patch(`/api/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'paid' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('paid');

      // Next billing cycle should be automatically generated exactly one month forward
      expect(res.body.nextReminder).toBeDefined();
      expect(res.body.nextReminder.bill_name).toBe('Broadband Internet');
      expect(res.body.nextReminder.due_date).toBe('2026-09-15');
      expect(res.body.nextReminder.status).toBe('upcoming');
      expect(res.body.nextReminder.recurring).toBe(true);

      // Verify both records appear in the user reminders list
      const listRes = await request(app)
        .get('/api/reminders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      const bills = listRes.body.data.filter(b => b.bill_name === 'Broadband Internet');
      expect(bills.length).toBe(2);
      expect(bills.some(b => b.status === 'paid' && b.due_date === '2026-08-15')).toBe(true);
      expect(bills.some(b => b.status === 'upcoming' && b.due_date === '2026-09-15')).toBe(true);
    });

    it('should handle month-end rollover date math accurately (e.g. Jan 31 -> Feb 28)', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bill_name: 'Month-End Utility',
          amount: 500,
          due_date: '2026-01-31',
          recurring: true,
          status: 'upcoming'
        });

      expect(res.status).toBe(201);
      const janReminderId = res.body.data.id;

      const rolloverRes = await request(app)
        .patch(`/api/reminders/${janReminderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'paid' });

      expect(rolloverRes.status).toBe(200);
      expect(rolloverRes.body.nextReminder).toBeDefined();
      // 2026 is not a leap year, February ends on the 28th
      expect(rolloverRes.body.nextReminder.due_date).toBe('2026-02-28');
    });
  });
});
