// Synchronous auth check
if (!localStorage.getItem("token")) {
  window.location.href = "index.html";
}

let allReminders = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Verify auth in background
  checkAuth().catch(() => {});

  const list = document.getElementById("remindersList");
  list.innerHTML = '<li class="list-item"><span class="item-sub">Loading reminders...</span></li>';

  // Event delegation for mark paid and delete buttons
  list.addEventListener("click", async (e) => {
    const paidBtn = e.target.closest(".mark-paid-btn");
    if (paidBtn && paidBtn.dataset.id) {
      paidBtn.disabled = true;
      paidBtn.textContent = "Updating...";
      await markAsPaid(paidBtn.dataset.id);
      return;
    }

    const delBtn = e.target.closest(".delete-btn");
    if (delBtn && delBtn.dataset.id) {
      delBtn.disabled = true;
      delBtn.textContent = "Deleting...";
      await deleteReminder(delBtn.dataset.id);
    }
  });

  document.getElementById("reminderForm").addEventListener("submit", handleAddReminder);
  document.getElementById("statusFilter").addEventListener("change", renderReminders);

  // Fetch reminders from API
  try {
    const res = await apiFetch("/reminders");
    allReminders = res?.data || [];
    updateReminderStatuses();
    renderReminders();
  } catch (err) {
    console.error("Failed to load reminders:", err);
    const errorMsg = err.isNetworkError
      ? "Unable to connect to the Finora server. Please make sure the API is running and try again."
      : (err.message || "Failed to load reminders.");
    list.innerHTML = `<li class="list-item"><span class="item-sub error-message">${errorMsg}</span></li>`;
  }
});

function updateReminderStatuses() {
  const today = new Date().toISOString().split("T")[0];
  allReminders.forEach(r => {
    const dueDate = r.due_date || r.dueDate;
    if (r.status !== "paid" && dueDate) {
      r.status = dueDate < today ? "overdue" : "upcoming";
    }
  });
}

async function handleAddReminder(e) {
  e.preventDefault();
  const errorEl = document.getElementById("reminderFormError");
  errorEl.textContent = "";

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const billName = document.getElementById("billName").value.trim();
  const billAmount = parseFloat(document.getElementById("billAmount").value);
  const billDueDate = document.getElementById("billDueDate").value;
  const billRecurring = document.getElementById("billRecurring").checked;

  if (!billName || isNaN(billAmount) || !billDueDate) {
    errorEl.textContent = "Please fill in all fields.";
    return;
  }
  if (billAmount <= 0) {
    errorEl.textContent = "Amount must be greater than 0.";
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const status = billDueDate < today ? "overdue" : "upcoming";

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Adding...";
  }

  try {
    const res = await apiFetch("/reminders", {
      method: "POST",
      body: JSON.stringify({
        bill_name: billName,
        amount: billAmount,
        due_date: billDueDate,
        recurring: billRecurring,
        status: status
      })
    });

    if (res?.data) {
      allReminders.push(res.data);
      updateReminderStatuses();
      renderReminders();
      e.target.reset();
    }
  } catch (err) {
    console.error("Failed to add reminder:", err);
    errorEl.textContent = err.message || "Failed to add reminder.";
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Add Reminder";
    }
  }
}

async function markAsPaid(id) {
  try {
    await apiFetch(`/reminders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paid" })
    });
    const reminder = allReminders.find(r => String(r.id) === String(id));
    if (reminder) {
      reminder.status = "paid";
      renderReminders();
    }
  } catch (err) {
    console.error("Failed to mark reminder as paid:", err);
    window.alert(err.message || "Failed to mark reminder as paid.");
    renderReminders();
  }
}

async function deleteReminder(id) {
  try {
    await apiFetch(`/reminders/${id}`, {
      method: "DELETE"
    });
    allReminders = allReminders.filter(r => String(r.id) !== String(id));
    renderReminders();
  } catch (err) {
    console.error("Failed to delete reminder:", err);
    window.alert(err.message || "Failed to delete reminder.");
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

  filtered = [...filtered].sort((a, b) => {
    const dateA = a.due_date || a.dueDate || "";
    const dateB = b.due_date || b.dueDate || "";
    return new Date(dateA) - new Date(dateB);
  });

  if (filtered.length === 0) {
    list.innerHTML = "";
    noResults.classList.remove("hidden");
    noResults.style.display = "block";
    return;
  }
  noResults.classList.add("hidden");
  noResults.style.display = "none";

  list.innerHTML = filtered.map(r => {
    const billName = r.bill_name || r.billName;
    const dueDate = r.due_date || r.dueDate;
    const amount = Number(r.amount);
    const recurring = Boolean(r.recurring);
    const status = r.status;

    return `
      <li class="list-item reminder-item">
        <div>
          <p class="item-title">${billName} ${recurring ? '<span class="recurring-tag">Recurring</span>' : ''}</p>
          <p class="item-sub">Due ${dueDate} · ₹${amount.toLocaleString()}</p>
        </div>
        <div class="reminder-actions">
          <span class="item-status ${status}">${status}</span>
          ${status !== "paid" ? `<button class="mark-paid-btn" data-id="${r.id}">Mark Paid</button>` : ''}
          <button class="delete-btn" data-id="${r.id}">Delete</button>
        </div>
      </li>
    `;
  }).join("");
}

// Expose markAsPaid and deleteReminder on window for inline/global/test access
window.markAsPaid = markAsPaid;
window.deleteReminder = deleteReminder;