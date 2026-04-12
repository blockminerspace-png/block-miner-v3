import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../store/auth';
import { Crosshair, Play, Timer, Zap, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const GRID_SIZE = 9;
const TICK_MS = 250;

function parseIso(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function MinigamePage() {
  const { t } = useTranslation();
  const [statusLoading, setStatusLoading] = useState(true);
  const [allowNewStart, setAllowNewStart] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [activeSession, setActiveSession] = useState(null);
  const [rewardHashRate, setRewardHashRate] = useState(25);
  const [durationSeconds, setDurationSeconds] = useState(69);

  const [playing, setPlaying] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [serverEndsAt, setServerEndsAt] = useState(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const completingRef = useRef(false);
  const playingRef = useRef(false);
  /** Throttles repeat `/complete` calls after `TOO_EARLY` (fast client clock vs server). */
  const lastEarlyCompleteRef = useRef(0);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const refreshStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/minigame/status');
      if (!data?.ok) throw new Error('bad_status');
      setAllowNewStart(Boolean(data.allowNewStart));
      setCooldownEndsAt(data.cooldownEndsAt || null);
      setCooldownSec(Number(data.cooldownSecondsRemaining || 0));
      setActiveSession(data.activeSession || null);
      setRewardHashRate(Number(data.rewardHashRate ?? 25));
      setDurationSeconds(Number(data.durationSeconds ?? 69));

      if (data.activeSession && !playingRef.current && !completingRef.current) {
        setSessionId(data.activeSession.id);
        const end = parseIso(data.activeSession.endsAt);
        setServerEndsAt(end);
        setPlaying(true);
      }
    } catch {
      toast.error(t('minigame.errors.load_status'));
    } finally {
      setStatusLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshStatus();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [refreshStatus]);

  useEffect(() => {
    if (!cooldownEndsAt) {
      setCooldownSec(0);
      return;
    }
    const end = parseIso(cooldownEndsAt);
    if (!end) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 1000));
      setCooldownSec(left);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cooldownEndsAt]);

  useEffect(() => {
    if (!playing || !serverEndsAt) return;
    const tick = () => {
      const leftMs = serverEndsAt.getTime() - Date.now();
      setRemainingSec(Math.max(0, leftMs / 1000));
      if (leftMs <= 0 && sessionId && !completingRef.current) {
        const earlyAt = lastEarlyCompleteRef.current;
        if (earlyAt > 0 && Date.now() - earlyAt < 1200) return;
        completingRef.current = true;
        void (async () => {
          let keepPlaying = false;
          try {
            setBusy(true);
            const { data } = await api.post('/minigame/complete', { sessionId });
            if (!data?.ok) throw new Error(data?.code || 'complete_failed');
            lastEarlyCompleteRef.current = 0;
            setLastResult({
              rewardHashRate: data.rewardHashRate,
              powerDays: data.powerDays,
              cooldownSecondsRemaining: data.cooldownSecondsRemaining
            });
            if (data.cooldownSecondsRemaining > 0 && data.nextPlayAllowedAt) {
              setCooldownEndsAt(data.nextPlayAllowedAt);
            }
            toast.success(
              t('minigame.toast.reward', {
                hr: data.rewardHashRate,
                days: data.powerDays
              })
            );
          } catch (e) {
            const code = e?.response?.data?.code;
            if (code === 'TOO_EARLY') {
              keepPlaying = true;
              completingRef.current = false;
              lastEarlyCompleteRef.current = Date.now();
            } else {
              const key = code ? `minigame.errors.${code}` : 'minigame.errors.complete_failed';
              const msg = t(key);
              toast.error(msg === key ? t('minigame.errors.complete_failed') : msg);
            }
          } finally {
            setBusy(false);
            if (!keepPlaying) {
              setPlaying(false);
              setSessionId(null);
              setServerEndsAt(null);
              setStreak(0);
              completingRef.current = false;
              void refreshStatus();
            }
          }
        })();
      }
    };
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, serverEndsAt, sessionId, refreshStatus, t]);

  const pickNextTarget = useCallback((avoid) => {
    let next = Math.floor(Math.random() * GRID_SIZE);
    let guard = 0;
    while (next === avoid && guard < 8) {
      next = Math.floor(Math.random() * GRID_SIZE);
      guard += 1;
    }
    return next;
  }, []);

  useEffect(() => {
    if (!playing) return;
    setTargetIndex((prev) => pickNextTarget(prev));
  }, [playing, pickNextTarget]);

  const onPlay = async () => {
    if (busy || cooldownSec > 0) return;
    setBusy(true);
    setLastResult(null);
    lastEarlyCompleteRef.current = 0;
    try {
      const { data } = await api.post('/minigame/start');
      if (!data?.ok || !data.session) throw new Error(data?.code || 'start_failed');
      const end = parseIso(data.session.endsAt);
      if (!end) throw new Error('bad_ends_at');
      setSessionId(data.session.id);
      setServerEndsAt(end);
      setPlaying(true);
      setStreak(0);
      setAllowNewStart(false);
    } catch (e) {
      const code = e?.response?.data?.code;
      if (code === 'COOLDOWN_ACTIVE') {
        toast.error(t('minigame.errors.cooldown_active'));
        if (e.response?.data?.cooldownEndsAt) {
          setCooldownEndsAt(e.response.data.cooldownEndsAt);
        }
      } else {
        toast.error(t('minigame.errors.start_failed'));
      }
    } finally {
      setBusy(false);
      void refreshStatus();
    }
  };

  const onCellTap = (idx) => {
    if (!playing || busy) return;
    if (idx !== targetIndex) {
      setStreak((s) => Math.max(0, s - 1));
      return;
    }
    setStreak((s) => s + 1);
    setTargetIndex((prev) => pickNextTarget(prev));
  };

  const playDisabled = useMemo(() => {
    if (statusLoading || busy) return true;
    if (playing) return true;
    if (cooldownSec > 0) return true;
    if (!allowNewStart && !activeSession) return true;
    return false;
  }, [statusLoading, busy, playing, cooldownSec, allowNewStart, activeSession]);

  const playLabel = useMemo(() => {
    if (playing) return t('minigame.play_running');
    if (cooldownSec > 0) return t('minigame.play_cooldown', { time: formatClock(cooldownSec) });
    if (activeSession && !allowNewStart) return t('minigame.play_resume');
    return t('minigame.play');
  }, [playing, cooldownSec, activeSession, allowNewStart, t]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/30">
          <Crosshair className="w-8 h-8 text-violet-300" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('minigame.title')}</h1>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{t('minigame.subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex items-center gap-3">
          <Timer className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{t('minigame.card_duration')}</p>
            <p className="text-lg font-mono text-white">{durationSeconds}s</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-400 shrink-0" aria-hidden />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{t('minigame.card_reward')}</p>
            <p className="text-lg font-mono text-white">
              {t('minigame.reward_hs', { hr: rewardHashRate })}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{t('minigame.card_cooldown')}</p>
            <p className="text-lg font-mono text-white">{t('minigame.cooldown_minutes')}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950 p-6 sm:p-8 shadow-2xl">
        {!playing && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <p className="text-sm text-slate-400">{t('minigame.instructions_idle')}</p>
            <button
              type="button"
              onClick={() => void onPlay()}
              disabled={playDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold px-6 py-3 transition-colors"
            >
              <Play className="w-5 h-5" aria-hidden />
              {playLabel}
            </button>
          </div>
        )}

        {playing && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{t('minigame.round_timer')}</p>
                <p className="text-3xl font-mono text-white tabular-nums">{formatClock(remainingSec)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{t('minigame.streak')}</p>
                <p className="text-3xl font-mono text-emerald-400 tabular-nums">{streak}</p>
              </div>
            </div>
            <p className="text-sm text-slate-400">{t('minigame.instructions_play')}</p>
            <div
              className="grid grid-cols-3 gap-3 sm:gap-4 max-w-md mx-auto"
              role="application"
              aria-label={t('minigame.grid_aria')}
            >
              {Array.from({ length: GRID_SIZE }, (_, i) => {
                const isTarget = i === targetIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onCellTap(i)}
                    className={[
                      'aspect-square rounded-2xl border transition-all duration-150',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                      isTarget
                        ? 'bg-violet-500/40 border-violet-400 shadow-[0_0_24px_rgba(139,92,246,0.45)] scale-[1.02]'
                        : 'bg-slate-800/80 border-white/10 hover:border-white/20'
                    ].join(' ')}
                    aria-label={t('minigame.cell_aria', { index: i + 1 })}
                  />
                );
              })}
            </div>
            <p className="text-center text-xs text-slate-500">{t('minigame.server_sync_hint')}</p>
          </div>
        )}

        {lastResult && !playing && (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-100">
            {t('minigame.last_win', {
              hr: lastResult.rewardHashRate,
              days: lastResult.powerDays,
              cd: formatClock(lastResult.cooldownSecondsRemaining || 0)
            })}
          </div>
        )}
      </div>
    </div>
  );
}
