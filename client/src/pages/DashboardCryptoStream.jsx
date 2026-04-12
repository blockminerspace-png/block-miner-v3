import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Coins, Radio, TrendingUp, Zap } from "lucide-react";

function formatPol(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(x);
}

function formatHashrate(hs) {
  const x = Number(hs);
  if (!Number.isFinite(x) || x <= 0) return "0 H/s";
  if (x >= 1e12) return `${(x / 1e12).toFixed(1)}T`;
  if (x >= 1e9) return `${(x / 1e9).toFixed(1)}G`;
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  return `${(x / 1e3).toFixed(0)}K`;
}

/**
 * Public, login-free board for RTMP capture (Chromium kiosk on the server).
 */
export default function DashboardCryptoStream() {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/live-server-stats", { credentials: "omit" });
      const data = await res.json();
      if (data?.ok && data.stats) setStats(data.stats);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const tryFs = () => {
      const el = rootRef.current || document.documentElement;
      if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
    };
    const q = new URLSearchParams(window.location.search).get("fullscreen");
    const delay = q === "0" ? null : q === "1" ? 300 : 600;
    if (delay == null) return undefined;
    const t = window.setTimeout(tryFs, delay);
    return () => window.clearTimeout(t);
  }, []);

  const activeMiners = stats?.activeMiners ?? 0;
  const hashrate = stats?.networkHashRate ?? 0;
  const recentBlocks = Array.isArray(stats?.recentBlocks) ? stats.recentBlocks : [];

  return (
    <div
      ref={rootRef}
      className="min-h-screen w-full bg-[#030712] text-white overflow-hidden flex flex-col"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative h-2.5 w-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
              {t("dashboard_crypto_stream.badge_live")}
            </span>
          </div>
          <h1 className="truncate text-lg md:text-2xl font-black tracking-tight">
            {t("dashboard_crypto_stream.title")}
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 shrink-0">
          <Activity className="h-4 w-4 text-sky-400" aria-hidden />
          <span className="text-sm font-semibold text-slate-200">
            {activeMiners} {t("dashboard_crypto_stream.online")}
          </span>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
        <p className="mb-4 text-xs text-slate-500 md:text-sm">{t("dashboard_crypto_stream.subtitle")}</p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-400">
              <Zap className="h-4 w-4 shrink-0" aria-hidden />
              {t("dashboard_crypto_stream.card_hashrate")}
            </div>
            <p className="text-lg font-bold text-sky-300 md:text-2xl">{formatHashrate(hashrate)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
              {t("dashboard_crypto_stream.card_blocks")}
            </div>
            <p className="text-lg font-bold text-white md:text-2xl">{recentBlocks.length ? `#${recentBlocks[0].num}` : "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Coins className="h-4 w-4 shrink-0" aria-hidden />
              {t("dashboard_crypto_stream.card_pol")}
            </div>
            <p className="text-lg font-bold text-amber-300 md:text-2xl">{formatPol(stats?.polInUserBalances || 0)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400">
              <Radio className="h-4 w-4 shrink-0" aria-hidden />
              {t("dashboard_crypto_stream.card_users")}
            </div>
            <p className="text-lg font-bold text-violet-200 md:text-2xl">{stats?.usersTotal ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            {t("dashboard_crypto_stream.recent_blocks")}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentBlocks.length === 0 ? (
              <p className="text-sm text-slate-500">{loading ? "…" : t("dashboard_crypto_stream.no_blocks")}</p>
            ) : (
              recentBlocks.slice(0, 9).map((block) => (
                <div
                  key={block.num}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 font-mono text-sm"
                >
                  <span className="text-sky-400">#{block.num}</span>
                  <span className="text-xs text-slate-500">{block.time}</span>
                  <span className="text-emerald-400">{block.reward}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
