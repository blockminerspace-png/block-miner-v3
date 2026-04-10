import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../store/auth';
import ImageUploader from '../components/ImageUploader';

const REWARD_KINDS = ['NONE', 'SHOP_MINER', 'EVENT_MINER', 'HASHRATE_TEMP', 'BLK', 'POL'];
const CADENCES = ['EVENT', 'DAILY', 'WEEKLY'];
const MISSION_TYPES = ['PLAY_GAMES', 'MINE_BLK', 'LOGIN_DAY'];

export default function AdminMiniPassSeason() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [seasonId, setSeasonId] = useState(isNew ? null : parseInt(id, 10));

  const [form, setForm] = useState({
    slug: '',
    titleEn: '',
    titlePtBR: '',
    titleEs: '',
    subtitleEn: '',
    subtitlePtBR: '',
    subtitleEs: '',
    startsAt: '',
    endsAt: '',
    maxLevel: 10,
    xpPerLevel: 100,
    buyLevelPricePol: '1',
    completePassPricePol: '10',
    bannerImageUrl: '',
    isActive: true
  });

  const [rewards, setRewards] = useState([]);
  const [missions, setMissions] = useState([]);

  const [rewardDraft, setRewardDraft] = useState({
    level: 1,
    rewardKind: 'NONE',
    minerId: '',
    eventMinerId: '',
    hashRate: '',
    hashRateDays: '7',
    blkAmount: '',
    polAmount: '',
    titleEn: '',
    titlePtBR: '',
    titleEs: ''
  });

  const [missionDraft, setMissionDraft] = useState({
    cadence: 'EVENT',
    missionType: 'PLAY_GAMES',
    targetValue: '1',
    xpReward: '50',
    titleEn: '',
    titlePtBR: '',
    titleEs: '',
    descriptionEn: '',
    descriptionPtBR: '',
    descriptionEs: '',
    gameSlug: '',
    sortOrder: '0'
  });

  const load = useCallback(async () => {
    if (isNew || !seasonId) return;
    try {
      setLoading(true);
      const res = await api.get(`/admin/mini-pass/seasons/${seasonId}`);
      if (!res.data.ok || !res.data.season) {
        toast.error('Season not found');
        navigate('/admin/mini-pass');
        return;
      }
      const s = res.data.season;
      const ti = s.titleI18n || {};
      const st = s.subtitleI18n || {};
      setForm({
        slug: s.slug || '',
        titleEn: ti.en || '',
        titlePtBR: ti.ptBR || '',
        titleEs: ti.es || '',
        subtitleEn: st.en || '',
        subtitlePtBR: st.ptBR || '',
        subtitleEs: st.es || '',
        startsAt: s.startsAt ? new Date(s.startsAt).toISOString().slice(0, 16) : '',
        endsAt: s.endsAt ? new Date(s.endsAt).toISOString().slice(0, 16) : '',
        maxLevel: s.maxLevel || 10,
        xpPerLevel: s.xpPerLevel || 100,
        buyLevelPricePol: String(s.buyLevelPricePol ?? '0'),
        completePassPricePol: String(s.completePassPricePol ?? '0'),
        bannerImageUrl: s.bannerImageUrl || '',
        isActive: !!s.isActive
      });
      setRewards(s.levelRewards || []);
      setMissions(s.missions || []);
    } catch {
      toast.error('Failed to load season');
      navigate('/admin/mini-pass');
    } finally {
      setLoading(false);
    }
  }, [isNew, seasonId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSeason = async (e) => {
    e?.preventDefault?.();
    try {
      setSaving(true);
      const titleI18n = { en: form.titleEn, ptBR: form.titlePtBR, es: form.titleEs };
      const subtitleI18n =
        form.subtitleEn || form.subtitlePtBR || form.subtitleEs
          ? { en: form.subtitleEn, ptBR: form.subtitlePtBR, es: form.subtitleEs }
          : null;
      const payload = {
        slug: form.slug.trim().toLowerCase(),
        titleI18n,
        subtitleI18n,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        maxLevel: Number(form.maxLevel),
        xpPerLevel: Number(form.xpPerLevel),
        buyLevelPricePol: form.buyLevelPricePol,
        completePassPricePol: form.completePassPricePol,
        bannerImageUrl: form.bannerImageUrl || null,
        isActive: form.isActive
      };
      if (isNew) {
        const res = await api.post('/admin/mini-pass/seasons', payload);
        if (res.data.ok && res.data.season?.id) {
          toast.success('Season created');
          navigate(`/admin/mini-pass/${res.data.season.id}`);
        }
      } else {
        await api.put(`/admin/mini-pass/seasons/${seasonId}`, payload);
        toast.success('Season updated');
        load();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addReward = async () => {
    if (!seasonId) {
      toast.error('Save the season first');
      return;
    }
    try {
      const titleI18n =
        rewardDraft.titleEn || rewardDraft.titlePtBR || rewardDraft.titleEs
          ? { en: rewardDraft.titleEn, ptBR: rewardDraft.titlePtBR, es: rewardDraft.titleEs }
          : null;
      const body = {
        level: Number(rewardDraft.level),
        rewardKind: rewardDraft.rewardKind,
        minerId: rewardDraft.minerId ? Number(rewardDraft.minerId) : null,
        eventMinerId: rewardDraft.eventMinerId ? Number(rewardDraft.eventMinerId) : null,
        hashRate: rewardDraft.hashRate ? Number(rewardDraft.hashRate) : null,
        hashRateDays: rewardDraft.hashRateDays ? Number(rewardDraft.hashRateDays) : null,
        blkAmount: rewardDraft.blkAmount || null,
        polAmount: rewardDraft.polAmount || null,
        titleI18n
      };
      await api.post(`/admin/mini-pass/seasons/${seasonId}/level-rewards`, body);
      toast.success('Reward tier added');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add reward');
    }
  };

  const deleteReward = async (rid) => {
    if (!confirm('Delete this tier?')) return;
    try {
      await api.delete(`/admin/mini-pass/seasons/${seasonId}/level-rewards/${rid}`);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const addMission = async () => {
    if (!seasonId) {
      toast.error('Save the season first');
      return;
    }
    try {
      const descriptionI18n =
        missionDraft.descriptionEn.trim() ||
        missionDraft.descriptionPtBR.trim() ||
        missionDraft.descriptionEs.trim()
          ? {
              en: missionDraft.descriptionEn.trim(),
              ptBR: missionDraft.descriptionPtBR.trim(),
              es: missionDraft.descriptionEs.trim()
            }
          : null;

      const body = {
        cadence: missionDraft.cadence,
        missionType: missionDraft.missionType,
        targetValue: missionDraft.targetValue,
        xpReward: Number(missionDraft.xpReward),
        titleI18n: {
          en: missionDraft.titleEn,
          ptBR: missionDraft.titlePtBR,
          es: missionDraft.titleEs
        },
        descriptionI18n,
        gameSlug: missionDraft.gameSlug || null,
        sortOrder: Number(missionDraft.sortOrder) || 0
      };
      await api.post(`/admin/mini-pass/seasons/${seasonId}/missions`, body);
      toast.success('Mission added');
      setMissionDraft((d) => ({
        ...d,
        descriptionEn: '',
        descriptionPtBR: '',
        descriptionEs: '',
        titleEn: '',
        titlePtBR: '',
        titleEs: ''
      }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add mission');
    }
  };

  const deleteMission = async (mid) => {
    if (!confirm('Delete mission?')) return;
    try {
      await api.delete(`/admin/mini-pass/seasons/${seasonId}/missions/${mid}`);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-4xl">
      <button
        type="button"
        onClick={() => navigate('/admin/mini-pass')}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <form onSubmit={saveSeason} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-black text-white">Season</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-xs text-slate-500 uppercase">
            Slug
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              disabled={!isNew}
            />
          </label>
          <label className="block text-xs text-slate-500 uppercase">
            Banner
            <div className="mt-1">
              <ImageUploader
                value={form.bannerImageUrl}
                onChange={(url) => setForm({ ...form, bannerImageUrl: url })}
              />
            </div>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['En', 'Pt-BR', 'Es'].map((label, i) => {
            const keys = ['titleEn', 'titlePtBR', 'titleEs'];
            return (
              <label key={label} className="block text-xs text-slate-500 uppercase">
                Title ({label})
                <input
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
                  value={form[keys[i]]}
                  onChange={(e) => setForm({ ...form, [keys[i]]: e.target.value })}
                  required={i === 0}
                />
              </label>
            );
          })}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['subtitleEn', 'subtitlePtBR', 'subtitleEs'].map((k, i) => (
            <label key={k} className="block text-xs text-slate-500 uppercase">
              Subtitle ({['En', 'Pt-BR', 'Es'][i]})
              <input
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-xs text-slate-500 uppercase">
            Start
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm text-white"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
          </label>
          <label className="text-xs text-slate-500 uppercase">
            End
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm text-white"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              required
            />
          </label>
          <label className="text-xs text-slate-500 uppercase">
            Max level
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
              value={form.maxLevel}
              onChange={(e) => setForm({ ...form, maxLevel: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500 uppercase">
            XP / level
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
              value={form.xpPerLevel}
              onChange={(e) => setForm({ ...form, xpPerLevel: e.target.value })}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-500 uppercase">
            Buy level (POL)
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
              value={form.buyLevelPricePol}
              onChange={(e) => setForm({ ...form, buyLevelPricePol: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500 uppercase">
            Complete pass (POL)
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
              value={form.completePassPricePol}
              onChange={(e) => setForm({ ...form, completePassPricePol: e.target.value })}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save season'}
        </button>
      </form>

      {!isNew && seasonId && (
        <>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Level rewards</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <input
                type="number"
                placeholder="Level"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={rewardDraft.level}
                onChange={(e) => setRewardDraft({ ...rewardDraft, level: e.target.value })}
              />
              <select
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={rewardDraft.rewardKind}
                onChange={(e) => setRewardDraft({ ...rewardDraft, rewardKind: e.target.value })}
              >
                {REWARD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                placeholder="shop minerId"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={rewardDraft.minerId}
                onChange={(e) => setRewardDraft({ ...rewardDraft, minerId: e.target.value })}
              />
              <input
                placeholder="event minerId"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={rewardDraft.eventMinerId}
                onChange={(e) => setRewardDraft({ ...rewardDraft, eventMinerId: e.target.value })}
              />
              <input
                placeholder="hashRate"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={rewardDraft.hashRate}
                onChange={(e) => setRewardDraft({ ...rewardDraft, hashRate: e.target.value })}
              />
              <input
                placeholder="hash days"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={rewardDraft.hashRateDays}
                onChange={(e) => setRewardDraft({ ...rewardDraft, hashRateDays: e.target.value })}
              />
              <input
                placeholder="BLK amt"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={rewardDraft.blkAmount}
                onChange={(e) => setRewardDraft({ ...rewardDraft, blkAmount: e.target.value })}
              />
              <input
                placeholder="POL amt"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={rewardDraft.polAmount}
                onChange={(e) => setRewardDraft({ ...rewardDraft, polAmount: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={addReward}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-xs"
            >
              <Plus className="w-4 h-4" />
              Add tier
            </button>
            <ul className="divide-y divide-slate-800 text-sm">
              {rewards.map((r) => (
                <li key={r.id} className="py-2 flex justify-between gap-2">
                  <span className="text-slate-300">
                    L{r.level} — {r.rewardKind}
                  </span>
                  <button type="button" onClick={() => deleteReward(r.id)} className="text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Missions</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <select
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={missionDraft.cadence}
                onChange={(e) => setMissionDraft({ ...missionDraft, cadence: e.target.value })}
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={missionDraft.missionType}
                onChange={(e) => setMissionDraft({ ...missionDraft, missionType: e.target.value })}
              >
                {MISSION_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                placeholder="target"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={missionDraft.targetValue}
                onChange={(e) => setMissionDraft({ ...missionDraft, targetValue: e.target.value })}
              />
              <input
                placeholder="XP reward"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={missionDraft.xpReward}
                onChange={(e) => setMissionDraft({ ...missionDraft, xpReward: e.target.value })}
              />
              <input
                placeholder="game slug (optional)"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={missionDraft.gameSlug}
                onChange={(e) => setMissionDraft({ ...missionDraft, gameSlug: e.target.value })}
              />
              <input
                placeholder="title EN"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={missionDraft.titleEn}
                onChange={(e) => setMissionDraft({ ...missionDraft, titleEn: e.target.value })}
              />
              <input
                placeholder="title pt-BR"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={missionDraft.titlePtBR}
                onChange={(e) => setMissionDraft({ ...missionDraft, titlePtBR: e.target.value })}
              />
              <input
                placeholder="title ES"
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                value={missionDraft.titleEs}
                onChange={(e) => setMissionDraft({ ...missionDraft, titleEs: e.target.value })}
              />
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Description (optional)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <textarea
                placeholder="description EN (required if any description)"
                rows={2}
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white resize-y min-h-[2.5rem]"
                value={missionDraft.descriptionEn}
                onChange={(e) => setMissionDraft({ ...missionDraft, descriptionEn: e.target.value })}
              />
              <textarea
                placeholder="description pt-BR"
                rows={2}
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white resize-y min-h-[2.5rem]"
                value={missionDraft.descriptionPtBR}
                onChange={(e) => setMissionDraft({ ...missionDraft, descriptionPtBR: e.target.value })}
              />
              <textarea
                placeholder="description ES"
                rows={2}
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white resize-y min-h-[2.5rem]"
                value={missionDraft.descriptionEs}
                onChange={(e) => setMissionDraft({ ...missionDraft, descriptionEs: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={addMission}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-xs"
            >
              <Plus className="w-4 h-4" />
              Add mission
            </button>
            <ul className="divide-y divide-slate-800 text-sm">
              {missions.map((m) => {
                const desc = m.descriptionI18n?.en || '';
                return (
                  <li key={m.id} className="py-2 flex justify-between gap-2">
                    <span className="text-slate-300">
                      <span className="block">
                        {m.missionType} / {m.cadence} → {String(m.targetValue)} (+
                        {m.xpReward} XP)
                      </span>
                      {desc ? (
                        <span className="block text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                          {desc}
                        </span>
                      ) : null}
                    </span>
                    <button type="button" onClick={() => deleteMission(m.id)} className="text-red-400 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
