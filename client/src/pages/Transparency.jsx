import { useEffect, useState } from 'react';
import {
  Eye,
  Server,
  Wrench,
  Megaphone,
  Briefcase,
  Scale,
  Package,
  DollarSign,
  Calendar,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  CheckCircle2,
  Clock,
} from 'lucide-react';

const CATEGORY_META = {
  infrastructure: { label: 'Infraestrutura',   icon: Server,       color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'  },
  tooling:        { label: 'Ferramentas',        icon: Wrench,       color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20'},
  marketing:      { label: 'Marketing',          icon: Megaphone,    color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20'  },
  payroll:        { label: 'Equipe',             icon: Briefcase,    color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  legal:          { label: 'Jurídico',           icon: Scale,        color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  misc:           { label: 'Outros',             icon: Package,      color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20'  },
};

const PERIOD_LABEL = {
  daily:    'Diário',
  monthly:  'Mensal',
  annual:   'Anual',
  one_time: 'Único',
};

// Converte qualquer período para valor mensal estimado
function toMonthly(amount, period) {
  const n = parseFloat(amount);
  if (period === 'daily')    return n * 30;
  if (period === 'monthly')  return n;
  if (period === 'annual')   return n / 12;
  if (period === 'one_time') return 0; // não recorrente
  return n;
}

// Converte qualquer período para valor anual estimado
function toAnnual(amount, period) {
  const n = parseFloat(amount);
  if (period === 'daily')    return n * 365;
  if (period === 'monthly')  return n * 12;
  if (period === 'annual')   return n;
  if (period === 'one_time') return n;
  return n;
}

function fmt(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CategoryCard({ meta, entries }) {
  const monthlyTotal = entries.reduce((s, e) => s + toMonthly(e.amountUsd, e.period), 0);
  const Icon = meta.icon;
  return (
    <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-5 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${meta.color}`} />
        <span className={`text-xs font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
        <span className="ml-auto text-xs text-gray-500">{entries.length} item{entries.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-xl font-black text-white">{fmt(monthlyTotal)}<span className="text-xs text-gray-500 font-normal ml-1">/mês</span></p>
    </div>
  );
}

function EntryRow({ entry }) {
  const meta = CATEGORY_META[entry.category] || CATEGORY_META.misc;
  const Icon = meta.icon;
  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 flex items-center justify-center rounded-lg ${meta.bg}`}>
            <Icon className={`w-3 h-3 ${meta.color}`} />
          </span>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{entry.name}</p>
            {entry.description && <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{entry.description}</p>}
          </div>
        </div>
      </td>
      <td className="py-3 pr-4 hidden sm:table-cell">
        {entry.provider ? (
          entry.providerUrl
            ? <a href={entry.providerUrl} target="_blank" rel="noopener noreferrer" className={`text-xs font-semibold ${meta.color} hover:underline flex items-center gap-1`}>
                {entry.provider} <ExternalLink className="w-3 h-3 inline" />
              </a>
            : <span className={`text-xs font-semibold ${meta.color}`}>{entry.provider}</span>
        ) : <span className="text-xs text-gray-600">—</span>}
      </td>
      <td className="py-3 pr-4 text-right">
        <span className="text-sm font-black text-white">{fmt(entry.amountUsd)}</span>
        <span className="text-[11px] text-gray-500 ml-1">/{PERIOD_LABEL[entry.period]?.toLowerCase() || entry.period}</span>
      </td>
      <td className="py-3 text-right">
        {entry.isPaid
          ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 className="w-3 h-3" /> Pago
            </span>
          : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              <Clock className="w-3 h-3" /> Pendente
            </span>}
      </td>
    </tr>
  );
}

export default function Transparency() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch('/api/transparency')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setEntries(d.entries);
        else setErr('Não foi possível carregar os dados.');
      })
      .catch(() => setErr('Erro de conexão.'))
      .finally(() => setLoading(false));
  }, []);

  // Totais globais (apenas entradas ativas, que já vêm filtradas)
  const recurringEntries = entries.filter(e => e.period !== 'one_time');
  const oneTimeEntries   = entries.filter(e => e.period === 'one_time');

  const totalMonthly = recurringEntries.reduce((s, e) => s + toMonthly(e.amountUsd, e.period), 0);
  const totalAnnual  = recurringEntries.reduce((s, e) => s + toAnnual(e.amountUsd, e.period), 0)
                     + oneTimeEntries.reduce((s, e) => s + parseFloat(e.amountUsd), 0);
  const paidup       = entries.filter(e => e.isPaid).length;
  const pending      = entries.filter(e => !e.isPaid).length;

  // Agrupar por categoria
  const byCategory = {};
  for (const e of entries) {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e);
  }
  const categoryOrder = ['infrastructure', 'tooling', 'marketing', 'payroll', 'legal', 'misc'];

  const lastUpdated = entries.length > 0
    ? new Date(Math.max(...entries.map(e => new Date(e.updatedAt)))).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Eye className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Portal de Transparência</h1>
          </div>
          <p className="text-sm text-gray-400 max-w-xl">
            Aqui você encontra todos os custos operacionais do BlockMiner — infraestrutura, ferramentas, marketing e mais.
            Nossa missão é ser 100% transparente com a comunidade.
          </p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
            <RefreshCw className="w-3 h-3" />
            Atualizado em {lastUpdated}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {err && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-400 text-sm">{err}</div>
      )}

      {!loading && !err && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest mb-1">
                <DollarSign className="w-3 h-3 text-primary" /> Custo Mensal
              </div>
              <p className="text-2xl font-black text-white">{fmt(totalMonthly)}</p>
              <p className="text-[11px] text-gray-600">Despesas recorrentes/mês</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest mb-1">
                <TrendingUp className="w-3 h-3 text-amber-400" /> Custo Anual (est.)
              </div>
              <p className="text-2xl font-black text-white">{fmt(totalAnnual)}</p>
              <p className="text-[11px] text-gray-600">Inclui gastos únicos</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest mb-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Em dia
              </div>
              <p className="text-2xl font-black text-white">{paidup}</p>
              <p className="text-[11px] text-gray-600">Itens pagos</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest mb-1">
                <Clock className="w-3 h-3 text-amber-400" /> Pendentes
              </div>
              <p className="text-2xl font-black text-white">{pending}</p>
              <p className="text-[11px] text-gray-600">Pagamentos futuros</p>
            </div>
          </div>

          {/* Category breakdown */}
          {Object.keys(byCategory).length > 0 && (
            <div>
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Breakdown por Categoria
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categoryOrder
                  .filter(c => byCategory[c])
                  .map(c => (
                    <CategoryCard key={c} meta={CATEGORY_META[c] || CATEGORY_META.misc} entries={byCategory[c]} />
                  ))}
              </div>
            </div>
          )}

          {/* Full table */}
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/2 p-10 text-center text-gray-500 text-sm">
              Nenhuma entrada publicada ainda.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Detalhamento Completo</h2>
              </div>
              {categoryOrder.filter(c => byCategory[c]).map(cat => {
                const meta = CATEGORY_META[cat] || CATEGORY_META.misc;
                const Icon = meta.icon;
                return (
                  <div key={cat}>
                    <div className={`px-6 py-2 flex items-center gap-2 ${meta.bg} border-b border-white/5`}>
                      <Icon className={`w-3 h-3 ${meta.color}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                    </div>
                    <table className="w-full">
                      <tbody>
                        {byCategory[cat].map(e => <EntryRow key={e.id} entry={e} />)}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[11px] text-gray-600 text-center pb-4">
            Valores em USD. Conversões de período são estimativas. As informações são atualizadas manualmente pela equipe BlockMiner.
          </p>
        </>
      )}
    </div>
  );
}
