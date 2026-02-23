let currentStatus = null;

function getCookie(name) {
  const cookies = String(document.cookie || "").split(";");
  for (const cookie of cookies) {
    const part = cookie.trim();
    if (!part) continue;
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex);
    if (key !== name) continue;
    return decodeURIComponent(part.slice(eqIndex + 1));
  }
  return "";
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadStatus();
  bindEvents();
});

function bindEvents() {
  const startBtn = document.getElementById("startShortlinkBtn");
  startBtn?.addEventListener("click", async () => {
    if (!currentStatus) return;

    const runsToday = Number(currentStatus.daily_runs || 0);
    const maxDailyRuns = Number(currentStatus.maxDailyRuns || 10);
    if (runsToday >= maxDailyRuns && Number(currentStatus.current_step || 0) === 0) {
      alert("Daily limit reached. Try again after daily reset.");
      return;
    }

    try {
      startBtn.disabled = true;
      const csrf = getCookie("blockminer_csrf");
      const response = await fetch("/api/shortlink/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {})
        },
        credentials: "include"
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "Unable to start shortlink");
      }

      window.location.href = "/shortlink/internal-shortlink/step1";
    } catch (error) {
      console.error("Error starting shortlink:", error);
      alert("Unable to start shortlink.");
      startBtn.disabled = false;
    }
  });
}

async function loadStatus() {
  try {
    const response = await fetch("/api/shortlink/status", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error("Failed to load shortlink status");
    }

    const data = await response.json();
    currentStatus = data.status || null;
    renderStatus();
  } catch (error) {
    console.error("Error loading shortlink status:", error);
    const statusDiv = document.getElementById("shortlinkStatus");
    if (statusDiv) {
      statusDiv.innerHTML = '<div class="status-error"><i class="bi bi-exclamation-triangle"></i> <p>Failed to load status.</p></div>';
    }
  }
}

function renderStatus() {
  const statusDiv = document.getElementById("shortlinkStatus");
  const contentDiv = document.getElementById("shortlinkContent");
  const shortlinkName = document.getElementById("shortlinkName");
  const rewardName = document.getElementById("rewardName");
  const dailyRunsInfo = document.getElementById("dailyRunsInfo");
  const runStatus = document.getElementById("runStatus");
  const startBtn = document.getElementById("startShortlinkBtn");
  const limitInfo = document.getElementById("limitInfo");

  if (!statusDiv || !contentDiv || !shortlinkName || !rewardName || !dailyRunsInfo || !runStatus || !startBtn || !limitInfo || !currentStatus) {
    return;
  }

  statusDiv.style.display = "none";
  contentDiv.style.display = "block";

  const runsToday = Number(currentStatus.daily_runs || 0);
  const maxDailyRuns = Number(currentStatus.maxDailyRuns || 10);

  shortlinkName.textContent = currentStatus.shortlinkName || "Internal Shortlink";
  rewardName.textContent = currentStatus.rewardName || "5 GHS Mining Machine";
  dailyRunsInfo.textContent = `Runs today: ${runsToday}/${maxDailyRuns}`;

  if (runsToday >= maxDailyRuns && Number(currentStatus.current_step || 0) === 0) {
    runStatus.textContent = "Daily Limit";
    runStatus.classList.add("completed");
    startBtn.disabled = true;
    limitInfo.style.display = "flex";
    return;
  }

  limitInfo.style.display = "none";
  startBtn.disabled = false;

  if (Number(currentStatus.current_step || 0) > 0) {
    runStatus.textContent = "In Progress";
    runStatus.classList.remove("completed");
    startBtn.innerHTML = '<i class="bi bi-play-circle"></i> Continue Shortlink';
  } else {
    runStatus.textContent = "Available";
    runStatus.classList.remove("completed");
    startBtn.innerHTML = '<i class="bi bi-play-circle"></i> Start Shortlink';
  }
}
