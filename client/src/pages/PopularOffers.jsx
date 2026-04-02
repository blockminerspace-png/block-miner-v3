import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Sparkles, Clock, ShoppingBag, X, Loader2, Zap } from 'lucide-react';
import { api } from '../store/auth';
import { useGameStore } from '../store/game';
import { formatHashrate } from '../utils/machine';

function pad(n) {
    return String(n).padStart(2, '0');
}

function formatCountdown(ms) {
    if (ms <= 0) return null;
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function EventCountdown({ endsAt, isLive, endedLabel }) {
    const [tick, setTick] = useState(0);
    const end = useMemo(() => new Date(endsAt).getTime(), [endsAt]);

    useEffect(() => {
        const id = setInterval(() => setTick((x) => x + 1), 1000);
        return () => clearInterval(id);
    }, [endsAt]);

    const left = end - Date.now(); // tick forces re-render each second
    void tick;
    if (!isLive || left <= 0) {
        return (
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                {endedLabel}
            </span>
        );
    }
    return (
        <div className="flex items-center gap-2 text-amber-400">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm font-bold">{formatCountdown(left)}</span>
        </div>
    );
}

export default function PopularOffers() {
    const { t } = useTranslation();
    const { fetchAll } = useGameStore();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [buying, setBuying] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/offer-events/active');
            if (res.data.ok) {
                setEvents(res.data.events || []);
            }
        } catch (e) {
            console.error(e);
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const openBuy = (event, miner) => {
        setModal({ event, miner });
    };

    const confirmBuy = async () => {
        if (!modal?.miner || buying) return;
        try {
            setBuying(true);
            const res = await api.post('/offer-events/purchase', { eventMinerId: modal.miner.id });
            if (res.data.ok) {
                toast.success(res.data.message || t('offers.purchase_ok'));
                fetchAll();
                setModal(null);
                load();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || t('common.error'));
        } finally {
            setBuying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-gray-500">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest">{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest mb-3">
                        <Sparkles className="w-3 h-3" />
                        {t('offers.badge')}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{t('offers.title')}</h1>
                    <p className="text-gray-500 font-medium mt-2 max-w-xl">{t('offers.subtitle')}</p>
                </div>
            </div>

            {events.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-800 p-16 text-center text-gray-500">
                    {t('offers.empty')}
                </div>
            ) : (
                <div className="space-y-12">
                    {events.map((ev) => (
                        <div
                            key={ev.id}
                            className="rounded-[2rem] border border-gray-800/60 bg-surface overflow-hidden shadow-xl"
                        >
                            <div className="grid md:grid-cols-[280px_1fr] gap-0">
                                <div className="relative h-48 md:h-auto bg-slate-900">
                                    {ev.imageUrl ? (
                                        <img src={ev.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            <ShoppingBag className="w-16 h-16 opacity-30" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-white">{ev.title}</h2>
                                            <p className="text-sm text-gray-500 mt-2 line-clamp-3">{ev.description}</p>
                                        </div>
                                        <EventCountdown
                                            endsAt={ev.endsAt}
                                            isLive={ev.isLive}
                                            endedLabel={t('offers.ended')}
                                        />
                                    </div>

                                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {(ev.miners || []).map((m) => (
                                            <div
                                                key={m.id}
                                                className="rounded-2xl border border-gray-800 bg-slate-900/40 p-5 flex flex-col gap-3"
                                            >
                                                <div className="flex gap-3">
                                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                                                        {m.imageUrl ? (
                                                            <img src={m.imageUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Zap className="w-6 h-6 text-amber-500/40" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-white truncate">{m.name}</p>
                                                        <p className="text-[10px] text-primary font-mono uppercase">
                                                            {formatHashrate(Number(m.hashRate) || 0)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-gray-800/80">
                                                    <span className="text-lg font-black text-amber-400">
                                                        {Number(m.price).toFixed(6)} {m.currency}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        disabled={!ev.isLive || !m.inStock}
                                                        onClick={() => openBuy(ev, m)}
                                                        className="px-4 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                                                    >
                                                        {m.inStock ? t('offers.buy') : t('offers.sold_out')}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-slate-950 p-8 shadow-2xl relative">
                        <button
                            type="button"
                            className="absolute top-4 right-4 text-gray-500 hover:text-white"
                            onClick={() => setModal(null)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl font-black text-white pr-8">{t('offers.confirm_title')}</h3>
                        <div className="mt-6 space-y-3 text-sm text-gray-400">
                            <p>
                                <span className="text-gray-600">{t('offers.miner')}</span>{' '}
                                <span className="text-white font-bold">{modal.miner.name}</span>
                            </p>
                            <p>
                                <span className="text-gray-600">{t('offers.price')}</span>{' '}
                                <span className="text-amber-400 font-mono font-bold">
                                    {Number(modal.miner.price).toFixed(6)} {modal.miner.currency}
                                </span>
                            </p>
                            <p>
                                <span className="text-gray-600">{t('offers.hash')}</span>{' '}
                                <span className="text-primary font-mono">
                                    +{formatHashrate(Number(modal.miner.hashRate) || 0)}
                                </span>
                            </p>
                            <p className="text-xs text-slate-500 pt-2">{t('offers.confirm_note')}</p>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button
                                type="button"
                                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 text-xs font-bold uppercase"
                                onClick={() => setModal(null)}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={buying}
                                className="flex-1 py-3 rounded-xl bg-primary text-white text-xs font-black uppercase flex items-center justify-center gap-2"
                                onClick={confirmBuy}
                            >
                                {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
