import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, ListChecks } from 'lucide-react';
import { api } from '../store/auth';

export default function AdminDailyTasks() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/daily-tasks/definitions');
      if (res.data?.ok) setRows(res.data.definitions || []);
      else toast.error(t('admin_daily_tasks.load_error'));
    } catch {
      toast.error(t('admin_daily_tasks.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

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
                  <td className="px-4 py-3">{r.isActive ? t('admin_daily_tasks.yes') : t('admin_daily_tasks.no')}</td>
                  <td className="px-4 py-3">{r.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
