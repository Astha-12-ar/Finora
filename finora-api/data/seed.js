const bcrypt = require('bcrypt');
const db = require('../src/db');

// Mock data matching the frontend dataset
const TRANSACTIONS = [
  { id: "t1",  date: "2026-07-12", merchant: "Amazon",            category: "Shopping",      amount: -1899, status: "completed" },
  { id: "t2",  date: "2026-07-13", merchant: "Starbucks",         category: "Food",          amount: -350,  status: "completed" },
  { id: "t3",  date: "2026-07-15", merchant: "Salary Credit",     category: "Income",        amount: 45000, status: "completed" },
  { id: "t4",  date: "2026-07-16", merchant: "Electricity Board",  category: "Bills",         amount: -1200, status: "completed" },
  { id: "t5",  date: "2026-07-17", merchant: "Uber",              category: "Transport",     amount: -220,  status: "completed" },
  { id: "t6",  date: "2026-07-18", merchant: "Netflix",           category: "Subscription",  amount: -499,  status: "completed" },
  { id: "t7",  date: "2026-07-19", merchant: "Big Bazaar",        category: "Groceries",     amount: -2350, status: "completed" },
  { id: "t8",  date: "2026-07-20", merchant: "Zomato",            category: "Food",          amount: -540,  status: "completed" },
  { id: "t9",  date: "2026-07-21", merchant: "Rent Payment",      category: "Housing",       amount: -15000,status: "completed" },
  { id: "t10", date: "2026-07-22", merchant: "Gym Membership",    category: "Health",        amount: -1500, status: "completed" },
  { id: "t11", date: "2026-07-23", merchant: "Flipkart",          category: "Shopping",      amount: -3200, status: "completed" },
  { id: "t12", date: "2026-07-24", merchant: "Freelance Payment", category: "Income",        amount: 8000,  status: "completed" },
  { id: "t13", date: "2026-07-25", merchant: "Petrol Pump",       category: "Transport",     amount: -1000, status: "completed" },
  { id: "t14", date: "2026-07-26", merchant: "Water Bill",        category: "Bills",         amount: -450,  status: "completed" },
  { id: "t15", date: "2026-07-27", merchant: "Domino's Pizza",    category: "Food",          amount: -680,  status: "completed" },
  { id: "t16", date: "2026-07-28", merchant: "Mobile Recharge",   category: "Bills",         amount: -399,  status: "completed" },
  { id: "t17", date: "2026-07-29", merchant: "Myntra",            category: "Shopping",      amount: -2799, status: "completed" },
  { id: "t18", date: "2026-07-30", merchant: "Movie Tickets",     category: "Entertainment", amount: -800,  status: "completed" },
  { id: "t19", date: "2026-07-31", merchant: "Grocery Store",     category: "Groceries",     amount: -1750, status: "completed" },
  { id: "t20", date: "2026-08-01", merchant: "Insurance Premium", category: "Bills",         amount: -5000, status: "completed" },
  { id: "t21", date: "2026-08-02", merchant: "Swiggy",          category: "Food",          amount: -410,  status: "completed" },
  { id: "t22", date: "2026-08-03", merchant: "Bookstore",       category: "Shopping",  amount: -650,  status: "completed" },
  { id: "t23", date: "2026-08-04", merchant: "Cab Ride",        category: "Transport", amount: -300,  status: "completed" },
  { id: "t24", date: "2026-08-05", merchant: "Refund - Amazon", category: "Income",    amount: 899,   status: "completed" },
  { id: "t25", date: "2026-08-06", merchant: "Spotify",         category: "Subscription", amount: -119, status: "completed" },
  { id: "t26", date: "2026-08-07", merchant: "Electricity Board",category: "Bills",    amount: -1350, status: "pending" },
  { id: "t27", date: "2026-08-08", merchant: "Restaurant",      category: "Food",      amount: -1200, status: "completed" },
  { id: "t28", date: "2026-08-08", merchant: "ATM Withdrawal",  category: "Cash",      amount: -5000, status: "completed" },
  { id: "t29", date: "2026-08-09", merchant: "Online Course",   category: "Education", amount: -2499, status: "completed" },
  { id: "t30", date: "2026-08-09", merchant: "Salary Credit",   category: "Income",    amount: 45000, status: "pending" }
];

const ALERTS = [
  { id: "a1", type: "large_transaction", message: "Large transaction of ₹15000 for Rent Payment", date: "2026-07-21", read: false },
  { id: "a2", type: "upcoming_bill",     message: "Insurance Premium of ₹5000 was charged on Aug 1",  date: "2026-08-01", read: false },
  { id: "a3", type: "low_balance",       message: "Your balance dropped below ₹5000 after ATM withdrawal", date: "2026-08-08", read: false },
  { id: "a4", type: "unusual_spending",  message: "Shopping spend this week is 40% higher than usual", date: "2026-07-29", read: true  },
  { id: "a5", type: "large_transaction", message: "Large transaction of ₹5000 for Insurance Premium", date: "2026-08-01", read: true  },
  { id: "a6", type: "upcoming_bill",     message: "Electricity Board payment of ₹1350 is pending",     date: "2026-08-07", read: false }
];

const REMINDERS = [
  { id: "r1", billName: "Electricity Bill",  amount: 1350, dueDate: "2026-08-12", recurring: true,  status: "upcoming" },
  { id: "r2", billName: "Credit Card Bill",  amount: 6200, dueDate: "2026-08-15", recurring: true,  status: "upcoming" },
  { id: "r3", billName: "Internet Bill",     amount: 999,  dueDate: "2026-08-10", recurring: true,  status: "overdue"  },
  { id: "r4", billName: "Gym Membership",    amount: 1500, dueDate: "2026-08-20", recurring: true,  status: "upcoming" },
  { id: "r5", billName: "Water Bill",        amount: 450,  dueDate: "2026-07-30", recurring: true,  status: "paid"     }
];

// Hash demo password synchronously (10 rounds)
const passwordHash = bcrypt.hashSync('demo123', 10);
const userId = 'u1';

// Prepare insert statements
const insertUser = db.prepare(`
  INSERT INTO users (id, name, email, password_hash)
  VALUES (?, ?, ?, ?)
`);

const insertTransaction = db.prepare(`
  INSERT INTO transactions (id, user_id, date, merchant, category, amount, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertAlert = db.prepare(`
  INSERT INTO alerts (id, user_id, type, message, date, read)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertReminder = db.prepare(`
  INSERT INTO reminders (id, user_id, bill_name, amount, due_date, recurring, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Execute idempotent seed inside a synchronous transaction
const seed = db.transaction(() => {
  // Clear all existing data in reverse dependency order
  db.prepare('DELETE FROM reminders').run();
  db.prepare('DELETE FROM alerts').run();
  db.prepare('DELETE FROM transactions').run();
  db.prepare('DELETE FROM users').run();

  // Insert demo user
  insertUser.run(userId, 'John Doe', 'john@example.com', passwordHash);

  // Insert transactions
  for (const t of TRANSACTIONS) {
    insertTransaction.run(t.id, userId, t.date, t.merchant, t.category, t.amount, t.status);
  }

  // Insert alerts
  for (const a of ALERTS) {
    insertAlert.run(a.id, userId, a.type, a.message, a.date, a.read ? 1 : 0);
  }

  // Insert reminders (map field names and recurring boolean to 0/1)
  for (const r of REMINDERS) {
    insertReminder.run(r.id, userId, r.billName, r.amount, r.dueDate, r.recurring ? 1 : 0, r.status);
  }
});

// Run seeding
seed();

console.log(`Seeded ${TRANSACTIONS.length} transactions, ${ALERTS.length} alerts, ${REMINDERS.length} reminders`);
