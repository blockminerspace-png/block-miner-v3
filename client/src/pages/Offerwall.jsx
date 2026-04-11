import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, api } from '../store/auth';
import { toast } from 'sonner';
import { Briefcase, AlertCircle, ExternalLink, X, Clock, Zap, Star, Copy, Link2 } from 'lucide-react';

export default function Offerwall() {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const [activeOfferwall, setActiveOfferwall] = useState(null);
    const [frameUrl, setFrameUrl] = useState('');
    const [postbackUrl, setPostbackUrl] = useState('');
    const [loadState, setLoadState] = useState('idle');

    const fetchFrame = useCallback(async () => {
        if (!user) return;
        setLoadState('loading');
        try {
            const { data } = await api.get('/offerwall/frame-url');
            if (data.ok && data.frameUrl) {
                setFrameUrl(data.frameUrl);
                setPostbackUrl(data.postbackUrl || '');
                setLoadState('ready');
            } else {
                setLoadState('error');
            }
        } catch (err) {
            const code = err.response?.data?.code;
            if (code === 'OFFERWALL_NOT_CONFIGURED' || err.response?.status === 503) {
                setLoadState('not_configured');
            } else {
                setLoadState('error');
                toast.error(t('offerwallPage.load_error'));
            }
        }
    }, [user, t]);

    useEffect(() => {
        fetchFrame();
    }, [fetchFrame]);

    const offerwalls = useMemo(
        () => [
            {
                id: 'offerwall_me',
                nameKey: 'offerwallPage.walls.offerwall_me.name',
                descriptionKey: 'offerwallPage.walls.offerwall_me.description',
                icon: Zap,
                color: 'text-purple-500',
                bg: 'bg-purple-500/10',
                border: 'border-purple-500/20',
                badgeKey: 'offerwallPage.walls.offerwall_me.badge',
                available: loadState === 'ready' && Boolean(frameUrl),
                onClick: () => {
                    if (!frameUrl) return;
                    window.open(frameUrl, '_blank', 'noopener,noreferrer');
                }
            },
            {
                id: 'time_wall',
                nameKey: 'offerwallPage.walls.time_wall.name',
                descriptionKey: 'offerwallPage.walls.time_wall.description',
                icon: Clock,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20',
                badgeKey: 'offerwallPage.walls.time_wall.badge',
                available: false,
                onClick: () => {}
            },
            {
                id: 'cpx_research',
                nameKey: 'offerwallPage.walls.cpx_research.name',
                descriptionKey: 'offerwallPage.walls.cpx_research.description',
                icon: Star,
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
                border: 'border-amber-500/20',
                badgeKey: 'offerwallPage.walls.cpx_research.badge',
                available: false,
                onClick: () => {}
            }
        ],
        [frameUrl, loadState]
    );

    const openEmbedded = (name) => {
        if (!frameUrl) return;
        setActiveOfferwall({ url: frameUrl, name });
    };

    const copyPostback = async () => {
        if (!postbackUrl) return;
        try {
            await navigator.clipboard.writeText(postbackUrl);
            toast.success(t('offerwallPage.copied_toast'));
        } catch {
            toast.error(t('offerwallPage.load_error'));
        }
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3 uppercase italic">
                        <Briefcase className="w-8 h-8 text-primary" />
                        {t('offerwallPage.title')}
                    </h1>
                    <p className="text-gray-500 font-medium mt-1 max-w-2xl">{t('offerwallPage.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">{t('offerwallPage.badge')}</span>
                </div>
            </div>

            {!user ? (
                <div className="bg-surface border border-gray-800/50 rounded-3xl p-12 shadow-xl flex flex-col items-center justify-center text-center space-y-4">
                    <AlertCircle className="w-16 h-16 text-gray-600 mb-2" />
                    <h2 className="text-xl font-bold text-white">{t('offerwallPage.login_title')}</h2>
                    <p className="text-gray-400 font-medium max-w-md">{t('offerwallPage.login_body')}</p>
                </div>
            ) : loadState === 'loading' ? (
                <div className="bg-surface border border-gray-800/50 rounded-3xl p-16 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">{t('offerwallPage.loading')}</p>
                </div>
            ) : loadState === 'not_configured' ? (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-10 flex items-start gap-4">
                    <AlertCircle className="w-8 h-8 text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-100/90 font-medium leading-relaxed">{t('offerwallPage.not_configured')}</p>
                </div>
            ) : (
                <>
                    {postbackUrl ? (
                        <div className="bg-slate-900/60 border border-slate-700/80 rounded-3xl p-8 space-y-4">
                            <div className="flex items-center gap-2 text-slate-300">
                                <Link2 className="w-4 h-4" />
                                <h2 className="text-xs font-black uppercase tracking-widest">{t('offerwallPage.postback_title')}</h2>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed max-w-3xl">{t('offerwallPage.postback_body')}</p>
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                                <code className="text-[10px] text-emerald-400/90 break-all bg-black/40 px-4 py-3 rounded-xl border border-slate-800 flex-1">
                                    {postbackUrl}
                                </code>
                                <button
                                    type="button"
                                    onClick={copyPostback}
                                    className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest"
                                >
                                    <Copy className="w-4 h-4" />
                                    {t('offerwallPage.copy_postback')}
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {offerwalls.map((wall) => (
                            <div
                                key={wall.id}
                                className={`bg-surface border ${wall.border} rounded-[2.5rem] p-8 shadow-xl transition-all duration-300 relative overflow-hidden group ${
                                    wall.available ? 'hover:border-opacity-50 hover:-translate-y-1 cursor-pointer' : 'opacity-70 grayscale-[30%]'
                                }`}
                                onClick={wall.available ? wall.onClick : undefined}
                            >
                                <div
                                    className="absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -mr-10 -mt-10 transition-colors opacity-20 group-hover:opacity-30"
                                    style={{ backgroundColor: wall.available ? 'var(--color-primary)' : 'gray' }}
                                />

                                <div className="relative z-10 flex flex-col h-full space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className={`p-4 rounded-2xl ${wall.bg}`}>
                                            <wall.icon className={`w-8 h-8 ${wall.color}`} />
                                        </div>
                                        {wall.badgeKey ? (
                                            <span
                                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                    wall.available
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-gray-800 text-gray-400 border-gray-700'
                                                }`}
                                            >
                                                {t(wall.badgeKey)}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2 flex-grow">
                                        <h3 className="text-2xl font-black text-white tracking-tight">{t(wall.nameKey)}</h3>
                                        <p className="text-sm text-gray-400 leading-relaxed font-medium">{t(wall.descriptionKey)}</p>
                                    </div>

                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            disabled={!wall.available}
                                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                                wall.available
                                                    ? 'bg-primary hover:bg-primary-hover text-white shadow-xl shadow-primary/20 active:scale-95'
                                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                            }`}
                                        >
                                            {wall.available ? (
                                                <>
                                                    {t('offerwallPage.walls.access')} <ExternalLink className="w-4 h-4" />
                                                </>
                                            ) : (
                                                t('offerwallPage.walls.unavailable')
                                            )}
                                        </button>
                                        {wall.id === 'offerwall_me' && wall.available ? (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEmbedded(t(wall.nameKey));
                                                }}
                                                className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest"
                                            >
                                                {t('offerwallPage.open_embed')}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {loadState === 'ready' ? (
                        <p className="text-[10px] text-center text-slate-600 font-bold uppercase tracking-widest">{t('offerwallPage.open_hint')}</p>
                    ) : null}
                </>
            )}

            {activeOfferwall &&
                createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-surface border border-gray-800 rounded-[2rem] w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-800/50 bg-gray-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                        <Zap className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter leading-tight">
                                            {activeOfferwall.name}
                                        </h3>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                            {t('offerwallPage.modal_subtitle')}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveOfferwall(null)}
                                    className="p-3 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-grow bg-white relative w-full h-full">
                                <iframe
                                    src={activeOfferwall.url}
                                    className="absolute inset-0 w-full h-full border-0"
                                    title={t('offerwallPage.iframe_title')}
                                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                                />
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
