import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, Pencil } from 'lucide-react';
import { api } from '../store/auth';

export default function AdminMiniPass() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/mini-pass/seasons');
      if (res.data.ok) setRows(res.data.seasons || []);
    } catch {
      toast.error('Failed to load Mini Pass seasons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Mini Pass</h1>
          <p className="text-slate-500 text-sm mt-1">
            Timed progression: missions, XP tiers, rewards, POL purchases
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => load()}
            className="p-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/mini-pass/new')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            New season
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Levels</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Rewards</th>
                  <th className="px-4 py-3">Missions</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-300">{r.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-amber-500/90">{r.slug}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {r.startsAt ? new Date(r.startsAt).toISOString().slice(0, 16) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {r.endsAt ? new Date(r.endsAt).toISOString().slice(0, 16) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {r.maxLevel} × {r.xpPerLevel} XP
                    </td>
                    <td className="px-4 py-3">{r.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-slate-400">{r._count?.levelRewards ?? 0}</td>
                    <td className="px-4 py-3 text-slate-400">{r._count?.missions ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/mini-pass/${r.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="p-12 text-center text-slate-500 text-sm">No seasons yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
