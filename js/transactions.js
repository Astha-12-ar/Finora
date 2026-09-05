// Synchronous auth check
if (!localStorage.getItem("token")) {
  window.location.href = "index.html";
}

let allTransactions = [];
let filteredTransactions = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Verify auth in background
  checkAuth().catch(() => {});

  const tbody = document.getElementById("transactionsTableBody");
  tbody.innerHTML = '<tr><td colspan="6" class="no-results">Loading transactions...</td></tr>';

  // Form submit listener for adding transaction
  const txnForm = document.getElementById("transactionForm");
  if (txnForm) {
    txnForm.addEventListener("submit", handleAddTransaction);
  }

  // Event delegation for deleting transaction
  tbody.addEventListener("click", async (e) => {
    const delBtn = e.target.closest(".delete-btn");
    if (delBtn && delBtn.dataset.id) {
      delBtn.disabled = true;
      delBtn.textContent = "Deleting...";
      await deleteTransaction(delBtn.dataset.id);
    }
  });

  // Event listeners
  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("categoryFilter").addEventListener("change", applyFilters);
  document.getElementById("sortBy").addEventListener("change", applyFilters);

  // Fetch transactions from API
  try {
    const res = await apiFetch("/transactions");
    allTransactions = res?.data || [];
    filteredTransactions = [...allTransactions];

    populateCategoryFilter();
    restoreFilterState();
  } catch (err) {
    console.error("Failed to load transactions:", err);
    const errorMsg = err.isNetworkError
      ? "Unable to connect to the Finora server. Please make sure the API is running and try again."
      : (err.message || "Failed to load transactions.");
    tbody.innerHTML = `<tr><td colspan="6" class="no-results error-message">${errorMsg}</td></tr>`;
  }
});

async function handleAddTransaction(e) {
  e.preventDefault();
  const errorEl = document.getElementById("txnFormError");
  if (errorEl) errorEl.textContent = "";

  const submitBtn = document.getElementById("addTxnBtn");
  const date = document.getElementById("txnDate").value;
  const merchant = document.getElementById("txnMerchant").value.trim();
  const category = document.getElementById("txnCategory").value.trim();
  const amountVal = document.getElementById("txnAmount").value;
  const status = document.getElementById("txnStatus").value;

  if (!date || !merchant || !category || amountVal === "") {
    if (errorEl) errorEl.textContent = "Please fill in all fields.";
    return;
  }

  const amount = Number(amountVal);
  if (isNaN(amount) || amount === 0) {
    if (errorEl) errorEl.textContent = "Amount must be a non-zero number.";
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Adding...";
  }

  try {
    await addTransaction({ date, merchant, category, amount, status });
    e.target.reset();
  } catch (err) {
    console.error("Failed to add transaction:", err);
    if (errorEl) errorEl.textContent = err.message || "Failed to add transaction.";
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Add Transaction";
    }
  }
}

function populateCategoryFilter() {
  const categories = [...new Set(allTransactions.map(t => t.category))].sort();
  const select = document.getElementById("categoryFilter");
  select.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function applyFilters() {
  const search = document.getElementById("searchInput").value.toLowerCase().trim();
  const category = document.getElementById("categoryFilter").value;
  const sortBy = document.getElementById("sortBy").value;

  filteredTransactions = allTransactions.filter(t => {
    const matchesSearch =
      (t.merchant && t.merchant.toLowerCase().includes(search)) ||
      (t.category && t.category.toLowerCase().includes(search));
    const matchesCategory = category === "all" || t.category === category;
    return matchesSearch && matchesCategory;
  });

  filteredTransactions = sortTransactions(filteredTransactions, sortBy);

  saveFilterState({ search, category, sortBy });
  renderTable(filteredTransactions);
}

function sortTransactions(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case "date-desc": return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    case "date-asc": return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    case "amount-desc": return sorted.sort((a, b) => Number(b.amount) - Number(a.amount));
    case "amount-asc": return sorted.sort((a, b) => Number(a.amount) - Number(b.amount));
    default: return sorted;
  }
}

function renderTable(list) {
  const tbody = document.getElementById("transactionsTableBody");
  const noResults = document.getElementById("noResults");

  if (list.length === 0) {
    tbody.innerHTML = "";
    noResults.classList.remove("hidden");
    noResults.style.display = "block";
    return;
  }
  noResults.classList.add("hidden");
  noResults.style.display = "none";

  tbody.innerHTML = list.map(t => {
    const amount = Number(t.amount);
    return `
      <tr>
        <td>${t.date}</td>
        <td>${t.merchant}</td>
        <td>${t.category}</td>
        <td><span class="status-badge ${t.status}">${t.status}</span></td>
        <td class="text-right ${amount > 0 ? 'positive' : 'negative'}">
          ${amount > 0 ? '+' : ''}₹${Math.abs(amount).toLocaleString()}
        </td>
        <td class="text-right">
          <button class="delete-btn" data-id="${t.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

// Persist filter/sort state across page reloads
function saveFilterState(state) {
  localStorage.setItem("finora_txn_filters", JSON.stringify(state));
}

function restoreFilterState() {
  const saved = JSON.parse(localStorage.getItem("finora_txn_filters"));
  if (saved) {
    if (saved.search) document.getElementById("searchInput").value = saved.search;
    if (saved.category) document.getElementById("categoryFilter").value = saved.category;
    if (saved.sortBy) document.getElementById("sortBy").value = saved.sortBy;
  }
  applyFilters();
}

// API action helpers
async function addTransaction(transactionData) {
  const res = await apiFetch("/transactions", {
    method: "POST",
    body: JSON.stringify(transactionData)
  });
  if (res?.data) {
    allTransactions.unshift(res.data);
    populateCategoryFilter();
    applyFilters();
  }
  return res?.data;
}

async function deleteTransaction(id) {
  try {
    await apiFetch(`/transactions/${id}`, {
      method: "DELETE"
    });
    allTransactions = allTransactions.filter(t => String(t.id) !== String(id));
    populateCategoryFilter();
    applyFilters();
  } catch (err) {
    console.error("Failed to delete transaction:", err);
    window.alert(err.message || "Failed to delete transaction.");
    applyFilters();
  }
}

// Expose helpers on window
window.addTransaction = addTransaction;
window.deleteTransaction = deleteTransaction;