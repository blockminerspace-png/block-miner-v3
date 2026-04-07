import { useNavigate, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, 
    Users, 
    Cpu, 
    FileText, 
    Activity, 
    LogOut,
    ShieldAlert,
    Tag,
    MessageSquare,
    Ticket,
    Megaphone,
    Youtube,
    Eye,
    TrendingUp,
    Bell
} from 'lucide-react';
import { useAdminCtx } from './AdminLayout';

// minLevel: nivel MINIMO para ver o item (0 = só superadmin, 1 = full, 2 = todos)
const adminMenuItems = [
  { icon: LayoutDashboard, label: 'Resumo', path: '/admin/dashboard', minLevel: 2 },
  { icon: Users, label: 'Usuários', path: '/admin/users', minLevel: 2 },
  { icon: Cpu, label: 'Mineradoras', path: '/admin/miners', minLevel: 2 },
  { icon: Tag, label: 'Ofertas', path: '/admin/offer-events', minLevel: 2 },
  { icon: MessageSquare, label: 'Suporte', path: '/admin/support', minLevel: 2 },
  { icon: Megaphone, label: 'Banners', path: '/admin/banners', minLevel: 2 },
  { icon: Youtube, label: 'Criadores', path: '/admin/creators', minLevel: 2 },
  { icon: Ticket, label: 'Dep. Tickets', path: '/admin/deposit-tickets', minLevel: 2 },
  { icon: Bell, label: 'Notificacoes', path: '/admin/broadcast', minLevel: 2 },
  { icon: Eye, label: 'Transparência', path: '/admin/transparency', minLevel: 1 },
  { icon: Activity, label: 'Métricas', path: '/admin/metrics', minLevel: 1 },
  { icon: TrendingUp, label: 'Analytics', path: '/admin/analytics', minLevel: 1 },
  { icon: FileText, label: 'Logs', path: '/admin/logs', minLevel: 1 },
];

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminLevel } = useAdminCtx();

  const visibleItems = adminLevel === null ? [] : adminMenuItems.filter(item => adminLevel <= item.minLevel);

  const handleLogout = () => {
    navigate('/admin/login');
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 shrink-0 flex flex-col h-full shadow-2xl relative z-20">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
          <ShieldAlert className="text-white w-6 h-6" />
        </div>
        <span className="font-black text-xl tracking-tighter text-white uppercase">Admin<span className="text-amber-500">Panel</span></span>
      </div>

      <nav className="space-y-1 flex-1">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 mb-4">Gestão do Sistema</p>
        {visibleItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path + '/'));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-amber-500/10 text-amber-500 shadow-sm' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-amber-500' : 'group-hover:text-white'}`} />
              <span className="font-semibold text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all duration-300 group"
        >
          <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="font-bold text-xs uppercase tracking-widest">Encerrar Sessão</span>
        </button>
      </div>
    </aside>
  );
}
