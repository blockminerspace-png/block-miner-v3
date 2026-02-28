function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

const faucetState = {
  remainingMs: 0,
  canClaim: false,
  partnerUrl: "",
  partnerWaitMs: 5_000,
  partnerWaitRemainingMs: 0,
  partnerUnlockedInSession: false,
  adInteractionArmed: false,
  adInteractionArmedUntil: 0,
  adArmTimerId: null,
  partnerStartInFlight: false,
  timerId: null,
  partnerTimerId: null
};

function armAdInteraction() {
  faucetState.adInteractionArmed = true;
  faucetState.adInteractionArmedUntil = Date.now() + 5000;
  if (faucetState.adArmTimerId) {
    clearTimeout(faucetState.adArmTimerId);
  }
  faucetState.adArmTimerId = setTimeout(() => {
    faucetState.adInteractionArmed = false;
    faucetState.adInteractionArmedUntil = 0;
    faucetState.adArmTimerId = null;
  }, 5000);
}

function disarmAdInteraction() {
  faucetState.adInteractionArmed = false;
  faucetState.adInteractionArmedUntil = 0;
  if (faucetState.adArmTimerId) {
    clearTimeout(faucetState.adArmTimerId);
    faucetState.adArmTimerId = null;
  }
}

function maybeTriggerPartnerFromAdInteraction() {
  if (!faucetState.adInteractionArmed) {
    return;
  }

  if (Date.now() > Number(faucetState.adInteractionArmedUntil || 0)) {
    disarmAdInteraction();
    return;
  }

  disarmAdInteraction();
  startPartnerVisit();
}

function updateCooldownText() {
  const cooldownEl = document.getElementById("faucetCooldownText");
  const statusEl = document.getElementById("faucetStatusText");
  const claimBtn = document.getElementById("faucetClaimBtn");

  if (!cooldownEl || !statusEl || !claimBtn) return;

  if (faucetState.remainingMs <= 0) {
    cooldownEl.textContent = "";
    if (faucetState.canClaim) {
      statusEl.textContent = "Faucet ready. Claim your miner.";
      claimBtn.disabled = false;
      claimBtn.hidden = false;
    } else {
      statusEl.textContent = "Click the ad space first to unlock claim.";
      claimBtn.disabled = true;
      claimBtn.hidden = true;
    }
    return;
  }

  claimBtn.disabled = true;
  claimBtn.hidden = true;
  statusEl.textContent = "Cooldown active.";
  cooldownEl.textContent = `Next claim in ${formatDuration(faucetState.remainingMs)}.`;
}

function updatePartnerGateUi() {
  const gateEl = document.getElementById("faucetPartnerGate");
  const gateStatusEl = document.getElementById("faucetPartnerStatus");
  const countdownEl = document.getElementById("faucetPartnerCountdown");
  if (!gateEl || !gateStatusEl || !countdownEl) {
    return;
  }

  gateEl.classList.remove("is-ready", "is-disabled", "is-waiting");
  countdownEl.textContent = "";

  if (faucetState.remainingMs > 0) {
    gateEl.classList.add("is-disabled");
    gateStatusEl.textContent = "Partner step will unlock when cooldown ends.";
    return;
  }

  if (faucetState.canClaim) {
    gateEl.classList.add("is-ready");
    gateStatusEl.textContent = "✅ Partner step completed. Claim button unlocked.";
    return;
  }

  if (faucetState.partnerWaitRemainingMs > 0) {
    const secondsLeft = Math.max(1, Math.ceil(faucetState.partnerWaitRemainingMs / 1000));
    gateEl.classList.add("is-waiting");
    gateStatusEl.textContent = "You must click the ad space and wait 5 seconds to unlock claim.";
    countdownEl.textContent = `⏳ Waiting ${secondsLeft}s...`;
    return;
  }

  gateStatusEl.textContent = "Click the ad space and wait 5 seconds to unlock claim.";
  countdownEl.textContent = "Required: click ad space + wait 5s.";
}

function startCountdown() {
  if (faucetState.timerId) {
    clearInterval(faucetState.timerId);
  }

  faucetState.timerId = setInterval(() => {
    faucetState.remainingMs = Math.max(0, faucetState.remainingMs - 1000);
    updateCooldownText();

    if (faucetState.remainingMs <= 0) {
      clearInterval(faucetState.timerId);
      faucetState.timerId = null;
    }
  }, 1000);
}

function stopPartnerCountdown() {
  if (faucetState.partnerTimerId) {
    clearInterval(faucetState.partnerTimerId);
    faucetState.partnerTimerId = null;
  }
}

function startPartnerCountdown(waitMs) {
  stopPartnerCountdown();
  faucetState.partnerWaitRemainingMs = Math.max(0, Number(waitMs || 0));
  faucetState.partnerUnlockedInSession = false;
  faucetState.canClaim = false;
  updatePartnerGateUi();
  updateCooldownText();

  if (faucetState.partnerWaitRemainingMs <= 0) {
    faucetState.partnerUnlockedInSession = true;
    faucetState.canClaim = faucetState.remainingMs <= 0;
    updatePartnerGateUi();
    updateCooldownText();
    return;
  }

  faucetState.partnerTimerId = setInterval(() => {
    faucetState.partnerWaitRemainingMs = Math.max(0, faucetState.partnerWaitRemainingMs - 1000);
    updatePartnerGateUi();

    if (faucetState.partnerWaitRemainingMs <= 0) {
      stopPartnerCountdown();
      faucetState.partnerUnlockedInSession = true;
      faucetState.canClaim = faucetState.remainingMs <= 0;
      updatePartnerGateUi();
      updateCooldownText();
    }
  }, 1000);
}

async function loadFaucetStatus() {
  try {
    const response = await fetch("/api/faucet/status", { credentials: "include" });
    const data = await response.json();

    if (!data.ok) {
      window.notify?.(data.message || "Unable to load faucet status.", "error");
      return;
    }

    const rewardImage = document.getElementById("faucetRewardImage");
    const rewardName = document.getElementById("faucetRewardName");
    const rewardMeta = document.getElementById("faucetRewardMeta");
    if (data.reward) {
      if (rewardImage) {
        rewardImage.src = data.reward.imageUrl || "";
        rewardImage.alt = data.reward.name || "Faucet reward";
      }
      if (rewardName) {
        rewardName.textContent = data.reward.name || "Faucet reward";
      }
      if (rewardMeta) {
        const hashRate = Number(data.reward.hashRate || 0);
        const slotSize = Number(data.reward.slotSize || 1);
        const slotText = slotSize > 1 ? ` · ${slotSize} slots` : "";
        rewardMeta.textContent = `${hashRate} GH/s${slotText}`;
      }
    }

    faucetState.remainingMs = Number(data.remainingMs || 0);
    faucetState.partnerUrl = String(data?.partnerGate?.url || "");
    faucetState.partnerWaitMs = Number(data?.partnerGate?.waitMs || 5_000);
    faucetState.partnerWaitRemainingMs = 0;
    faucetState.canClaim = faucetState.remainingMs <= 0 && faucetState.partnerUnlockedInSession;

    if (faucetState.remainingMs > 0) {
      faucetState.partnerUnlockedInSession = false;
    }

    stopPartnerCountdown();

    updateCooldownText();
    updatePartnerGateUi();
    if (faucetState.remainingMs > 0) {
      startCountdown();
    }
  } catch (error) {
    console.error("Error loading faucet status:", error);
    window.notify?.("Unable to load faucet status.", "error");
  }
}

async function startPartnerVisit() {
  if (faucetState.remainingMs > 0) {
    return;
  }

  if (faucetState.partnerStartInFlight || faucetState.partnerWaitRemainingMs > 0 || faucetState.canClaim) {
    return;
  }

  faucetState.partnerStartInFlight = true;
  disarmAdInteraction();

  try {
    const response = await fetch("/api/faucet/partner/start", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    if (!response.ok || !data?.ok) {
      window.notify?.(data?.message || "Unable to start partner visit.", "error");
      return;
    }

    faucetState.partnerUrl = String(data.partnerUrl || faucetState.partnerUrl || "");

    const waitMs = Number(data.waitMs || faucetState.partnerWaitMs || 5000);
    startPartnerCountdown(waitMs);
    window.notify?.("Banner clicked. Wait 5 seconds to unlock claim.", "info");
  } catch (error) {
    console.error("Error starting partner visit:", error);
    window.notify?.("Unable to start partner visit.", "error");
  } finally {
    faucetState.partnerStartInFlight = false;
  }
}

async function claimFaucet() {
  const claimBtn = document.getElementById("faucetClaimBtn");
  if (!faucetState.canClaim) {
    window.notify?.("Complete partner step before claiming faucet.", "error");
    return;
  }

  if (claimBtn) claimBtn.disabled = true;

  try {
    const response = await fetch("/api/faucet/claim", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    if (response.ok && data.ok) {
      window.notify?.(data.message || "Faucet claimed.", "success");
      if (data.reward) {
        const rewardImage = document.getElementById("faucetRewardImage");
        const rewardName = document.getElementById("faucetRewardName");
        const rewardMeta = document.getElementById("faucetRewardMeta");
        if (rewardImage) {
          rewardImage.src = data.reward.imageUrl || "";
          rewardImage.alt = data.reward.name || "Faucet reward";
        }
        if (rewardName) {
          rewardName.textContent = data.reward.name || "Faucet reward";
        }
        if (rewardMeta) {
          const hashRate = Number(data.reward.hashRate || 0);
          const slotSize = Number(data.reward.slotSize || 1);
          const slotText = slotSize > 1 ? ` · ${slotSize} slots` : "";
          rewardMeta.textContent = `${hashRate} GH/s${slotText}`;
        }
      }
      faucetState.remainingMs = 60 * 60 * 1000;
      faucetState.canClaim = false;
      faucetState.partnerWaitRemainingMs = 0;
      faucetState.partnerUnlockedInSession = false;
      stopPartnerCountdown();
      updateCooldownText();
      updatePartnerGateUi();
      startCountdown();
      return;
    }

    if (response.status === 429 && Number.isFinite(Number(data.remainingMs))) {
      faucetState.remainingMs = Number(data.remainingMs);
      faucetState.canClaim = false;
      faucetState.partnerUnlockedInSession = false;
      updateCooldownText();
      updatePartnerGateUi();
      startCountdown();
      window.notify?.("Cooldown active. Please wait.", "error");
      return;
    }

    if (response.status === 400 && data?.partnerGate) {
      faucetState.canClaim = false;
      faucetState.partnerUnlockedInSession = false;
      faucetState.partnerUrl = String(data.partnerGate.url || faucetState.partnerUrl || "");
      faucetState.partnerWaitMs = Number(data.partnerGate.waitMs || faucetState.partnerWaitMs || 5000);
      faucetState.partnerWaitRemainingMs = 0;
      updateCooldownText();
      updatePartnerGateUi();
      window.notify?.(data.message || "Partner step required.", "error");
      return;
    }

    window.notify?.(data.message || "Unable to claim faucet.", "error");
  } catch (error) {
    console.error("Error claiming faucet:", error);
    window.notify?.("Unable to claim faucet.", "error");
  } finally {
    if (claimBtn && faucetState.remainingMs <= 0) claimBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const claimBtn = document.getElementById("faucetClaimBtn");
  const partnerGate = document.getElementById("faucetPartnerGate");
  if (claimBtn) {
    claimBtn.hidden = true;
    claimBtn.addEventListener("click", claimFaucet);
  }
  if (partnerGate) {
    partnerGate.addEventListener("mouseenter", armAdInteraction);
    partnerGate.addEventListener("mousemove", armAdInteraction);
    partnerGate.addEventListener("pointerdown", armAdInteraction);
    partnerGate.addEventListener("touchstart", armAdInteraction, { passive: true });
    partnerGate.addEventListener("click", startPartnerVisit);
    partnerGate.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startPartnerVisit();
      }
    });
  }

  window.addEventListener("blur", () => {
    maybeTriggerPartnerFromAdInteraction();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      maybeTriggerPartnerFromAdInteraction();
    }
  });

  loadFaucetStatus();
});
