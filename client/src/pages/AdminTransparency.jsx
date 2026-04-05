import { useEffect, useState } from 'react';
import {
  Eye,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Server,
  Wrench,
  Megaphone,
  Briefcase,
  Scale,
  Package,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'infrastructure', label: 'Infraestrutura', icon: Server },
  { value: 'tooling',        label: 'Ferramentas',    icon: Wrench },
  { value: 'marketing',     label: 'Marketing',       icon: Megaphone },
  { value: 'payroll',       label: 'Equipe',          icon: Briefcase },
  { value: 'legal',         label: 'Jurídico',        icon: Scale },
  { value: 'misc',          label: 'Outros',          icon: Package },
];

const PERIODS = [
  { value: 'monthly',  label: 'Mensal' },
  { value: 'annual',   label: 'Anual' },
  { value: 'daily',    label: 'Diário' },
  { value: 'one_time', label: 'Único' },
];

const EMPTY_FORM = {
  category: 'infrastructure',
  name: '',
  description: '',
  provider: '',
  providerUrl: '',
  amountUsd: '',
  period: 'monthly',
  isPaid: true,
  isActive: true,
  notes: '',
  sortOrder: 0,
};

function fmt(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCatLabel(v) {
  return CATEGORIES.find(c => c.value === v)?.label || v;
}

function getPeriodLabel(v) {
  return PERIODS.find(p => p.value === v)?.label || v;
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "bg-slate-800/60 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/40 transition-colors";

export default function AdminTransparency() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const adminToken = localStorage.getItem('adminToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/transparency', { headers });
      const d = await r.json();
      if (d.ok) setEntries(d.entries);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(entry) {
    setEditId(entry.id);
    setForm({
      category:    entry.category,
      name:       entry.name,
      description: entry.description || '',
      provider:   entry.provider || '',
      providerUrl: entry.providerUrl || '',
      amountUsd:  String(entry.amountUsd),
      period:     entry.period,
      isPaid:     entry.isPaid,
      isActive:   entry.isActive,
      notes:      entry.notes || '',
      sortOrder:  entry.sortOrder,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Nome é obrigatório.');
    if (!form.amountUsd || isNaN(parseFloat(form.amountUsd))) return toast.error('Valor inválido.');
    setSaving(true);
    try {
      const url   = editId ? `/api/admin/transparency/${editId}` : '/api/admin/transparency';
      const method = editId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers, body: JSON.stringify({ ...form, amountUsd: parseFloat(form.amountUsd) }) });
      const d = await r.json();
      if (d.ok) {
        toast.success(editId ? 'Entrada atualizada.' : 'Entrada criada.');
        setShowForm(false);
        load();
      } else {
        toast.error(d.message || 'Erro ao salvar.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(entry) {
    const r = await fetch(`/api/admin/transparency/${entry.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ isActive: !entry.isActive }),
    });
    const d = await r.json();
    if (d.ok) load();
    else toast.error(d.message || 'Erro.');
  }

  async function handleDelete(id) {
    const r = await fetch(`/api/admin/transparency/${id}`, { method: 'DELETE', headers });
    const d = await r.json();
    if (d.ok) { toast.success('Entrada removida.'); setConfirmDelete(null); load(); }
    else toast.error(d.message || 'Erro.');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-tight">Portal de Transparência</h1>
            <p className="text-xs text-gray-500">{entries.length} entra{entries.length === 1 ? 'da' : 'das'} cadastrada{entries.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Entrada
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border border-primary/20 bg-primary/3 p-6 space-y-4">
          <h2 className="text-xs font-black text-primary uppercase tracking-widest mb-2">
            {editId ? 'Editar Entrada' : 'Nova Entrada'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Categoria">
              <select className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Nome *">
              <input className={inputCls} placeholder="ex: VPS Hetzner" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Valor (USD) *">
              <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={form.amountUsd} onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))} />
            </Field>
            <Field label="Período">
              <select className={inputCls} value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Fornecedor">
              <input className={inputCls} placeholder="ex: Hetzner Cloud" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
            </Field>
            <Field label="URL do Fornecedor">
              <input className={inputCls} placeholder="https://..." value={form.providerUrl} onChange={e => setForm(f => ({ ...f, providerUrl: e.target.value }))} />
            </Field>
            <Field label="Descrição">
              <input className={inputCls} placeholder="Descrição curta" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label="Notas internas">
              <input className={inputCls} placeholder="Notas (não exibidas publicamente)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
            <Field label="Ordem">
              <input className={inputCls} type="number" min="0" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
            </Field>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-primary" checked={form.isPaid} onChange={e => setForm(f => ({ ...f, isPaid: e.target.checked }))} />
              <span className="text-xs text-gray-400">Pago</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-primary" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <span className="text-xs text-gray-400">Visível publicamente</span>
            </label>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-primary/20 border border-primary/30 hover:bg-primary/30 text-primary rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/8 hover:bg-white/10 text-gray-400 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/2 p-10 text-center text-gray-500 text-sm">Nenhuma entrada cadastrada.</div>
      ) : (
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/2">
                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome / Categoria</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest hidden md:table-cell">Fornecedor</th>
                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Valor / Período</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest hidden sm:table-cell">Pago</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest">Público</th>
                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${!entry.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-white">{entry.name}</p>
                    <p className="text-[11px] text-gray-500">{getCatLabel(entry.category)}{entry.description ? ` — ${entry.description}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {entry.provider ? (
                      entry.providerUrl
                        ? <a href={entry.providerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            {entry.provider} <ExternalLink className="w-3 h-3" />
                          </a>
                        : <span className="text-xs text-gray-400">{entry.provider}</span>
                    ) : <span className="text-xs text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-black text-white text-sm">{fmt(entry.amountUsd)}</span>
                    <span className="text-[11px] text-gray-500 ml-1">/{getPeriodLabel(entry.period).toLowerCase()}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`text-[11px] font-bold ${entry.isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {entry.isPaid ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleActive(entry)} title={entry.isActive ? 'Ocultar' : 'Publicar'}>
                      {entry.isActive
                        ? <ToggleRight className="w-5 h-5 text-emerald-400 mx-auto" />
                        : <ToggleLeft className="w-5 h-5 text-gray-600 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(entry)} title="Editar" className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {confirmDelete === entry.id ? (
                        <>
                          <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(entry.id)} title="Excluir" className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
