import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  Clock,
  Gift,
  Pickaxe,
  TrendingUp,
  Users,
  UserPlus,
  Wallet,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import BrandLogo from '../components/BrandLogo';

const LAUNCH_DATE = new Date('2026-03-05T00:00:00.000Z');

function uptimeDays() {
  return Math.floor((Date.now() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24));
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left text-white font-semibold hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <span>{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="px-6 pb-6 text-sm leading-relaxed text-slate-300 border-t border-white/10">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [publicStats, setPublicStats] = useState(null);

  useEffect(() => {
    document.title = 'Block Miner — Simulated POL Mining Farm | blockminer.space';
    const metaTag = document.querySelector('meta[name="description"]') || document.createElement('meta');
    metaTag.name = 'description';
    metaTag.content =
      'Build your simulated cryptocurrency mining farm on Polygon (POL). Buy rigs, earn block rewards every ~10 minutes proportional to your hashrate, withdraw on-chain. Free to play — no guaranteed returns.';
    if (!document.querySelector('meta[name="description"]')) {
      document.head.appendChild(metaTag);
    }

    fetch('/api/public-stats')
      .then((res) => res.json())
      .then((data) => data.ok && setPublicStats(data))
      .catch(() => {});
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const days = uptimeDays();

  const statsCards = [
    {
      icon: Users,
      label: t('landing.stats.users_label'),
      value: publicStats ? publicStats.users.toLocaleString() : '—',
      sub: t('landing.stats.users_sub'),
      iconColor: 'bg-sky-500/15 text-sky-300',
    },
    {
      icon: Wallet,
      label: t('landing.stats.withdrawn_label'),
      value: publicStats ? `${Number(publicStats.totalWithdrawn).toLocaleString(undefined, { maximumFractionDigits: 2 })} POL` : '—',
      sub: t('landing.stats.withdrawn_sub'),
      iconColor: 'bg-emerald-500/15 text-emerald-300',
    },
    {
      icon: Clock,
      label: t('landing.stats.uptime_label'),
      value: `${days} dias`,
      sub: t('landing.stats.uptime_sub'),
      iconColor: 'bg-violet-500/15 text-violet-300',
    },
    {
      icon: Zap,
      label: t('landing.stats.miners_label'),
      value: publicStats ? publicStats.activeMiners.toLocaleString() : '—',
      sub: t('landing.stats.miners_sub'),
      iconColor: 'bg-amber-500/15 text-amber-300',
    },
  ];

  const featureCards = [
    { icon: Zap, title: 'Motor de blocos ao vivo', body: 'O motor atualiza hashrate, progresso do bloco e distribuição do pool a cada ciclo de ~10 minutos.' },
    { icon: Wallet, title: 'Carteira & saques', body: 'Saldo interno em POL, pedidos de saque e integração com Polygon para operações on-chain.' },
    { icon: Gift, title: 'Check-in diário, faucet & PTC', body: 'Atividades diárias e offerwalls para ganhar créditos e aumentar seu hashrate.' },
  ];

  const howSteps = [
    { icon: UserPlus, titleKey: 'landing.how.step1_title', bodyKey: 'landing.how.step1_body' },
    { icon: Pickaxe, titleKey: 'landing.how.step2_title', bodyKey: 'landing.how.step2_body' },
    { icon: TrendingUp, titleKey: 'landing.how.step3_title', bodyKey: 'landing.how.step3_body' },
  ];

  const faqItems = [
    { qKey: 'landing.faq.q1', aKey: 'landing.faq.a1' },
    { qKey: 'landing.faq.q2', aKey: 'landing.faq.a2' },
    { qKey: 'landing.faq.q3', aKey: 'landing.faq.a3' },
    { qKey: 'landing.faq.q4', aKey: 'landing.faq.a4' },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020511] text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-90">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-[#060a12]" />
        <div className="absolute inset-x-0 top-0 h-[35vh] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_45%)]" />
        <div className="absolute inset-x-0 top-[48vh] bottom-0 bg-[linear-gradient(180deg,transparent,rgba(7,15,28,0.96))]" />
        <div
          className="absolute inset-x-0 bottom-0 top-[46vh] opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(56,189,248,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.16) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-[#02070f]/95 backdrop-blur-xl sticky top-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3 text-white" aria-label="Block Miner">
            <BrandLogo variant="header" interactive />
            <span className="hidden text-sm font-black uppercase tracking-[0.3em] text-sky-400 sm:inline-flex">BLOCKMINER</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Entrar
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 transition-all"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-14 pb-24 sm:pt-20 sm:pb-32">
          <div className="text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 shadow-[0_0_50px_rgba(15,23,42,0.25)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Jogo online — blocos sendo minerados agora
            </div>
            <h1 className="mt-8 text-5xl font-black leading-[0.95] text-white sm:text-6xl lg:text-7xl">
              Jogue, Minere e <span className="text-sky-400">Ganhe Cripto</span> de Verdade
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              A plataforma Web3 que já está no ar: monte sua farm, compre miners e receba recompensas reais em POL — tudo direto do seu browser.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-sky-500/25 transition-transform hover:-translate-y-0.5"
              >
                Jogar Agora — É Grátis
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-slate-100 hover:bg-white/10 transition-colors"
              >
                Já tenho conta
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statsCards.map(({ icon: Icon, label, value, sub, iconColor }) => (
              <div key={label} className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-slate-950/20">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-3xl ${iconColor}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <p className="mt-5 text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
                <p className="mt-4 text-3xl font-black text-white">{value}</p>
                <p className="mt-2 text-sm text-slate-400">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#08101c] py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="text-center mb-14">
              <p className="text-sm uppercase tracking-[0.32em] text-sky-400">O que a plataforma faz de verdade</p>
              <h2 className="mt-4 text-4xl font-black text-white">Funcionalidades reais, sem marketing vazio.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {featureCards.map((card) => (
                <div key={card.title} className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-slate-950/25">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900/90 text-sky-400">
                    <card.icon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-white">{card.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-slate-400">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 sm:px-8 py-20">
          <div className="text-center mb-14">
            <p className="text-sm uppercase tracking-[0.32em] text-sky-400">Como funciona</p>
            <h2 className="mt-4 text-4xl font-black text-white">Três passos para sua primeira recompensa em POL.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {howSteps.map(({ icon: StepIcon, titleKey, bodyKey }) => (
              <div key={titleKey} className="flex h-full flex-col rounded-[2rem] border border-white/10 bg-[#0b1728] p-8 shadow-xl shadow-slate-950/20">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950/90 text-sky-400">
                  <StepIcon className="h-7 w-7" aria-hidden />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">{t(titleKey)}</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">{t(bodyKey)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#08101c] py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.32em] text-sky-400">Perguntas frequentes</p>
              <h2 className="mt-4 text-4xl font-black text-white">Dúvidas rápidas sobre o BlockMiner</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {faqItems.map(({ qKey, aKey }) => (
                <FaqItem key={qKey} question={t(qKey)} answer={t(aKey)} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 sm:px-8 py-20">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-10 shadow-2xl shadow-slate-950/30">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center">
              <div>
                <p className="text-sm uppercase tracking-[0.32em] text-sky-400">Pronto para começar?</p>
                <h2 className="mt-4 text-4xl font-black text-white">Crie sua conta e comece a minerar POL agora mesmo.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
                  Plataforma já ativa com recursos reais, extraindo valor na Polygon sem promessas vazias.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:brightness-110 transition-all"
                >
                  Criar conta gratuitamente
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-slate-100 hover:bg-white/10 transition-colors"
                >
                  Já tenho conta
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#02070f] py-10 px-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} BlockMiner. Todos os direitos reservados.</p>
          <p className="max-w-md">Jogo de mineração Web3 com recursos reais e economia de tokens POL integrada.</p>
        </div>
      </footer>
    </div>
  );
}
