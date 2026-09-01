const session = JSON.parse(localStorage.getItem("finora_session"));
if (!session) window.location.href = "index.html";

let allReminders = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("finora_session");
    window.location.href = "index.html";
  });

  loadReminders();
  updateReminderStatuses();
  renderReminders();

  document.getElementById("reminderForm").addEventListener("submit", handleAddReminder);
  document.getElementById("statusFilter").addEventListener("change", renderReminders);
});

// Load mock REMINDERS merged with custom ones and status overrides
function loadReminders() {
  allReminders = typeof getStoredReminders === "function" ? getStoredReminders() : [...REMINDERS];
}

function saveReminders() {
  if (typeof saveStoredReminders === "function") {
    saveStoredReminders(allReminders);
  } else {
    const mockIds = new Set(REMINDERS.map(r => r.id));
    const custom = allReminders.filter(r => !mockIds.has(r.id));
    localStorage.setItem("finora_custom_reminders", JSON.stringify(custom));

    const statuses = {};
    allReminders.forEach(r => {
      if (r.status) statuses[r.id] = r.status;
    });
    localStorage.setItem("finora_reminder_statuses", JSON.stringify(statuses));
  }
}

function updateReminderStatuses() {
  const today = new Date().toISOString().split("T")[0];
  allReminders.forEach(r => {
    if (r.status !== "paid") {
      r.status = r.dueDate < today ? "overdue" : "upcoming";
    }
  });
}

function handleAddReminder(e) {
  e.preventDefault();
  const errorEl = document.getElementById("reminderFormError");
  errorEl.textContent = "";

  const billName = document.getElementById("billName").value.trim();
  const billAmount = parseFloat(document.getElementById("billAmount").value);
  const billDueDate = document.getElementById("billDueDate").value;
  const billRecurring = document.getElementById("billRecurring").checked;

  if (!billName || !billAmount || !billDueDate) {
    errorEl.textContent = "Please fill in all fields.";
    return;
  }
  if (billAmount <= 0) {
    errorEl.textContent = "Amount must be greater than 0.";
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const newReminder = {
    id: "r" + Date.now(),
    billName,
    amount: billAmount,
    dueDate: billDueDate,
    recurring: billRecurring,
    status: billDueDate < today ? "overdue" : "upcoming"
  };

  allReminders.push(newReminder);
  updateReminderStatuses();
  saveReminders();
  renderReminders();

  e.target.reset();
}

function markAsPaid(id) {
  const reminder = allReminders.find(r => r.id === id);
  if (reminder) {
    reminder.status = "paid";
    saveReminders();
    renderReminders();
  }
}

function renderReminders() {
  const filter = document.getElementById("statusFilter").value;
  const list = document.getElementById("remindersList");
  const noResults = document.getElementById("noReminders");

  let filtered = filter === "all"
    ? allReminders
    : allReminders.filter(r => r.status === filter);

  filtered = [...filtered].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (filtered.length === 0) {
    list.innerHTML = "";
    noResults.classList.remove("hidden");
    noResults.style.display = "block";
    return;
  }
  noResults.classList.add("hidden");
  noResults.style.display = "none";

  list.innerHTML = filtered.map(r => `
    <li class="list-item reminder-item">
      <div>
        <p class="item-title">${r.billName} ${r.recurring ? '<span class="recurring-tag">Recurring</span>' : ''}</p>
        <p class="item-sub">Due ${r.dueDate} · ₹${r.amount.toLocaleString()}</p>
      </div>
      <div class="reminder-actions">
        <span class="item-status ${r.status}">${r.status}</span>
        ${r.status !== "paid" ? `<button class="mark-paid-btn" onclick="markAsPaid('${r.id}')">Mark Paid</button>` : ''}
      </div>
    </li>
  `).join("");
}