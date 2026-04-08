import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Wallet, CheckCircle2, XCircle, RefreshCw, ArrowUpCircle, ArrowDownCircle, Search
} from 'lucide-react';
import { api } from '../store/auth';

export default function AdminFinance() {
    const [withdrawals, setWithdrawals] = useState([]);
    const [blkEconomyForm, setBlkEconomyForm] = useState(null);
    const [overview, setOverview] = useState(null);
    const [activity, setActivity] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState('withdrawals'); // 'withdrawals', 'blk', 'activity'

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [withdrawalsRes, overviewRes, activityRes, blkEcRes] = await Promise.all([
                api.get('/admin/withdrawals/pending'),
                api.get('/admin/finance/overview'),
                api.get('/admin/finance/activity?limit=50'),
                api.get('/admin/blk/economy')
            ]);

            if (withdrawalsRes.data.ok) setWithdrawals(withdrawalsRes.data.withdrawals || []);
            if (overviewRes.data.ok) setOverview(overviewRes.data.overview || {});
            if (activityRes.data.ok) setActivity(activityRes.data.activity || []);
            if (blkEcRes.data.ok && blkEcRes.data.economy) {
                const e = blkEcRes.data.economy;
                setBlkEconomyForm({
                    polPerBlk: e.polPerBlk,
                    convertFeeBps: e.convertFeeBps,
                    minConvertPol: e.minConvertPol,
                    dailyConvertLimitBlk: e.dailyConvertLimitBlk ?? '',
                    convertCooldownSec: e.convertCooldownSec,
                    blkCycleReward: e.blkCycleReward,
                    blkCycleIntervalSec: e.blkCycleIntervalSec,
                    blkCycleActivitySec: e.blkCycleActivitySec,
                    blkCycleMinHashrate: e.blkCycleMinHashrate,
                    blkCyclePaused: !!e.blkCyclePaused,
                    blkCycleBoost: e.blkCycleBoost
                });
            }
        } catch (err) {
            console.error("Erro ao carregar dados financeiros", err);
            toast.error("Erro ao carregar dados financeiros");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleApprove = async (id) => {
        if (!confirm("Confirmar aprovação deste saque?")) return;
        try {
            const res = await api.post(`/admin/withdrawals/${id}/approve`);
            if (res.data.ok) {
                toast.success('Saque aprovado com sucesso!');
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Erro ao aprovar saque.');
        }
    };

    const handleReject = async (id) => {
        if (!confirm("Confirmar rejeição deste saque? Os fundos poderão ser devolvidos.")) return;
        try {
            const res = await api.post(`/admin/withdrawals/${id}/reject`);
            if (res.data.ok) {
                toast.success('Saque rejeitado.');
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Erro ao rejeitar saque.');
        }
    };

    const handleComplete = async (id) => {
        const txHash = prompt("Insira o Hash da Transação (opcional):");
        if (txHash === null) return; // Cancelled

        try {
            const res = await api.post(`/admin/withdrawals/${id}/complete`, { txHash });
            if (res.data.ok) {
                toast.success('Saque marcado como concluído!');
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Erro ao concluir saque.');
        }
    };

    const saveBlkEconomy = async () => {
        if (!blkEconomyForm) return;
        try {
            const body = {
                polPerBlk: Number(blkEconomyForm.polPerBlk),
                convertFeeBps: Number(blkEconomyForm.convertFeeBps),
                minConvertPol: Number(blkEconomyForm.minConvertPol),
                convertCooldownSec: Number(blkEconomyForm.convertCooldownSec),
                dailyConvertLimitBlk: blkEconomyForm.dailyConvertLimitBlk === '' ? null : Number(blkEconomyForm.dailyConvertLimitBlk),
                blkCycleReward: Number(blkEconomyForm.blkCycleReward),
                blkCycleIntervalSec: Number(blkEconomyForm.blkCycleIntervalSec),
                blkCycleActivitySec: Number(blkEconomyForm.blkCycleActivitySec),
                blkCycleMinHashrate: Number(blkEconomyForm.blkCycleMinHashrate),
                blkCyclePaused: Boolean(blkEconomyForm.blkCyclePaused),
                blkCycleBoost: Number(blkEconomyForm.blkCycleBoost)
            };
            const res = await api.put('/admin/blk/economy', body);
            if (res.data.ok) toast.success('Economia BLK atualizada.');
            else toast.error(res.data.message || 'Erro');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Erro ao salvar BLK');
        }
    };

    if (isLoading && !overview) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse text-center py-40">Carregando financeiro...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <Wallet className="w-6 h-6 text-emerald-500" /> Gestão Financeira
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Aprovação de saques e visão geral do sistema.</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700/50 w-fit"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Sincronizar
                </button>
            </div>

            {/* Overview Stats */}
            {overview && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-lg flex items-center gap-4">
                        <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-500">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Saques Pendentes/Aprovados</p>
                            <h3 className="text-xl font-black text-white">{withdrawals.length}</h3>
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-lg flex items-center gap-4">
                        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500">
                            <ArrowUpCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Depositado (24h)</p>
                            <h3 className="text-xl font-black text-white">{Number(overview.deposits24h || 0).toFixed(2)} POL</h3>
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-lg flex items-center gap-4">
                        <div className="p-4 rounded-2xl bg-red-500/10 text-red-500">
                            <ArrowDownCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Sacado (24h)</p>
                            <h3 className="text-xl font-black text-white">{Number(overview.withdrawals24h || 0).toFixed(2)} POL</h3>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-800 pb-px">
                <button
                    onClick={() => setTab('withdrawals')}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest transition-all ${tab === 'withdrawals' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Saques POL
                </button>
                <button
                    onClick={() => setTab('blk')}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest transition-all ${tab === 'blk' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Economia BLK
                </button>
                <button
                    onClick={() => setTab('activity')}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest transition-all ${tab === 'activity' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Atividade Recente
                </button>
            </div>

            {/* Content */}
            {tab === 'withdrawals' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-800/30 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                                <tr>
                                    <th className="px-8 py-4">Data</th>
                                    <th className="px-8 py-4">Usuário</th>
                                    <th className="px-8 py-4">Endereço (POLYGON)</th>
                                    <th className="px-8 py-4">Valor</th>
                                    <th className="px-8 py-4">Status</th>
                                    <th className="px-8 py-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 font-medium">
                                {withdrawals.map((w) => (
                                    <tr key={w.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-8 py-5 text-xs whitespace-nowrap">
                                            {new Date(w.created_at || w.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-white font-bold text-xs">{w.user?.username || `User #${w.userId}`}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">{w.address}</span>
                                                <button onClick={() => { navigator.clipboard.writeText(w.address); toast.success('Endereço copiado!'); }} className="p-1 hover:text-white transition-colors">
                                                    <RefreshCw className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-amber-500 font-black">{Number(w.amount).toFixed(4)} POL</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            {w.status === 'pending' ? (
                                                <span className="text-[9px] font-black uppercase px-2 py-1 bg-amber-500/10 text-amber-500 rounded">Pendente</span>
                                            ) : (
                                                <span className="text-[9px] font-black uppercase px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded">Aprovado</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex gap-2 justify-end">
                                                {w.status === 'pending' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(w.id)}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest"
                                                        >
                                                            <CheckCircle2 className="w-3 h-3" /> Aprovar
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(w.id)}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest"
                                                        >
                                                            <XCircle className="w-3 h-3" /> Rejeitar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleComplete(w.id)}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-sky-500 border border-sky-400/20 hover:bg-sky-400 text-white rounded-lg transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-sky-500/20"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3" /> Marcar Enviado
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {withdrawals.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-12 text-center text-slate-500 italic font-medium">
                                            Não há saques POL pendentes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'blk' && (
                <div className="space-y-8">
                    {blkEconomyForm && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Economia BLK (1 BLK ≈ 1 USD)</h3>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                BLK não é sacável — conversão POL → BLK, recompensa por tempo (pool) e uso interno (loja / perks).
                            </p>
                            <div className="flex flex-wrap gap-3 items-center pb-2 border-b border-slate-800/80">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!confirm('Disparar distribuição BLK do ciclo atual (idempotente)?')) return;
                                        try {
                                            const res = await api.post('/admin/mining/blk-cycle/run');
                                            if (res.data.ok) {
                                                const r = res.data.result || {};
                                                toast.success(
                                                    r.skipped
                                                        ? `Ciclo BLK: ${r.skipped}`
                                                        : `Ciclo BLK OK${r.cycleId != null ? ` #${r.cycleId}` : ''}`
                                                );
                                            }
                                            else toast.error('Falhou');
                                            fetchData();
                                        } catch (err) {
                                            toast.error(err.response?.data?.message || 'Erro');
                                        }
                                    }}
                                    className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase"
                                >
                                    Rodar ciclo BLK agora
                                </button>
                                <span className="text-[9px] text-slate-600">Cron UTC a cada 10 min; manual usa a mesma janela.</span>
                            </div>
                            <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest pt-2">Emissão BLK (pool / 10 min)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">BLK / ciclo (base)</span>
                                    <input
                                        type="number"
                                        step="any"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.blkCycleReward}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, blkCycleReward: e.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">Duração ciclo (s)</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.blkCycleIntervalSec}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, blkCycleIntervalSec: e.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">Janela atividade (s)</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.blkCycleActivitySec}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, blkCycleActivitySec: e.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">Hashrate mínimo</span>
                                    <input
                                        type="number"
                                        step="any"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.blkCycleMinHashrate}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, blkCycleMinHashrate: e.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">Boost (multiplier)</span>
                                    <input
                                        type="number"
                                        step="any"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.blkCycleBoost}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, blkCycleBoost: e.target.value }))}
                                    />
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer pt-6">
                                    <input
                                        type="checkbox"
                                        checked={blkEconomyForm.blkCyclePaused}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, blkCyclePaused: e.target.checked }))}
                                        className="rounded border-slate-600"
                                    />
                                    <span className="text-slate-500 font-bold">Pausar emissão BLK</span>
                                </label>
                            </div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pt-4">Conversão POL → BLK</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">POL por 1 BLK</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.polPerBlk}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, polPerBlk: e.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">Fee conversão (bps, 500 = 5%)</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.convertFeeBps}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, convertFeeBps: e.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">Mín. POL conversão</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.minConvertPol}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, minConvertPol: e.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">Cooldown conversão (s)</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.convertCooldownSec}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, convertCooldownSec: e.target.value }))}
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-slate-500 font-bold">Limite diário conversão (BLK, vazio = ∞)</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                                        value={blkEconomyForm.dailyConvertLimitBlk}
                                        onChange={(e) => setBlkEconomyForm((p) => ({ ...p, dailyConvertLimitBlk: e.target.value }))}
                                        placeholder="∞"
                                    />
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={saveBlkEconomy}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase"
                            >
                                Salvar economia BLK
                            </button>
                        </div>
                    )}
                </div>
            )}

            {tab === 'activity' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-800/30 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                                <tr>
                                    <th className="px-8 py-4">Data</th>
                                    <th className="px-8 py-4">Tipo</th>
                                    <th className="px-8 py-4">Usuário</th>
                                    <th className="px-8 py-4">Valor</th>
                                    <th className="px-8 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 font-medium">
                                {activity.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-8 py-4 text-xs">
                                            {new Date(t.created_at || t.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-8 py-4 text-xs uppercase font-bold tracking-widest">
                                            {t.type === 'deposit' ? (
                                                <span className="text-emerald-500 flex items-center gap-1"><ArrowDownCircle className="w-3 h-3" /> Depósito</span>
                                            ) : (
                                                <span className="text-amber-500 flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" /> Saque</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 text-xs text-white">
                                            User #{t.user_id || t.userId}
                                        </td>
                                        <td className="px-8 py-4 font-mono text-slate-300">
                                            {Number(t.amount).toFixed(4)} POL
                                        </td>
                                        <td className="px-8 py-4 text-[10px] font-black uppercase tracking-widest">
                                            {t.status === 'completed' || t.status === 'approved' ? (
                                                <span className="text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Completo</span>
                                            ) : t.status === 'pending' ? (
                                                <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded">Pendente</span>
                                            ) : (
                                                <span className="text-red-500 bg-red-500/10 px-2 py-1 rounded">{t.status}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {activity.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-12 text-center text-slate-500 italic">
                                            Nenhuma transação encontrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
