// Redirect to login if no session exists
// Redirect to login if no session
const session = JSON.parse(localStorage.getItem("finora_session"));
if (!session) {
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // Greet user
  document.getElementById("userName").textContent = session.name;

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("finora_session");
    window.location.href = "index.html";
  });

  renderSummaryCards();
  renderRecentTransactions();
  renderUpcomingReminders();
});

function renderSummaryCards() {
  const income = TRANSACTIONS.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const expenses = TRANSACTIONS.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const balance = income - expenses;
  const unreadAlerts = ALERTS.filter(a => !a.read).length;

  document.getElementById("balanceValue").textContent = `₹${balance.toLocaleString()}`;
  document.getElementById("incomeValue").textContent = `₹${income.toLocaleString()}`;
  document.getElementById("expenseValue").textContent = `₹${expenses.toLocaleString()}`;
  document.getElementById("alertCount").textContent = unreadAlerts;
}

function renderRecentTransactions() {
  const list = document.getElementById("recentTransactions");
  const recent = [...TRANSACTIONS]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  list.innerHTML = recent.map(t => `
    <li class="list-item">
      <div>
        <p class="item-title">${t.merchant}</p>
        <p class="item-sub">${t.category} · ${t.date}</p>
      </div>
      <span class="item-amount ${t.amount > 0 ? 'positive' : 'negative'}">
        ${t.amount > 0 ? '+' : ''}₹${Math.abs(t.amount).toLocaleString()}
      </span>
    </li>
  `).join("");
}

function renderUpcomingReminders() {
  const list = document.getElementById("upcomingReminders");
  const upcoming = REMINDERS
    .filter(r => r.status !== "paid")
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  list.innerHTML = upcoming.map(r => `
    <li class="list-item">
      <div>
        <p class="item-title">${r.billName}</p>
        <p class="item-sub">Due ${r.dueDate}</p>
      </div>
      <span class="item-status ${r.status}">${r.status}</span>
    </li>
  `).join("");
}