const session = JSON.parse(localStorage.getItem("finora_session"));
if (!session) window.location.href = "index.html";

let allAlerts = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("finora_session");
    window.location.href = "index.html";
  });

  loadAlerts();
  renderAlerts();

  document.getElementById("typeFilter").addEventListener("change", renderAlerts);
  document.getElementById("markAllReadBtn").addEventListener("click", markAllRead);
});

// Merge mock ALERTS with any read/unread state changes saved in Local Storage
function loadAlerts() {
  const savedState = JSON.parse(localStorage.getItem("finora_alert_state")) || {};
  allAlerts = ALERTS.map(a => ({
    ...a,
    read: savedState[a.id] !== undefined ? savedState[a.id] : a.read
  }));
}

function saveAlertState() {
  const state = {};
  allAlerts.forEach(a => { state[a.id] = a.read; });
  localStorage.setItem("finora_alert_state", JSON.stringify(state));
}

function markAsRead(id) {
  const alert = allAlerts.find(a => a.id === id);
  if (alert) {
    alert.read = true;
    saveAlertState();
    renderAlerts();
  }
}

function markAllRead() {
  allAlerts.forEach(a => a.read = true);
  saveAlertState();
  renderAlerts();
}

function renderAlerts() {
  const filter = document.getElementById("typeFilter").value;
  const list = document.getElementById("alertsList");
  const noResults = document.getElementById("noAlerts");

  let filtered = filter === "all"
    ? allAlerts
    : allAlerts.filter(a => a.type === filter);

  filtered = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    list.innerHTML = "";
    noResults.style.display = "block";
    return;
  }
  noResults.style.display = "none";

  list.innerHTML = filtered.map(a => `
    <li class="list-item alert-item ${a.read ? '' : 'unread'}">
      <div>
        <p class="item-title">
          <span class="alert-type-tag ${a.type}">${formatType(a.type)}</span>
          ${a.message}
        </p>
        <p class="item-sub">${a.date}</p>
      </div>
      ${!a.read ? `<button class="mark-read-btn" onclick="markAsRead('${a.id}')">Mark Read</button>` : '<span class="read-label">Read</span>'}
    </li>
  `).join("");
}

function formatType(type) {
  const labels = {
    large_transaction: "Large Transaction",
    low_balance: "Low Balance",
    upcoming_bill: "Upcoming Bill",
    unusual_spending: "Unusual Spending"
  };
  return labels[type] || type;
}