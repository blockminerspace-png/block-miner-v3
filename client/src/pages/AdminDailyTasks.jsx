import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, ListChecks } from 'lucide-react';
import { api } from '../store/auth';

export default function AdminDailyTasks() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderDraft, setOrderDraft] = useState(/** @type {Record<number, string>} */ ({}));
  const [patching, setPatching] = useState(/** @type {Record<number, boolean>} */ ({}));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/daily-tasks/definitions');
      if (res.data?.ok) {
        const list = res.data.definitions || [];
        setRows(list);
        const next = {};
        for (const r of list) {
          next[r.id] = String(r.sortOrder ?? 0);
        }
        setOrderDraft(next);
      } else {
        toast.error(t('admin_daily_tasks.load_error'));
      }
    } catch {
      toast.error(t('admin_daily_tasks.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const setRowPatching = (id, v) => {
    setPatching((p) => ({ ...p, [id]: v }));
  };

  const patchDefinition = async (id, body) => {
    setRowPatching(id, true);
    try {
      const res = await api.patch(`/admin/daily-tasks/definitions/${id}`, body);
      if (res.data?.ok) {
        toast.success(t('admin_daily_tasks.saved'));
        await load();
      } else {
        toast.error(res.data?.message || t('admin_daily_tasks.save_error'));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t('admin_daily_tasks.save_error'));
    } finally {
      setRowPatching(id, false);
    }
  };

  const onToggleActive = (id, isActive) => {
    patchDefinition(id, { isActive });
  };

  const onSaveOrder = (id) => {
    const raw = orderDraft[id];
    const n = parseInt(String(raw), 10);
    if (!Number.isInteger(n) || n < 0) {
      toast.error(t('admin_daily_tasks.save_error'));
      return;
    }
    patchDefinition(id, { sortOrder: n });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
          <ListChecks className="w-8 h-8" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t('admin_daily_tasks.title')}</h1>
          <p className="text-sm text-slate-400 max-w-2xl mt-1">{t('admin_daily_tasks.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          <span>{t('admin_daily_tasks.loading')}</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">{t('admin_daily_tasks.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('admin_daily_tasks.col_slug')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin_daily_tasks.col_type')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin_daily_tasks.col_target')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin_daily_tasks.col_i18n_key')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin_daily_tasks.col_reward')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin_daily_tasks.col_active')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin_daily_tasks.col_order')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin_daily_tasks.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-amber-500/90">{r.slug}</td>
                  <td className="px-4 py-3">{r.taskType}</td>
                  <td className="px-4 py-3 font-mono text-xs">{String(r.targetValue)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.translationKey}</td>
                  <td className="px-4 py-3">{r.rewardKind}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(r.isActive)}
                        disabled={patching[r.id]}
                        aria-label={t('admin_daily_tasks.toggle_aria')}
                        onChange={(e) => onToggleActive(r.id, e.target.checked)}
                        className="h-5 w-5 rounded border-slate-600 bg-slate-950 accent-emerald-500 focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-40"
                      />
                      <span className="text-xs text-slate-400">{r.isActive ? t('admin_daily_tasks.yes') : t('admin_daily_tasks.no')}</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={99999}
                      className="w-20 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs font-mono text-white disabled:opacity-40"
                      value={orderDraft[r.id] ?? ''}
                      disabled={patching[r.id]}
                      aria-label={t('admin_daily_tasks.order_placeholder')}
                      onChange={(e) => setOrderDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={patching[r.id]}
                      onClick={() => onSaveOrder(r.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
                    >
                      {patching[r.id] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin inline" aria-hidden />
                      ) : (
                        t('admin_daily_tasks.save_order')
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
