import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  RefreshCw,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

function formatPol(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(x);
}

export default function LiveServer() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/public/live-stats', { credentials: 'omit' });
      const data = await res.json();
      if (!data?.ok || !data.stats) {
        setError(t('liveServer.load_error'));
        setStats(null);
        return;
      }
      setStats(data.stats);
    } catch {
      setError(t('liveServer.load_error'));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const cards = stats
    ? [
        {
          icon: Users,
          label: t('liveServer.card_users'),
          value: String(stats.usersTotal ?? 0),
          accent: 'from-violet-500/20 to-fuchsia-500/10',
        },
        {
          icon: Users,
          label: t('liveServer.card_new_users_24h'),
          value: String(stats.newUsers24h ?? 0),
          accent: 'from-emerald-500/15 to-teal-500/10',
        },
        {
          icon: Wallet,
          label: t('liveServer.card_pol_internal'),
          value: formatPol(stats.polInUserBalances),
          accent: 'from-sky-500/20 to-blue-600/10',
        },
        {
          icon: ArrowDownLeft,
          label: t('liveServer.card_pol_deposited_total'),
          value: formatPol(stats.polDepositedTotal),
          accent: 'from-cyan-500/20 to-sky-500/10',
        },
        {
          icon: ArrowUpRight,
          label: t('liveServer.card_pol_withdrawn_total'),
          value: formatPol(stats.polWithdrawnTotal),
          accent: 'from-amber-500/20 to-orange-600/10',
        },
        {
          icon: Zap,
          label: t('liveServer.card_pol_in_24h'),
          value: formatPol(stats.polDeposited24h),
          accent: 'from-lime-500/15 to-emerald-600/10',
        },
        {
          icon: Activity,
          label: t('liveServer.card_pol_out_24h'),
          value: formatPol(stats.polWithdrawn24h),
          accent: 'from-rose-500/15 to-red-600/10',
        },
        {
          icon: Clock,
          label: t('liveServer.card_pending_withdrawals'),
          value: `${stats.pendingWithdrawalsCount ?? 0} · ${formatPol(stats.pendingWithdrawalsPol)} POL`,
          accent: 'from-slate-500/20 to-slate-700/10',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.25), transparent 45%), radial-gradient(circle at 80% 10%, rgba(168,85,247,0.2), transparent 40%), radial-gradient(circle at 50% 80%, rgba(14,165,233,0.15), transparent 50%)',
        }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M60%200H0v60%22%20fill%3D%22none%22%20stroke%3D%22rgba(148,163,184,0.06)%22%20stroke-width%3D%221%22/%3E%3C/svg%3E')] opacity-60" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-4">
            <BrandLogo variant="sidebar" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-sky-400/90">
                {t('liveServer.kicker')}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl bg-gradient-to-r from-white via-sky-100 to-slate-300 bg-clip-text text-transparent">
                {t('liveServer.title')}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-400 leading-relaxed">{t('liveServer.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                load();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              {t('liveServer.refresh')}
            </button>
          </div>
        </header>

        {error ? (
          <p className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {loading && !stats ? (
          <p className="mt-16 text-center text-sm font-medium uppercase tracking-widest text-slate-500">
            {t('liveServer.loading')}
          </p>
        ) : null}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${c.accent} p-[1px] shadow-xl shadow-black/40`}
            >
              <div className="h-full rounded-2xl bg-slate-950/90 p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <c.icon className="h-5 w-5 text-sky-400/90" aria-hidden />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">POL</span>
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{c.label}</p>
                <p className="mt-1 font-mono text-xl font-bold tracking-tight text-white sm:text-2xl">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {stats?.generatedAt ? (
          <p className="mt-10 text-center text-[10px] font-mono uppercase tracking-widest text-slate-600">
            {t('liveServer.updated')}{' '}
            {new Date(stats.generatedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </p>
        ) : null}

        <footer className="mt-16 border-t border-white/5 pt-8 text-center text-[10px] text-slate-600">
          {t('liveServer.footer')}
        </footer>
      </div>
    </div>
  );
}
