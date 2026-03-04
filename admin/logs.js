const refreshButton = document.getElementById("refreshButton");
const filtersForm = document.getElementById("filtersForm");
const resetFiltersButton = document.getElementById("resetFiltersButton");
const categoriesInput = document.getElementById("categoriesInput");
const levelsInput = document.getElementById("levelsInput");
const searchInput = document.getElementById("searchInput");
const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const bucketInput = document.getElementById("bucketInput");
const pageSizeInput = document.getElementById("pageSizeInput");
const statusMessage = document.getElementById("statusMessage");
const summaryInfo = document.getElementById("summaryInfo");
const chartInfo = document.getElementById("chartInfo");
const statsGrid = document.getElementById("statsGrid");
const eventsTable = document.getElementById("eventsTable");
const pageInfo = document.getElementById("pageInfo");
const prevPageButton = document.getElementById("prevPageButton");
const nextPageButton = document.getElementById("nextPageButton");

const errorsChart = {
  svg: document.getElementById("errorsChart"),
  current: document.getElementById("errorsCurrent"),
  meta: document.getElementById("errorsMeta"),
  colorClass: "line-cpu"
};

const warningsChart = {
  svg: document.getElementById("warningsChart"),
  current: document.getElementById("warningsCurrent"),
  meta: document.getElementById("warningsMeta"),
  colorClass: "line-disk"
};

let currentPage = 1;
let totalPages = 1;
let isLoading = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCookie(name) {
  const cookieString = document.cookie || "";
  const parts = cookieString.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part) continue;
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex);
    if (key !== name) continue;
    return decodeURIComponent(part.slice(eqIndex + 1));
  }
  return null;
}

function setStatus(text, type = "") {
  if (!statusMessage) return;
  statusMessage.textContent = text;
  statusMessage.className = `status ${type}`.trim();
}

function formatDate(ms) {
  const num = Number(ms || 0);
  if (!Number.isFinite(num) || num <= 0) return "--";
  const date = new Date(num);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function formatNumber(value, digits = 2) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toFixed(digits);
}

function getMultiSelectValues(selectElement) {
  if (!selectElement) return [];
  return Array.from(selectElement.selectedOptions || []).map((option) => option.value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildPolylinePoints(values, options = {}) {
  const width = Number(options.width || 420);
  const height = Number(options.height || 150);
  const padding = Number(options.padding || 10);
  const minY = Number(options.minY || 0);
  const maxY = Number(options.maxY || 100);
  const points = [];

  if (!Array.isArray(values) || values.length === 0) {
    return points;
  }

  const span = Math.max(1, maxY - minY);
  const xStep = values.length <= 1 ? 0 : (width - padding * 2) / (values.length - 1);

  for (let index = 0; index < values.length; index += 1) {
    const rawValue = Number(values[index] || 0);
    const normalized = clamp((rawValue - minY) / span, 0, 1);
    const x = padding + xStep * index;
    const y = height - padding - normalized * (height - padding * 2);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return points;
}

function renderChart(chart, values, valueLabel) {
  if (!chart?.svg || !chart.current || !chart.meta) return;

  if (!Array.isArray(values) || values.length === 0) {
    chart.current.textContent = "--";
    chart.meta.textContent = "No samples";
    chart.svg.innerHTML = "";
    return;
  }

  const latest = values[values.length - 1] || 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const maxY = Math.max(1, max);

  const points = buildPolylinePoints(values, {
    width: 420,
    height: 150,
    padding: 10,
    minY: 0,
    maxY
  });

  const baseline = buildPolylinePoints([0, 0], {
    width: 420,
    height: 150,
    padding: 10,
    minY: 0,
    maxY
  });

  chart.svg.innerHTML = `
    <polyline class="chart-baseline" points="${baseline.join(" ")}" />
    <polyline class="chart-line ${chart.colorClass}" points="${points.join(" ")}" />
  `;

  chart.current.textContent = `${latest}`;
  chart.meta.textContent = `Min ${min} · Max ${max} · ${values.length} buckets`;

  if (valueLabel) {
    chart.meta.textContent = `${chart.meta.textContent} · ${valueLabel}`;
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set("page", String(currentPage));
  params.set("pageSize", String(Number(pageSizeInput?.value || 50)));
  params.set("bucketMinutes", String(Number(bucketInput?.value || 15)));

  const categories = getMultiSelectValues(categoriesInput);
  const levels = getMultiSelectValues(levelsInput);
  if (categories.length > 0) params.set("categories", categories.join(","));
  if (levels.length > 0) params.set("levels", levels.join(","));

  const search = String(searchInput?.value || "").trim();
  if (search) params.set("search", search);

  const fromValue = fromInput?.value ? new Date(fromInput.value).getTime() : 0;
  const toValue = toInput?.value ? new Date(toInput.value).getTime() : 0;
  if (Number.isFinite(fromValue) && fromValue > 0) params.set("from", String(fromValue));
  if (Number.isFinite(toValue) && toValue > 0) params.set("to", String(toValue));

  return params;
}

async function requestLogs() {
  const adminToken = localStorage.getItem("adminToken");
  const csrf = getCookie("blockminer_csrf");

  const response = await fetch(`/api/admin/logs?${buildQuery().toString()}`, {
    method: "GET",
    headers: {
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {})
    },
    credentials: "include"
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminTokenExpiry");
    window.location.href = "/admin/login";
    return null;
  }

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load logs");
  }

  return data;
}

function renderSummary(summary) {
  if (!statsGrid) return;

  const byLevel = summary?.byLevel || {};
  const byCategory = summary?.byCategory || {};
  const peak = summary?.peakErrorBucket || null;
  const total = Number(summary?.total || 0);
  const errors = Number(byLevel.ERROR || 0);
  const warns = Number(byLevel.WARN || 0);
  const errorRate = total > 0 ? (errors / total) * 100 : 0;

  const topCategory = Object.entries(byCategory)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0] || ["--", 0];

  const cards = [
    ["Events", String(total)],
    ["Errors", String(errors)],
    ["Warnings", String(warns)],
    ["Error rate", `${formatNumber(errorRate, 2)}%`],
    ["Top category", `${topCategory[0]} (${topCategory[1]})`],
    ["Peak errors", peak ? `${peak.errors} @ ${formatDate(peak.timestamp)}` : "--"]
  ];

  statsGrid.innerHTML = cards
    .map(
      ([label, value]) => `
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(label)}</div>
        <div class="stat-value">${escapeHtml(value)}</div>
      </div>
    `
    )
    .join("");

  if (summaryInfo) {
    summaryInfo.textContent = `Files scanned: ${Number(summary?.filesScanned || 0)}`;
  }
}

function renderCharts(series, bucketMinutes) {
  const data = Array.isArray(series) ? series : [];
  const errorsSeries = data.map((entry) => Number(entry?.errors || 0));
  const warningsSeries = data.map((entry) => Number(entry?.warnings || 0));

  renderChart(errorsChart, errorsSeries, `${bucketMinutes} min bucket`);
  renderChart(warningsChart, warningsSeries, `${bucketMinutes} min bucket`);

  if (chartInfo) {
    const points = data.length;
    chartInfo.textContent = points > 0 ? `${points} buckets loaded` : "No chart data";
  }
}

function compactDetails(details) {
  if (!details) return "--";

  if (typeof details === "string") {
    return details.length > 140 ? `${details.slice(0, 137)}...` : details;
  }

  const serialized = JSON.stringify(details);
  if (serialized.length > 140) {
    return `${serialized.slice(0, 137)}...`;
  }

  return serialized;
}

function renderEvents(events) {
  if (!eventsTable) return;

  const rows = Array.isArray(events) ? events : [];
  if (rows.length === 0) {
    eventsTable.innerHTML = "<tr><td colspan=\"7\">No events found with current filters.</td></tr>";
    return;
  }

  eventsTable.innerHTML = rows
    .map((event) => {
      const level = String(event.level || "INFO");
      const pillClass = level === "ERROR" ? "bad" : level === "WARN" ? "" : "good";

      return `
        <tr>
          <td>${escapeHtml(formatDate(event.timestamp))}</td>
          <td>${escapeHtml(event.category || "--")}</td>
          <td><span class="pill ${pillClass}">${escapeHtml(level)}</span></td>
          <td>${escapeHtml(event.module || "--")}</td>
          <td title="${escapeHtml(event.message || "")}">${escapeHtml(event.message || "--")}</td>
          <td title="${escapeHtml(JSON.stringify(event.details || ""))}">${escapeHtml(compactDetails(event.details))}</td>
          <td>${escapeHtml(event.file || "--")}</td>
        </tr>
      `;
    })
    .join("");
}

function updatePagination(pagination) {
  const page = Number(pagination?.page || 1);
  const pages = Number(pagination?.totalPages || 1);
  const total = Number(pagination?.total || 0);

  currentPage = page;
  totalPages = pages;

  if (pageInfo) {
    pageInfo.textContent = `Page ${page}/${pages} · ${total} events`;
  }

  if (prevPageButton) prevPageButton.disabled = page <= 1;
  if (nextPageButton) nextPageButton.disabled = page >= pages;
}

async function loadLogs() {
  if (isLoading) return;
  isLoading = true;
  setStatus("Loading logs...", "info");

  try {
    const data = await requestLogs();
    if (!data) return;

    renderSummary(data.summary || {});
    renderCharts(data.series || [], Number(data?.filters?.bucketMinutes || 15));
    renderEvents(data.events || []);
    updatePagination(data.pagination || {});

    setStatus("Updated", "success");
  } catch (error) {
    setStatus(error.message || "Failed to load logs.", "error");
  } finally {
    isLoading = false;
  }
}

filtersForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  currentPage = 1;
  loadLogs();
});

refreshButton?.addEventListener("click", () => {
  loadLogs();
});

resetFiltersButton?.addEventListener("click", () => {
  searchInput.value = "";
  fromInput.value = "";
  toInput.value = "";
  bucketInput.value = "15";
  pageSizeInput.value = "50";

  Array.from(categoriesInput.options).forEach((option) => {
    option.selected = true;
  });

  Array.from(levelsInput.options).forEach((option) => {
    option.selected = option.value !== "DEBUG";
  });

  currentPage = 1;
  loadLogs();
});

prevPageButton?.addEventListener("click", () => {
  if (currentPage <= 1) return;
  currentPage -= 1;
  loadLogs();
});

nextPageButton?.addEventListener("click", () => {
  if (currentPage >= totalPages) return;
  currentPage += 1;
  loadLogs();
});

loadLogs();
