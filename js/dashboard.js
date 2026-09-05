// Synchronous auth check
if (!localStorage.getItem("token")) {
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Display user name from cache or /api/auth/me
  const cachedUser = getUser();
  if (cachedUser && cachedUser.name) {
    document.getElementById("userName").textContent = cachedUser.name;
  }

  // Verify auth with backend
  checkAuth().then(user => {
    if (user && user.name) {
      document.getElementById("userName").textContent = user.name;
    }
  }).catch(() => {});

  // Show loading indicators
  document.getElementById("recentTransactions").innerHTML =
    '<li class="list-item"><span class="item-sub">Loading transactions...</span></li>';
  document.getElementById("upcomingReminders").innerHTML =
    '<li class="list-item"><span class="item-sub">Loading reminders...</span></li>';
  document.getElementById("balanceValue").textContent = "...";
  document.getElementById("incomeValue").textContent = "...";
  document.getElementById("expenseValue").textContent = "...";
  document.getElementById("alertCount").textContent = "...";

  // Fetch real data from API
  try {
    const [txRes, alertsRes, remindersRes] = await Promise.all([
      apiFetch("/transactions"),
      apiFetch("/alerts"),
      apiFetch("/reminders")
    ]);

    const transactions = txRes?.data || [];
    const alerts = alertsRes?.data || [];
    const reminders = remindersRes?.data || [];

    renderSummaryCards(transactions, alerts);
    renderRecentTransactions(transactions);
    renderUpcomingReminders(reminders);
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    const errorMsg = err.isNetworkError
      ? "Unable to connect to the Finora server. Please make sure the API is running and try again."
      : (err.message || "Failed to load dashboard data.");

    document.getElementById("recentTransactions").innerHTML =
      `<li class="list-item"><span class="item-sub error-message">${errorMsg}</span></li>`;
    document.getElementById("upcomingReminders").innerHTML =
      `<li class="list-item"><span class="item-sub error-message">${errorMsg}</span></li>`;
    document.getElementById("balanceValue").textContent = "—";
    document.getElementById("incomeValue").textContent = "—";
    document.getElementById("expenseValue").textContent = "—";
    document.getElementById("alertCount").textContent = "—";
  }
});

function renderSummaryCards(transactions, alerts) {
  const income = transactions
    .filter(t => Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = transactions
    .filter(t => Number(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const balance = income - expenses;
  const unreadAlerts = alerts.filter(a => !a.read).length;

  document.getElementById("balanceValue").textContent = balance < 0
    ? `-₹${Math.abs(balance).toLocaleString()}`
    : `₹${balance.toLocaleString()}`;
  document.getElementById("incomeValue").textContent = `₹${income.toLocaleString()}`;
  document.getElementById("expenseValue").textContent = `₹${expenses.toLocaleString()}`;
  document.getElementById("alertCount").textContent = unreadAlerts;
}

function renderRecentTransactions(transactions) {
  const list = document.getElementById("recentTransactions");
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (recent.length === 0) {
    list.innerHTML = '<li class="list-item"><span class="item-sub">No recent transactions.</span></li>';
    return;
  }

  list.innerHTML = recent.map(t => {
    const amount = Number(t.amount);
    return `
      <li class="list-item">
        <div>
          <p class="item-title">${t.merchant}</p>
          <p class="item-sub">${t.category} · ${t.date}</p>
        </div>
        <span class="item-amount ${amount > 0 ? 'positive' : 'negative'}">
          ${amount > 0 ? '+' : ''}₹${Math.abs(amount).toLocaleString()}
        </span>
      </li>
    `;
  }).join("");
}

function renderUpcomingReminders(reminders) {
  const list = document.getElementById("upcomingReminders");
  const upcoming = reminders
    .filter(r => r.status !== "paid")
    .sort((a, b) => new Date(a.due_date || a.dueDate) - new Date(b.due_date || b.dueDate))
    .slice(0, 3);

  if (upcoming.length === 0) {
    list.innerHTML = `<li class="list-item"><span class="item-sub">No upcoming reminders.</span></li>`;
    return;
  }

  list.innerHTML = upcoming.map(r => {
    const billName = r.bill_name || r.billName;
    const dueDate = r.due_date || r.dueDate;
    return `
      <li class="list-item">
        <div>
          <p class="item-title">${billName}</p>
          <p class="item-sub">Due ${dueDate}</p>
        </div>
        <span class="item-status ${r.status}">${r.status}</span>
      </li>
    `;
  }).join("");
}