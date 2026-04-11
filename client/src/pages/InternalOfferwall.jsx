import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LayoutGrid, Loader2, PlayCircle, Send } from 'lucide-react';
import { api } from '../store/auth';

const KIND_PTC = 'PTC_IFRAME';
const MODE_ADMIN = 'ADMIN_APPROVAL';
const STATUS_STARTED = 'STARTED';
function rewardLine(t, offer) {
  const k = String(offer.rewardKind || '').toUpperCase();
  if (k === 'BLK' && offer.rewardBlkAmount != null) {
    return t('internalOfferwallPage.reward_blk', { amount: String(offer.rewardBlkAmount) });
  }
  if (k === 'POL' && offer.rewardPolAmount != null) {
    return t('internalOfferwallPage.reward_pol', { amount: String(offer.rewardPolAmount) });
  }
  if (k === 'HASHRATE_TEMP') {
    return t('internalOfferwallPage.reward_hashrate', {
      hashRate: offer.rewardHashRate ?? 0,
      days: offer.rewardHashRateDays ?? 1
    });
  }
  return k;
}

/**
 * @param {string} startedAtIso
 * @param {boolean} active
 */
function useElapsedSeconds(startedAtIso, active) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [startedAtIso, active]);
  return useMemo(() => {
    if (!active) return 0;
    try {
      const started = new Date(startedAtIso).getTime();
      return Math.max(0, (Date.now() - started) / 1000);
    } catch {
      return 0;
    }
  }, [startedAtIso, active, tick]);
}

export default function InternalOfferwall() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [flagLoading, setFlagLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offers, setOffers] = useState([]);
  const [openAttempts, setOpenAttempts] = useState([]);
  const [startBusyId, setStartBusyId] = useState(/** @type {number | null} */ (null));
  const [submitBusyId, setSubmitBusyId] = useState(/** @type {number | null} */ (null));
  const [iframeErrorOfferId, setIframeErrorOfferId] = useState(/** @type {number | null} */ (null));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFlagLoading(true);
      try {
        const res = await api.get('/internal-offerwall/status');
        if (!cancelled) setFeatureEnabled(Boolean(res.data?.enabled));
      } catch {
        if (!cancelled) setFeatureEnabled(false);
      } finally {
        if (!cancelled) setFlagLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const res = await api.get('/internal-offerwall/offers');
      const d = res.data;
      if (d?.ok) {
        setOffers(d.offers || []);
        setOpenAttempts(d.openAttempts || []);
      } else if (d?.code === 'FEATURE_DISABLED' || res.status === 403) {
        setFeatureEnabled(false);
        setOffers([]);
        setOpenAttempts([]);
      } else {
        toast.error(t('internalOfferwallPage.load_error'));
      }
    } catch (e) {
      const code = e?.response?.data?.code;
      const st = e?.response?.status;
      if (code === 'FEATURE_DISABLED' || st === 403) {
        setFeatureEnabled(false);
        setOffers([]);
        setOpenAttempts([]);
      } else {
        toast.error(t('internalOfferwallPage.load_error'));
      }
    } finally {
      setOffersLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!featureEnabled || flagLoading) return;
    loadOffers();
  }, [featureEnabled, flagLoading, loadOffers]);

  const focusOfferId = useMemo(() => {
    const raw = searchParams.get('offer');
    const n = parseInt(String(raw || ''), 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [searchParams]);

  useEffect(() => {
    if (!focusOfferId || offersLoading || !offers.length) return;
    const exists = offers.some((o) => o.id === focusOfferId);
    if (!exists) {
      toast.error(t('internalOfferwallPage.inactive_or_missing'));
      return;
    }
    const id = requestAnimationFrame(() => {
      document.getElementById(`io-offer-${focusOfferId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [focusOfferId, offers, offersLoading, t]);

  const attemptByOfferId = useMemo(() => {
    const m = new Map();
    for (const a of openAttempts) {
      if (a?.offerId != null) m.set(a.offerId, a);
    }
    return m;
  }, [openAttempts]);

  const onStart = async (offerId) => {
    setStartBusyId(offerId);
    try {
      const res = await api.post(`/internal-offerwall/offers/${offerId}/start`);
      const d = res.data;
      if (d?.ok) {
        await loadOffers();
      } else if (d?.code === 'DAILY_LIMIT' || res.status === 429) {
        toast.error(t('internalOfferwallPage.daily_limit'));
      } else {
        toast.error(d?.message || t('internalOfferwallPage.load_error'));
      }
    } catch (e) {
      const d = e?.response?.data;
      if (e?.response?.status === 429 || d?.code === 'DAILY_LIMIT') {
        toast.error(t('internalOfferwallPage.daily_limit'));
      } else {
        toast.error(d?.message || t('internalOfferwallPage.load_error'));
      }
    } finally {
      setStartBusyId(null);
    }
  };

  const onSubmit = async (attemptId) => {
    setSubmitBusyId(attemptId);
    try {
      const res = await api.post(`/internal-offerwall/attempts/${attemptId}/submit`);
      const d = res.data;
      if (d?.ok) {
        if (d.status === 'PENDING_REVIEW') toast.success(t('internalOfferwallPage.submit_pending'));
        else toast.success(t('internalOfferwallPage.submit_ok'));
        await loadOffers();
      } else if (d?.code === 'MIN_VIEW_NOT_MET') {
        toast.error(d.message || t('internalOfferwallPage.load_error'));
      } else {
        toast.error(d?.message || t('internalOfferwallPage.load_error'));
      }
    } catch (e) {
      const d = e?.response?.data;
      if (d?.code === 'MIN_VIEW_NOT_MET') {
        toast.error(d?.message || t('internalOfferwallPage.load_error'));
      } else {
        toast.error(d?.message || t('internalOfferwallPage.load_error'));
      }
    } finally {
      setSubmitBusyId(null);
    }
  };

  if (flagLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-sky-400" aria-hidden />
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl border border-white/5 bg-slate-900/50 p-8 text-center text-slate-400">
        <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-slate-600" aria-hidden />
        <p>{t('internalOfferwallPage.disabled')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20">
          <LayoutGrid className="w-8 h-8 text-sky-400" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{t('internalOfferwallPage.title')}</h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base max-w-xl">{t('internalOfferwallPage.subtitle')}</p>
        </div>
      </div>

      {offersLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-sky-400" aria-hidden />
        </div>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-10 text-center text-slate-500">
          {t('internalOfferwallPage.empty')}
        </div>
      ) : (
        <ul className="space-y-6">
          {offers.map((offer) => {
            const attempt = attemptByOfferId.get(offer.id);
            return (
              <OfferCard
                key={offer.id}
                domId={`io-offer-${offer.id}`}
                offer={offer}
                attempt={attempt}
                t={t}
                rewardLabel={rewardLine(t, offer)}
                startBusy={startBusyId === offer.id}
                submitBusy={submitBusyId === attempt?.id}
                iframeFailed={iframeErrorOfferId === offer.id}
                onStart={() => onStart(offer.id)}
                onSubmit={() => attempt && onSubmit(attempt.id)}
                onIframeError={() => setIframeErrorOfferId(offer.id)}
                onIframeLoad={() => setIframeErrorOfferId((id) => (id === offer.id ? null : id))}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OfferCard({
  domId,
  offer,
  attempt,
  t,
  rewardLabel,
  startBusy,
  submitBusy,
  iframeFailed,
  onStart,
  onSubmit,
  onIframeError,
  onIframeLoad
}) {
  const isPtc = String(offer.kind).toUpperCase() === KIND_PTC;
  const minSec = Number(offer.minViewSeconds) || 0;
  const timerActive = attempt?.status === STATUS_STARTED && Boolean(attempt?.startedAt);
  const elapsed = useElapsedSeconds(attempt?.startedAt || '', timerActive);
  const canSubmit = attempt?.status === STATUS_STARTED && elapsed >= minSec;
  const modeSelf = String(offer.completionMode || '') !== MODE_ADMIN;
  const remaining = Math.max(0, Math.ceil(minSec - elapsed));

  return (
    <li id={domId} className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-white text-lg">{offer.title}</h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
              {isPtc ? t('internalOfferwallPage.kind_ptc') : t('internalOfferwallPage.kind_general')}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
              {modeSelf ? t('internalOfferwallPage.mode_self') : t('internalOfferwallPage.mode_admin')}
            </span>
          </div>
          {offer.description ? <p className="text-sm text-slate-400 mt-2 whitespace-pre-wrap">{offer.description}</p> : null}
          {Array.isArray(offer.taskMetadata?.requiredActions) && offer.taskMetadata.requiredActions.length > 0 ? (
            <ul className="list-decimal pl-5 text-sm text-slate-400 mt-2 space-y-1">
              {offer.taskMetadata.requiredActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : null}
          {Array.isArray(offer.taskMetadata?.targetCountryCodes) && offer.taskMetadata.targetCountryCodes.length > 0 ? (
            <p className="text-xs text-slate-500 mt-2">
              {t('internalOfferwallPage.target_regions')}: {offer.taskMetadata.targetCountryCodes.join(', ')}
            </p>
          ) : null}
          {offer.taskMetadata?.verificationNote ? (
            <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{offer.taskMetadata.verificationNote}</p>
          ) : null}
          <p className="text-sm text-sky-300/90 mt-2 font-semibold">{rewardLabel}</p>
        </div>
        {!attempt ? (
          <button
            type="button"
            disabled={startBusy}
            onClick={onStart}
            className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm disabled:opacity-50"
          >
            {startBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <PlayCircle className="w-4 h-4" aria-hidden />}
            {t('internalOfferwallPage.start')}
          </button>
        ) : null}
      </div>

      {attempt?.status === 'PENDING_REVIEW' ? (
        <p className="text-sm text-amber-400/90">{t('internalOfferwallPage.pending_review')}</p>
      ) : null}

      {attempt?.status === 'STARTED' ? (
        <>
          {isPtc && offer.iframeUrl ? (
            <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden aspect-video max-h-[420px]">
              {iframeFailed ? (
                <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-slate-500 px-4 text-center">
                  {t('internalOfferwallPage.iframe_error')}
                </div>
              ) : (
                <iframe
                  title={offer.title}
                  src={offer.iframeUrl}
                  className="w-full h-full min-h-[240px] border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  referrerPolicy="no-referrer"
                  onError={onIframeError}
                  onLoad={onIframeLoad}
                />
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-400">
              <p>{t('internalOfferwallPage.general_started_hint')}</p>
              {offer.taskMetadata?.externalInfoUrl ? (
                <a
                  href={offer.taskMetadata.externalInfoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline break-all"
                >
                  {t('internalOfferwallPage.open_external_link')}
                </a>
              ) : null}
            </div>
          )}

          <p className="text-xs text-slate-500">
            {t('internalOfferwallPage.min_view_hint', { seconds: String(minSec) })}
            {minSec > 0 && remaining > 0 ? (
              <span className="text-slate-400"> — {remaining}s</span>
            ) : null}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canSubmit || submitBusy}
              onClick={onSubmit}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-40"
            >
              {submitBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
              {t('internalOfferwallPage.submit')}
            </button>
          </div>
        </>
      ) : null}
    </li>
  );
}
