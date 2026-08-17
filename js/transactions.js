const session = JSON.parse(localStorage.getItem("finora_session"));
if (!session) window.location.href = "index.html";

let filteredTransactions = [...TRANSACTIONS];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("finora_session");
    window.location.href = "index.html";
  });

  populateCategoryFilter();
  renderTable(filteredTransactions);

  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("categoryFilter").addEventListener("change", applyFilters);
  document.getElementById("sortBy").addEventListener("change", applyFilters);

  // Restore last used filters from Local Storage (nice UX touch from Day 4 plan)
  restoreFilterState();
});

function populateCategoryFilter() {
  const categories = [...new Set(TRANSACTIONS.map(t => t.category))].sort();
  const select = document.getElementById("categoryFilter");
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

  filteredTransactions = TRANSACTIONS.filter(t => {
    const matchesSearch =
      t.merchant.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search);
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
    case "amount-desc": return sorted.sort((a, b) => b.amount - a.amount);
    case "amount-asc": return sorted.sort((a, b) => a.amount - b.amount);
    default: return sorted;
  }
}

function renderTable(list) {
  const tbody = document.getElementById("transactionsTableBody");
  const noResults = document.getElementById("noResults");

  if (list.length === 0) {
    tbody.innerHTML = "";
    noResults.style.display = "block";
    return;
  }
  noResults.style.display = "none";

  tbody.innerHTML = list.map(t => `
    <tr>
      <td>${t.date}</td>
      <td>${t.merchant}</td>
      <td>${t.category}</td>
      <td><span class="status-badge ${t.status}">${t.status}</span></td>
      <td class="text-right ${t.amount > 0 ? 'positive' : 'negative'}">
        ${t.amount > 0 ? '+' : ''}₹${Math.abs(t.amount).toLocaleString()}
      </td>
    </tr>
  `).join("");
}

// Persist filter/sort state across page reloads
function saveFilterState(state) {
  localStorage.setItem("finora_txn_filters", JSON.stringify(state));
}

function restoreFilterState() {
  const saved = JSON.parse(localStorage.getItem("finora_txn_filters"));
  if (!saved) return;

  document.getElementById("searchInput").value = saved.search || "";
  document.getElementById("categoryFilter").value = saved.category || "all";
  document.getElementById("sortBy").value = saved.sortBy || "date-desc";

  applyFilters();
}