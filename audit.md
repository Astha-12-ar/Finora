# Project Audit: Finora — Personal Finance & Banking Alert System

**Audit Date:** October 28, 2026  
**Repository:** `Astha-12-ar/Finora`  
**Current Milestone:** Phase 3 Complete (Production Hardening & Automated Intelligence)  
**Overall Completion:** **~96%** (Production Ready Core & Automated Engine; Deployment & Containerization Remaining)

---

## 1. Executive Summary

**Finora** is a lightweight, responsive personal finance and banking alert management web application. It bridges the gap between passive bank transaction exports and proactive money management by combining cash flow tracking, automated anomaly detection, and bill payment reminders into a single unified interface.

The project has achieved its primary engineering milestones:
- **Frontend:** Vanilla HTML5, CSS3, and ES6+ JavaScript with zero build-tooling overhead, delivering near-instant page loads, interactive modal dialogs, and full cross-browser compatibility.
- **Backend (`finora-api`):** Node.js and Express 5 REST API using `better-sqlite3` in WAL mode, secured with JSON Web Tokens (JWT), `bcrypt` password hashing, Zod schema validation, API rate limiting, and an automated event-driven alert rules engine.
- **Automated Verification:** 16 integration tests passing across authentication, anomaly alerts, transaction CRUD with pagination, and reminder rollover.

---

## 2. The Base Problem

### 2.1 Problem Statement
Retail banking users frequently manage multiple checking accounts, credit cards, subscription services, and recurring utility bills. This fragmentation creates three primary challenges:

1. **Opaque Cash Flow:** Users struggle to maintain a clear, continuous picture of total monthly income versus recurring expenditures. Traditional net-banking dashboards are cluttered and report transactions passively without intuitive categorization.
2. **Missed Payment Deadlines & Penalties:** Due dates for utility bills, loan installments, and credit cards are easily overlooked, leading to penalty charges, service interruptions, and damaged credit scores.
3. **Absence of Real-Time Anomaly Awareness:** Users are rarely alerted in an actionable, centralized manner when their account balance dips below safety buffers, when an unexpectedly large debit occurs, or when discretionary category spend (e.g., dining, shopping) spikes abnormally.

### 2.2 Finora's Value Proposition
Finora provides an intuitive, distraction-free financial dashboard featuring:
- **Net Cash Flow Ledger:** Instant balance, total income, and total expense computation from recorded transactions.
- **Automated Banking Anomaly Alerts:** Active background rules engine evaluating 4 critical banking conditions:
  - `large_transaction`: Flags single high-value debits (expense $\ge$ ₹5,000).
  - `low_balance`: Warns when liquid balance falls below ₹5,000.
  - `upcoming_bill`: Alerts users to imminent deductions.
  - `unusual_spending`: Identifies weekly category expenditure surges exceeding rolling averages by >50%.
- **Actionable Bill Scheduler & Rollover:** Categorization of payments into `upcoming`, `overdue`, and `paid` with automatic month-end rollover for recurring bills.
- **Privacy & Performance:** Zero third-party trackers, zero bloated front-end dependencies, and local/self-hosted database control.

---

## 3. Architecture & How It Works

Finora is implemented as a decoupled client-server architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (Client Tier)                          │
│         Vanilla HTML5 / CSS3 / ES6 JavaScript (No Build Step)          │
│                                                                        │
│   index.html          dashboard.html        transactions.html          │
│   alerts.html         reminders.html        css/style.css              │
│                                                                        │
│        Shared API Layer: js/api.js (JWT Interceptor & Guards)          │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP / JSON (REST API)
                                    │ Authorization: Bearer <token>
┌───────────────────────────────────▼────────────────────────────────────┐
│                        Backend (Server Tier)                           │
│                 Node.js / Express 5 API (Port 5000)                    │
│                                                                        │
│   CORS & Rate Limiter ──► Auth Middleware ──► Zod Validation Pipeline  │
│                                                       │                │
│   Services:                                           │                │
│     • alertEngine.js   (Anomaly & Risk Detection)     ▼                │
│   Routes:                                           better-sqlite3     │
│     • /api/auth         (Register, Login, Me)       (WAL mode, In-Mem) │
│     • /api/transactions (CRUD Ledger, Pagination)   Database: finora.db│
│     • /api/alerts       (Notifications & Mark Read)                    │
│     • /api/reminders    (Bill Schedule & Rollover)                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Frontend Subsystem
- **Page Breakdown:**
  - `index.html` ([index.html](file:///C:/Users/Astha%20Singh/OneDrive/Desktop/Finora/index.html)): Tabbed portal switching between Login and Create Account, with input validation and instant redirect.
  - `dashboard.html` ([dashboard.html](file:///C:/Users/Astha%20Singh/OneDrive/Desktop/Finora/dashboard.html)): Aggregates lifetime financial metrics into 4 summary cards, renders the 5 most recent transactions, and highlights the top 3 upcoming bill reminders.
  - `transactions.html` ([transactions.html](file:///C:/Users/Astha%20Singh/OneDrive/Desktop/Finora/transactions.html)): Comprehensive financial ledger supporting server-side pagination, live search, category filtering, multi-attribute sorting, inline additions, row-level deletions, and an interactive edit modal.
  - `alerts.html` ([alerts.html](file:///C:/Users/Astha%20Singh/OneDrive/Desktop/Finora/alerts.html)): Notification feed with type filtering, severity tags, single "Mark Read", and batch "Mark All Read".
  - `reminders.html` ([reminders.html](file:///C:/Users/Astha%20Singh/OneDrive/Desktop/Finora/reminders.html)): Bill payment schedule supporting recurring flags, date-driven overdue calculations, status filtering, one-click payment with rollover, and deletion.
- **Centralized Fetch Engine (`js/api.js`):**
  - Manages JWT token storage and retrieval via `localStorage`.
  - Automatically injects the `Authorization: Bearer <token>` header on all requests.
  - Handles network failures and intercepts `401 Unauthorized` responses to clear sessions and redirect users to `index.html`.

### 3.2 Backend Subsystem (`finora-api/`)
- **Server Entrypoint (`src/server.js`):**
  - Configures dynamic environment loading with fail-hard validation for required security secrets (`JWT_SECRET`).
  - Implements CORS policies supporting dev servers (`localhost:3000`, `localhost:5500`, `127.0.0.1:5500`) and local file browsing (`origin === 'null'`).
  - Exposes `/health` endpoint and mounts modular API routers.
- **Relational Database (`src/db.js`):**
  - Uses `better-sqlite3` supporting both persistent disk storage (WAL mode) and isolated in-memory testing (`:memory:`).
  - Schema defines 4 relational tables (`users`, `transactions`, `alerts`, `reminders`) with foreign-key indexes on `user_id`.
- **Automated Alert Rules Engine (`src/services/alertEngine.js`):**
  - Evaluates transactions inside atomic SQLite transactions.
  - Synthesizes `large_transaction` alerts for single expenses $\ge$ ₹5,000.
  - Synthesizes `low_balance` alerts when total completed net balance drops below ₹5,000.
  - Synthesizes `unusual_spending` alerts when trailing 7-day category spend exceeds rolling 4-week weekly average by >50%.
- **Reminder Rollover Logic (`src/routes/reminders.routes.js`):**
  - When a recurring reminder is marked `paid`, the server marks the current reminder as `paid` and automatically spawns the next month's reminder, accounting for month-end dates (e.g., Jan 31 $\to$ Feb 28).
- **Validation Layer (`src/validators/`):**
  - Uses **Zod 4** schemas across all mutation and update routes (`transactions`, `alerts`, `reminders`, `auth`).

---

## 4. Feature Completion Matrix

| Module | Feature | Status | Implementation Details |
| :--- | :--- | :---: | :--- |
| **Authentication** | User Login | ✅ **100%** | Form validation, JWT issuance, rate limiting, token persistence |
| | User Registration API | ✅ **100%** | `POST /api/auth/register` with duplicate check, bcrypt hashing, JWT return |
| | User Registration UI | ✅ **100%** | Tabbed switch in `index.html`, password match validation, instant login |
| | Security Fail-Hard Checks | ✅ **100%** | Zero hardcoded fallback secrets; throws fatal error if `JWT_SECRET` missing |
| | Auth Guards & Route Security | ✅ **100%** | Frontend redirects unauthenticated users; backend blocks without token |
| **Dashboard** | Financial Summary Cards | ✅ **100%** | Real-time calculation of Net Balance, Income, Expenses, Unread Alerts |
| | Recent Transactions Feed | ✅ **100%** | Top 5 records sorted by date descending |
| | Upcoming Reminders Widget | ✅ **100%** | Displays top 3 pending bills with overdue/upcoming badges |
| | Loading & Network Error States | ✅ **100%** | Skeleton loaders and descriptive server disconnection alerts |
| **Transactions** | Ledger Table Display | ✅ **100%** | Formatted Indian Rupee (₹) amounts, colored debits/credits |
| | Add Transaction | ✅ **100%** | Form input validation, instant DOM update, SQLite insert |
| | Edit Transaction | ✅ **100%** | `PATCH /api/transactions/:id` endpoint + modal dialog in `transactions.html` |
| | Delete Transaction | ✅ **100%** | Scoped to authenticated user, confirmation/loading feedback |
| | Server-side Pagination | ✅ **100%** | Query params `?page=1&limit=20`, total records & page indicator |
| | Search & Filtering | ✅ **100%** | Live search by merchant or category, category dropdown filter |
| | Multi-Attribute Sorting | ✅ **100%** | Sort by date (asc/desc) and amount (asc/desc) |
| **Alerts** | View Alerts Feed | ✅ **100%** | Badges for 4 alert categories, sorted chronologically |
| | Filter Alerts by Type | ✅ **100%** | Interactive dropdown filter for all 4 alert types |
| | Mark Single Alert Read | ✅ **100%** | `PATCH /api/alerts/:id/read` updates database state |
| | Mark All Alerts Read | ✅ **100%** | `PATCH /api/alerts/read-all` batch updates unread alerts |
| | Automated Anomaly Engine | ✅ **100%** | `src/services/alertEngine.js` triggers on large debits, low balance, unusual spend |
| **Reminders** | View Bill Schedule | ✅ **100%** | Sorted by due date, recurring badges, status badges |
| | Dynamic Status Calculation | ✅ **100%** | Compares `due_date < today` on load to toggle `upcoming`/`overdue` |
| | Add Bill Reminder | ✅ **100%** | Name, amount, date, and recurring checkbox |
| | Mark Bill Paid & Rollover | ✅ **100%** | `PATCH /api/reminders/:id` sets paid and generates next month cycle |
| | Delete Reminder | ✅ **100%** | Removes record from database and updates DOM |
| **Database & Tests**| SQLite Schema & Indexes | ✅ **100%** | WAL mode, foreign keys, indexed `user_id` columns, `:memory:` test support |
| | Idempotent Data Seeder | ✅ **100%** | `npm run seed` seeds realistic demo environment |
| | Zod Request Validation | ✅ **100%** | Strict schemas on all create and update routes |
| | Automated Integration Tests | ✅ **100%** | 16 tests passing in `tests/api.test.js` (Jest + Supertest) |

---

## 5. Completion Breakdown by Module

```
Authentication & Security   [████████████████████] 100%
Dashboard Overview          [████████████████████] 100%
Transactions Management     [████████████████████] 100%
Alerts & Notifications      [████████████████████] 100%
Payment Reminders           [████████████████████] 100%
Backend Architecture & DB   [████████████████████] 100%
Testing & Test Automation   [████████████████████] 100%
Deployment & DevOps         [████████████░░░░░░░░] 60%

OVERALL PROJECT COMPLETION: 96%
```

---

## 6. How to Run and Verify the Project

### 1. Run Automated Test Suite
From the backend directory:
```bash
cd "finora-api"
npm test
```
*Expected Result: 16 integration tests pass across Auth, Transactions, Alert Rules, and Reminders.*

### 2. Seed the Database
```bash
npm run seed
```
*Expected Result: Populates `finora.db` with demo user `john@example.com` / `demo123`, 30 transactions, 6 alerts, and 5 bill reminders.*

### 3. Start the Server
```bash
npm run dev
```
*Starts API on `http://localhost:5000` with hot-reloading.*

### 4. Serve the Frontend
Open the project root directory with any static server (e.g., Live Server on port 5500 or `npx serve .`).
Visit `index.html` to log in with demo credentials or create a new account.
