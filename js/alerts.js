// Synchronous auth check
if (!localStorage.getItem("token")) {
  window.location.href = "index.html";
}

let allAlerts = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Verify auth in background
  checkAuth().catch(() => {});

  const list = document.getElementById("alertsList");
  list.innerHTML = '<li class="list-item"><span class="item-sub">Loading alerts...</span></li>';

  // Event delegation for "Mark Read" buttons
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest(".mark-read-btn");
    if (btn && btn.dataset.id) {
      btn.disabled = true;
      btn.textContent = "Updating...";
      await markAsRead(btn.dataset.id);
    }
  });

  document.getElementById("typeFilter").addEventListener("change", renderAlerts);
  document.getElementById("markAllReadBtn").addEventListener("click", markAllRead);

  // Fetch alerts from API
  try {
    const res = await apiFetch("/alerts");
    allAlerts = res?.data || [];
    renderAlerts();
  } catch (err) {
    console.error("Failed to load alerts:", err);
    const errorMsg = err.isNetworkError
      ? "Unable to connect to the Finora server. Please make sure the API is running and try again."
      : (err.message || "Failed to load alerts.");
    list.innerHTML = `<li class="list-item"><span class="item-sub error-message">${errorMsg}</span></li>`;
  }
});

async function markAsRead(id) {
  try {
    await apiFetch(`/alerts/${id}/read`, {
      method: "PATCH",
      body: JSON.stringify({ read: true })
    });
    const targetAlert = allAlerts.find(a => String(a.id) === String(id));
    if (targetAlert) {
      targetAlert.read = true;
    }
    renderAlerts();
  } catch (err) {
    console.error("Failed to mark alert as read:", err);
    window.alert(err.message || "Failed to mark alert as read.");
    renderAlerts();
  }
}

async function markAllRead() {
  const btn = document.getElementById("markAllReadBtn");
  if (btn) btn.disabled = true;

  try {
    await apiFetch("/alerts/read-all", {
      method: "PATCH"
    });
    allAlerts.forEach(a => { a.read = true; });
    renderAlerts();
  } catch (err) {
    console.error("Failed to mark all alerts as read:", err);
    window.alert(err.message || "Failed to mark all alerts as read.");
  } finally {
    if (btn) btn.disabled = false;
  }
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
    noResults.classList.remove("hidden");
    noResults.style.display = "block";
    return;
  }
  noResults.classList.add("hidden");
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
      ${!a.read ? `<button class="mark-read-btn" data-id="${a.id}">Mark Read</button>` : '<span class="read-label">Read</span>'}
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

// Expose markAsRead and markAllRead on window for global/inline/test access
window.markAsRead = markAsRead;
window.markAllRead = markAllRead;