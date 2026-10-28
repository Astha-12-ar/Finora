// Synchronous auth check
if (!localStorage.getItem("token")) {
  window.location.href = "index.html";
}

let currentTransactions = [];
let currentPage = 1;
const pageSize = 20;
let totalPages = 1;
let totalRecords = 0;
let knownCategories = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Verify auth in background
  checkAuth().catch(() => {});

  // Setup Add Transaction form
  const txnForm = document.getElementById("transactionForm");
  if (txnForm) {
    txnForm.addEventListener("submit", handleAddTransaction);
  }

  // Setup Edit Transaction modal form & controls
  const editForm = document.getElementById("editTransactionForm");
  const editModal = document.getElementById("editModal");
  const closeEditBtn = document.getElementById("closeEditModalBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  if (editForm) {
    editForm.addEventListener("submit", handleSaveEditTransaction);
  }

  if (closeEditBtn && editModal) {
    closeEditBtn.addEventListener("click", () => editModal.classList.add("hidden"));
  }
  if (cancelEditBtn && editModal) {
    cancelEditBtn.addEventListener("click", () => editModal.classList.add("hidden"));
  }

  // Close modal on click outside modal card
  if (editModal) {
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) {
        editModal.classList.add("hidden");
      }
    });
  }

  // Setup table event delegation for Edit and Delete
  const tbody = document.getElementById("transactionsTableBody");
  tbody.addEventListener("click", async (e) => {
    // Delete action
    const delBtn = e.target.closest(".delete-btn");
    if (delBtn && delBtn.dataset.id) {
      if (window.confirm("Are you sure you want to delete this transaction?")) {
        delBtn.disabled = true;
        delBtn.textContent = "Deleting...";
        await deleteTransaction(delBtn.dataset.id);
      }
      return;
    }

    // Edit action
    const editBtn = e.target.closest(".edit-btn");
    if (editBtn && editBtn.dataset.id) {
      openEditModal(editBtn.dataset.id);
    }
  });

  // Filter & Sort event listeners
  document.getElementById("searchInput").addEventListener("input", () => {
    currentPage = 1;
    saveFilterState();
    loadTransactions();
  });

  document.getElementById("categoryFilter").addEventListener("change", () => {
    currentPage = 1;
    saveFilterState();
    loadTransactions();
  });

  document.getElementById("sortBy").addEventListener("change", () => {
    currentPage = 1;
    saveFilterState();
    loadTransactions();
  });

  // Pagination controls
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadTransactions();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadTransactions();
      }
    });
  }

  // Restore filter state and load initial page
  restoreFilterState();
  await initialCategoryLoad();
  await loadTransactions();
});

// Pre-load all available categories for the dropdown filter
async function initialCategoryLoad() {
  try {
    const res = await apiFetch("/transactions");
    if (res && res.data) {
      res.data.forEach(t => {
        if (t.category) knownCategories.add(t.category);
      });
      populateCategoryFilter();
    }
  } catch (e) {
    console.warn("Could not pre-populate categories:", e);
  }
}

function populateCategoryFilter() {
  const select = document.getElementById("categoryFilter");
  const currentVal = select.value;
  const categories = [...knownCategories].sort();

  select.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (cat === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

// Server-side fetching with pagination and active filters
async function loadTransactions() {
  const tbody = document.getElementById("transactionsTableBody");
  const search = document.getElementById("searchInput").value.trim();
  const category = document.getElementById("categoryFilter").value;
  const sortBy = document.getElementById("sortBy").value;

  tbody.innerHTML = '<tr><td colspan="6" class="no-results">Loading transactions...</td></tr>';

  const params = new URLSearchParams({
    page: String(currentPage),
    limit: String(pageSize),
    sort: sortBy
  });

  if (search) params.append("search", search);
  if (category && category !== "all") params.append("category", category);

  try {
    const res = await apiFetch(`/transactions?${params.toString()}`);
    currentTransactions = res?.data || [];

    if (res?.pagination) {
      currentPage = res.pagination.page;
      totalPages = res.pagination.totalPages;
      totalRecords = res.pagination.totalRecords;
    } else {
      totalPages = 1;
      totalRecords = currentTransactions.length;
    }

    renderTable(currentTransactions);
    updatePaginationControls();
  } catch (err) {
    console.error("Failed to load transactions:", err);
    const errorMsg = err.isNetworkError
      ? "Unable to connect to the Finora server. Please make sure the API is running and try again."
      : (err.message || "Failed to load transactions.");
    tbody.innerHTML = `<tr><td colspan="6" class="no-results error-message">${errorMsg}</td></tr>`;
  }
}

function updatePaginationControls() {
  const pageIndicator = document.getElementById("pageIndicator");
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  if (pageIndicator) {
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages} (${totalRecords} records)`;
  }
  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
  }
}

function renderTable(list) {
  const tbody = document.getElementById("transactionsTableBody");
  const noResults = document.getElementById("noResults");

  if (!list || list.length === 0) {
    tbody.innerHTML = "";
    if (noResults) {
      noResults.classList.remove("hidden");
      noResults.style.display = "block";
    }
    return;
  }

  if (noResults) {
    noResults.classList.add("hidden");
    noResults.style.display = "none";
  }

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
          <button class="edit-btn" data-id="${t.id}">Edit</button>
          <button class="delete-btn" data-id="${t.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

// ---------------- ADD TRANSACTION ----------------
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
    await apiFetch("/transactions", {
      method: "POST",
      body: JSON.stringify({ date, merchant, category, amount, status })
    });

    e.target.reset();
    knownCategories.add(category);
    populateCategoryFilter();
    currentPage = 1;
    await loadTransactions();
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

// ---------------- EDIT TRANSACTION ----------------
function openEditModal(id) {
  const t = currentTransactions.find(item => String(item.id) === String(id));
  if (!t) return;

  document.getElementById("editTxnId").value = t.id;
  document.getElementById("editTxnDate").value = t.date;
  document.getElementById("editTxnMerchant").value = t.merchant;
  document.getElementById("editTxnCategory").value = t.category;
  document.getElementById("editTxnAmount").value = t.amount;
  document.getElementById("editTxnStatus").value = t.status || "completed";

  const errorEl = document.getElementById("editTxnError");
  if (errorEl) errorEl.textContent = "";

  const modal = document.getElementById("editModal");
  if (modal) modal.classList.remove("hidden");
}

async function handleSaveEditTransaction(e) {
  e.preventDefault();
  const errorEl = document.getElementById("editTxnError");
  if (errorEl) errorEl.textContent = "";

  const saveBtn = document.getElementById("saveEditBtn");
  const id = document.getElementById("editTxnId").value;
  const date = document.getElementById("editTxnDate").value;
  const merchant = document.getElementById("editTxnMerchant").value.trim();
  const category = document.getElementById("editTxnCategory").value.trim();
  const amountVal = document.getElementById("editTxnAmount").value;
  const status = document.getElementById("editTxnStatus").value;

  if (!date || !merchant || !category || amountVal === "") {
    if (errorEl) errorEl.textContent = "Please fill in all fields.";
    return;
  }

  const amount = Number(amountVal);
  if (isNaN(amount) || amount === 0) {
    if (errorEl) errorEl.textContent = "Amount must be a non-zero number.";
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    await apiFetch(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ date, merchant, category, amount, status })
    });

    knownCategories.add(category);
    populateCategoryFilter();

    const modal = document.getElementById("editModal");
    if (modal) modal.classList.add("hidden");

    await loadTransactions();
  } catch (err) {
    console.error("Failed to update transaction:", err);
    if (errorEl) errorEl.textContent = err.message || "Failed to update transaction.";
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  }
}

// ---------------- DELETE TRANSACTION ----------------
async function deleteTransaction(id) {
  try {
    await apiFetch(`/transactions/${id}`, {
      method: "DELETE"
    });
    // If last record on current page was deleted, step back a page
    if (currentTransactions.length === 1 && currentPage > 1) {
      currentPage--;
    }
    await loadTransactions();
  } catch (err) {
    console.error("Failed to delete transaction:", err);
    window.alert(err.message || "Failed to delete transaction.");
    await loadTransactions();
  }
}

// ---------------- FILTER PERSISTENCE ----------------
function saveFilterState() {
  const search = document.getElementById("searchInput").value;
  const category = document.getElementById("categoryFilter").value;
  const sortBy = document.getElementById("sortBy").value;
  localStorage.setItem("finora_txn_filters", JSON.stringify({ search, category, sortBy }));
}

function restoreFilterState() {
  try {
    const saved = JSON.parse(localStorage.getItem("finora_txn_filters"));
    if (saved) {
      if (saved.search) document.getElementById("searchInput").value = saved.search;
      if (saved.category) document.getElementById("categoryFilter").value = saved.category;
      if (saved.sortBy) document.getElementById("sortBy").value = saved.sortBy;
    }
  } catch (e) {
    // Ignore parse error
  }
}

window.loadTransactions = loadTransactions;
window.deleteTransaction = deleteTransaction;