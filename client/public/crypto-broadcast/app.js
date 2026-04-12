// --- Configuration ---
const CRYPTO_DATA = {
  bitcoin: { symbol: "btc", pair: "btcusdt", tvSymbol: "BINANCE:BTCUSDT" },
  ethereum: { symbol: "eth", pair: "ethusdt", tvSymbol: "BINANCE:ETHUSDT" },
  solana: { symbol: "sol", pair: "solusdt", tvSymbol: "BINANCE:SOLUSDT" },
  ripple: { symbol: "xrp", pair: "xrpusdt", tvSymbol: "BINANCE:XRPUSDT" }
};

let tvWidget = null;
let currentActiveSymbol = "bitcoin";

function hideFullscreenHint() {
  const hint = document.getElementById("fullscreen-hint");
  if (hint) hint.classList.add("hidden");
}

/**
 * Request true fullscreen where the browser allows it (often after a user gesture).
 * PWA manifest uses display=fullscreen; this complements manual capture and OBS Browser Source.
 */
function initBroadcastFullscreen() {
  const root = document.documentElement;

  async function requestFs() {
    try {
      if (document.fullscreenElement) {
        hideFullscreenHint();
        return;
      }
      if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        root.webkitRequestFullscreen();
      } else if (root.msRequestFullscreen) {
        root.msRequestFullscreen();
      }
    } catch {
      /* ignored — policy may require gesture */
    }
    if (document.fullscreenElement) hideFullscreenHint();
  }

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) hideFullscreenHint();
  });

  window.addEventListener("load", () => {
    void requestFs();
  });

  ["click", "keydown", "pointerdown"].forEach((evt) => {
    document.addEventListener(evt, () => void requestFs(), { capture: true });
  });
}

function updateClock() {
  const clockElement = document.getElementById("clock");
  const dateElement = document.getElementById("date");
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  clockElement.textContent = `${hours}:${minutes}:${seconds}`;

  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  dateElement.textContent = now.toLocaleDateString("en-US", options);
}

function initWebSockets() {
  const streamNames = Object.values(CRYPTO_DATA)
    .map((d) => `${d.pair}@ticker`)
    .join("/");
  const wsUrl = `wss://stream.binance.com:9443/ws/${streamNames}`;

  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const pair = data.s.toLowerCase();

    const cryptoKey = Object.keys(CRYPTO_DATA).find((key) => CRYPTO_DATA[key].pair === pair);
    if (cryptoKey) {
      updateCryptoUI(cryptoKey, {
        price: parseFloat(data.c),
        change: parseFloat(data.P)
      });
    }
    updateStatus(true);
  };

  ws.onerror = () => updateStatus(false);
  ws.onclose = () => {
    updateStatus(false);
    setTimeout(initWebSockets, 5000);
  };
}

function updateCryptoUI(id, data) {
  const config = CRYPTO_DATA[id];
  const priceElement = document.getElementById(`${config.symbol}-price`);
  const changeElement = document.getElementById(`${config.symbol}-change`);

  if (!priceElement || !changeElement) return;

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "usd",
    minimumFractionDigits: data.price < 1 ? 4 : 2
  }).format(data.price);

  const oldPrice = priceElement.textContent;
  priceElement.textContent = formattedPrice;

  if (oldPrice !== "$ --,---" && oldPrice !== formattedPrice) {
    priceElement.style.animation = "none";
    priceElement.offsetHeight;
    priceElement.style.animation = data.change >= 0 ? "flashGreen 0.5s" : "flashRed 0.5s";
  }

  changeElement.textContent = `${data.change >= 0 ? "+" : ""}${data.change.toFixed(2)}%`;
  changeElement.className = `crypto-change ${data.change >= 0 ? "up" : "down"}`;
}

function updateStatus(isOnline) {
  const statusText = document.getElementById("status-text");
  const statusDot = document.querySelector(".status-dot");

  if (isOnline) {
    statusText.textContent = "LIVE DATA: BINANCE WEBSOCKET";
    statusDot.style.backgroundColor = "#00ff88";
    statusDot.style.boxShadow = "0 0 10px #00ff88";
  } else {
    statusText.textContent = "RECONNECTING TO STREAM...";
    statusDot.style.backgroundColor = "#ff3e3e";
    statusDot.style.boxShadow = "0 0 10px #ff3e3e";
  }
}

function initTicker() {
  const container = document.getElementById("tv-ticker-container");
  if (!container) return;

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
  script.async = true;
  script.text = JSON.stringify({
    symbols: [
      { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
      { description: "Apple", proName: "NASDAQ:AAPL" },
      { description: "Nvidia", proName: "NASDAQ:NVDA" },
      { description: "Tesla", proName: "NASDAQ:TSLA" },
      { description: "Microsoft", proName: "NASDAQ:MSFT" },
      { description: "Amazon", proName: "NASDAQ:AMZN" }
    ],
    showSymbolLogo: true,
    isTransparent: true,
    displayMode: "adaptive",
    colorTheme: "dark",
    locale: "en"
  });
  container.appendChild(script);
}

function initTradingView(symbol = "BINANCE:BTCUSDT") {
  tvWidget = new TradingView.widget({
    autosize: true,
    symbol,
    interval: "H",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    toolbar_bg: "#f1f3f6",
    enable_publishing: false,
    hide_top_toolbar: true,
    save_image: false,
    container_id: "tradingview_chart",
    backgroundColor: "rgba(0, 0, 0, 0)",
    gridColor: "rgba(255, 255, 255, 0.05)"
  });
}

function switchChart(id) {
  if (currentActiveSymbol === id) return;

  document.querySelectorAll(".crypto-card").forEach((card) => card.classList.remove("active"));
  document.getElementById(`${CRYPTO_DATA[id].symbol}-card`).classList.add("active");

  currentActiveSymbol = id;

  if (tvWidget) {
    document.getElementById("tradingview_chart").innerHTML = "";
    initTradingView(CRYPTO_DATA[id].tvSymbol);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initBroadcastFullscreen();

  setInterval(updateClock, 1000);
  updateClock();

  initWebSockets();
  initTradingView();
  initTicker();

  Object.keys(CRYPTO_DATA).forEach((id) => {
    const card = document.getElementById(`${CRYPTO_DATA[id].symbol}-card`);
    if (card) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => switchChart(id));
    }
  });

  const btcCard = document.getElementById("btc-card");
  if (btcCard) btcCard.classList.add("active");

  fetchGlobalStats();
  fetchFearGreed();
  setInterval(fetchGlobalStats, 300000);
  setInterval(fetchFearGreed, 3600000);
});

async function fetchGlobalStats() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/global");
    const data = await response.json();
    const global = data.data;

    document.getElementById("btc-dom").textContent = `${global.market_cap_percentage.btc.toFixed(1)}%`;

    const totalCap = global.total_market_cap.usd / 1e12;
    document.getElementById("total-cap").textContent = `$${totalCap.toFixed(2)}T`;
  } catch (e) {
    console.error("Global stats error:", e);
  }
}

async function fetchFearGreed() {
  try {
    const response = await fetch("https://api.alternative.me/fng/");
    const data = await response.json();
    const fng = data.data[0];

    const fgValue = document.getElementById("fg-value");
    fgValue.textContent = `${fng.value} (${fng.value_classification})`;

    if (fng.value <= 40) fgValue.style.color = "#ff3e3e";
    else if (fng.value >= 60) fgValue.style.color = "#00ff88";
    else fgValue.style.color = "#ffcc00";
  } catch (e) {
    console.error("Fear/Greed error:", e);
  }
}

const style = document.createElement("style");
style.textContent = `
    @keyframes flashGreen {
        0% { color: #00ff88; text-shadow: 0 0 10px #00ff88; transform: scale(1.02); }
        100% { color: inherit; text-shadow: none; transform: scale(1); }
    }
    @keyframes flashRed {
        0% { color: #ff3e3e; text-shadow: 0 0 10px #ff3e3e; transform: scale(0.98); }
        100% { color: inherit; text-shadow: none; transform: scale(1); }
    }
`;
document.head.appendChild(style);
