import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MousePointer2, Zap, History, BarChart3, ExternalLink, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { api } from '../store/auth';

export default function PTC() {
    const { t } = useTranslation();
    const [ptcUrl, setPtcUrl] = useState('');
    const [stats, setStats] = useState(null);
    const [clientOrigin, setClientOrigin] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const rewardLabel = stats?.rewardName || 'POL';

    const fetchData = useCallback(async () => {
        try {
            const [linkRes, statsRes] = await Promise.all([
                api.get('/zerads/ptc-link'),
                api.get('/zerads/stats')
            ]);

            if (linkRes.data.ok) {
                setPtcUrl(linkRes.data.ptcUrl);
                if (linkRes.data.clientOrigin) setClientOrigin(linkRes.data.clientOrigin);
            }
            if (statsRes.data.ok) {
                setStats(statsRes.data.stats);
                const o = statsRes.data.stats?.clientOrigin;
                if (o) setClientOrigin(o);
            }
        } catch (err) {
            console.error('Failed to fetch PTC data', err);
            toast.error(t('ptcPage.load_error_toast'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const displayOrigin = clientOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
    const i18nOpts = useMemo(
        () => ({ reward: rewardLabel, origin: displayOrigin }),
        [rewardLabel, displayOrigin]
    );

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs text-center">
                    {t('ptcPage.loading')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex p-3 bg-blue-500/10 rounded-2xl">
                        <MousePointer2 className="w-6 h-6 text-blue-500" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">{t('ptcPage.title')}</h1>
                    <p className="text-gray-500 font-medium">{t('ptcPage.subtitle', i18nOpts)}</p>
                </div>
                <div className="bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2 shadow-glow-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-black text-[10px] uppercase tracking-widest">
                        {t('ptcPage.badge_official')}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-surface border border-gray-800/50 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-bl-[120px] -mr-20 -mt-20 group-hover:bg-blue-500/10 transition-colors" />

                        <div className="relative z-10 space-y-10">
                            <div className="space-y-4">
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                    <Info className="w-6 h-6 text-blue-400 shrink-0" />
                                    {t('ptcPage.earn_title')}
                                </h2>
                                <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-xl">
                                    {t('ptcPage.earn_body', i18nOpts)}
                                </p>
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl flex items-start gap-4">
                                <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest italic">
                                        {t('ptcPage.delay_title')}
                                    </h4>
                                    <p className="text-[11px] font-bold text-amber-200/80 leading-relaxed">{t('ptcPage.delay_body')}</p>
                                </div>
                            </div>

                            <div className="bg-sky-500/10 border border-sky-500/25 p-6 rounded-3xl flex items-start gap-4">
                                <Info className="w-6 h-6 text-sky-400 shrink-0 mt-1" />
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black text-sky-400 uppercase tracking-widest italic">
                                        {t('ptcPage.callback_scope_title')}
                                    </h4>
                                    <p className="text-[11px] font-bold text-sky-100/85 leading-relaxed">
                                        {t('ptcPage.callback_scope_body', i18nOpts)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <a
                                    href={ptcUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full md:w-auto px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 italic hover:scale-105 active:scale-95"
                                >
                                    <ExternalLink className="w-4 h-4" /> {t('ptcPage.open_board')}
                                </a>

                                <div className="flex items-center gap-3 text-emerald-500 bg-emerald-500/5 px-6 py-4 rounded-2xl border border-emerald-500/10">
                                    <Zap className="w-4 h-4 fill-current" />
                                    <span className="text-[10px] font-black uppercase tracking-widest italic">
                                        {t('ptcPage.payment_active')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface border border-purple-500/20 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-bl-[120px] -mr-20 -mt-20 group-hover:bg-purple-500/10 transition-colors" />

                        <div className="relative z-10 space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                    <Zap className="w-6 h-6 text-purple-500" />
                                    {t('ptcPage.more_ads_title')}
                                </h2>
                                <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-xl">{t('ptcPage.more_ads_body')}</p>
                            </div>

                            <a
                                href="/offerwall"
                                className="inline-flex w-full md:w-auto px-10 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-500/20 items-center justify-center gap-3 italic hover:scale-105 active:scale-95"
                            >
                                <ExternalLink className="w-4 h-4" /> {t('ptcPage.open_offerwall')}
                            </a>
                        </div>
                    </div>

                    <div className="bg-slate-900/30 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" /> {t('ptcPage.how_title')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Step number="1" title={t('ptcPage.step1_title')} desc={t('ptcPage.step1_desc')} />
                            <Step number="2" title={t('ptcPage.step2_title')} desc={t('ptcPage.step2_desc')} />
                            <Step number="3" title={t('ptcPage.step3_title', i18nOpts)} desc={t('ptcPage.step3_desc')} />
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-surface border border-gray-800/50 rounded-[2.5rem] p-8 shadow-xl space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5">
                            <BarChart3 className="w-20 h-20 text-blue-500" />
                        </div>

                        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-500" /> {t('ptcPage.stats_title')}
                        </h3>

                        <div className="space-y-6 relative z-10">
                            <TrackerBox label={t('ptcPage.total_clicks')} value={stats?.totalClaims ?? 0} icon={MousePointer2} color="blue" />
                            <TrackerBox
                                label={t('ptcPage.total_earned')}
                                value={`${(stats?.totalEarned ?? 0).toFixed(4)} ${rewardLabel}`}
                                icon={Zap}
                                color="emerald"
                            />

                            <div className="h-[1px] bg-gray-800 w-full" />

                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center leading-relaxed">
                                {t('ptcPage.stats_footer')}
                            </p>
                        </div>
                    </div>

                    <div className="bg-gray-950/50 border border-gray-800 rounded-[2.5rem] p-8 shadow-xl space-y-6">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
                            <History className="w-3 h-3" /> {t('ptcPage.recent_title')}
                        </h3>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide pr-1">
                            {!stats?.recent || stats.recent.length === 0 ? (
                                <p className="text-[10px] text-gray-700 font-black uppercase text-center py-8 italic tracking-widest">
                                    {t('ptcPage.recent_empty')}
                                </p>
                            ) : (
                                stats.recent.map((log, idx) => {
                                    let details = {};
                                    try {
                                        details = JSON.parse(log.detailsJson || '{}');
                                    } catch {
                                        details = {};
                                    }
                                    return (
                                        <div
                                            key={`${log.createdAt}-${idx}`}
                                            className="flex items-center justify-between p-4 bg-gray-900/50 rounded-2xl border border-gray-800/50 hover:border-gray-700 transition-all"
                                        >
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-white italic">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </p>
                                                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">
                                                    {t('ptcPage.recent_claim_label')}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black text-emerald-400">
                                                    +{Number(details.payoutAmount).toFixed(4)} {rewardLabel}
                                                </span>
                                                <span className="text-[7px] font-bold text-gray-700 uppercase tracking-tighter">
                                                    {t('ptcPage.recent_confirmed')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Step({ number, title, desc }) {
    return (
        <div className="space-y-2">
            <div className="text-2xl font-black text-slate-800 italic">0{number}</div>
            <h4 className="text-xs font-black text-white uppercase tracking-widest">{title}</h4>
            <p className="text-[10px] text-gray-500 font-bold leading-relaxed">{desc}</p>
        </div>
    );
}

function TrackerBox({ label, value, icon: Icon, color }) {
    const colors = {
        blue: 'text-blue-400 bg-blue-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10',
    };
    return (
        <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colors[color]} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-sm font-black text-white italic">{value}</span>
        </div>
    );
}
