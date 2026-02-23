const STEP_PATHS = {
  1: "/shortlink/internal-shortlink/step1",
  2: "/shortlink/internal-shortlink/step2",
  3: "/shortlink/internal-shortlink/step3"
};
const STEP_WAIT_SECONDS = 5;

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
  const scriptTag = document.currentScript || document.querySelector('script[data-step]');
  const step = Number(scriptTag?.dataset?.step || 0);

  if (![1, 2, 3].includes(step)) {
    window.location.replace("/shortlink");
    return;
  }

  const status = await fetchStatus();
  if (!status) {
    return;
  }

  const runsToday = Number(status.daily_runs || 0);
  const maxDailyRuns = Number(status.maxDailyRuns || 10);
  const currentStep = Number(status.current_step || 0);

  if (runsToday >= maxDailyRuns && currentStep === 0) {
    alert("Daily limit reached. Come back after daily reset.");
    window.location.replace("/shortlink");
    return;
  }

  const expectedStep = currentStep + 1;
  if (step !== expectedStep) {
    const fallbackStep = Math.min(Math.max(expectedStep, 1), 3);
    window.location.replace(STEP_PATHS[fallbackStep] || "/shortlink");
    return;
  }

  const completeBtn = document.getElementById("completeStepBtn");
  const countdownEl = setupCountdownUi(completeBtn);

  if (completeBtn) {
    completeBtn.style.display = "none";
    completeBtn.disabled = true;
  }

  await runStepCountdown(step, countdownEl, completeBtn);

  completeBtn?.addEventListener("click", async () => {
    completeBtn.disabled = true;

    const result = await completeStep(step);
    if (!result?.ok) {
      alert(result?.message || "Unable to complete step.");
      completeBtn.disabled = false;
      return;
    }

    if (step === 1) {
      window.location.replace(STEP_PATHS[2]);
      return;
    }

    if (step === 2) {
      window.location.replace(STEP_PATHS[3]);
      return;
    }

    alert("Shortlink completed! Reward received.");
    window.location.replace("/shortlink");
  });
});

async function fetchStatus() {
  try {
    const response = await fetch("/api/shortlink/status", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error("Failed to fetch status");
    }

    const data = await response.json();
    return data.status || null;
  } catch (error) {
    console.error("Error fetching shortlink status:", error);
    alert("Failed to load shortlink status.");
    window.location.replace("/shortlink");
    return null;
  }
}

async function completeStep(step) {
  try {
    const csrf = getCookie("blockminer_csrf");

    const response = await fetch("/api/shortlink/complete-step", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {})
      },
      credentials: "include",
      body: JSON.stringify({ step })
    });

    const data = await response.json();
    return {
      ok: response.ok && Boolean(data?.ok),
      message: data?.message,
      data
    };
  } catch (error) {
    console.error("Error completing shortlink step:", error);
    return {
      ok: false,
      message: "Connection error while completing step."
    };
  }
}

function setupCountdownUi(completeBtn) {
  if (!completeBtn) return null;

  let countdownEl = document.getElementById("stepCountdown");
  if (countdownEl) return countdownEl;

  countdownEl = document.createElement("p");
  countdownEl.id = "stepCountdown";
  countdownEl.style.marginBottom = "12px";
  countdownEl.style.fontWeight = "600";
  completeBtn.insertAdjacentElement("beforebegin", countdownEl);

  return countdownEl;
}

async function runStepCountdown(step, countdownEl, completeBtn) {
  if (!completeBtn) return;

  let remaining = STEP_WAIT_SECONDS;
  renderCountdownText(step, remaining, countdownEl);

  await new Promise((resolve) => {
    const timerId = setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        renderCountdownText(step, remaining, countdownEl);
        return;
      }

      clearInterval(timerId);
      resolve();
    }, 1000);
  });

  if (countdownEl) {
    countdownEl.textContent = step === 3
      ? "Time is up. Click to finish and claim reward."
      : "Time is up. Click to continue.";
  }

  completeBtn.style.display = "";
  completeBtn.disabled = false;
}

function renderCountdownText(step, remaining, countdownEl) {
  if (!countdownEl) return;

  countdownEl.textContent = step === 3
    ? `Please wait ${remaining}s to unlock finish button.`
    : `Please wait ${remaining}s to unlock the button.`;
}
