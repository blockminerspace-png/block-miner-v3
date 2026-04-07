import { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate, Outlet, Navigate } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import { api } from '../store/auth';

export const AdminContext = createContext({ adminLevel: null, adminEmail: null });
export const useAdminCtx = () => useContext(AdminContext);

export default function AdminLayout() {
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(null);
    const [adminLevel, setAdminLevel] = useState(null);
    const [adminEmail, setAdminEmail] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAdminAuth = async () => {
            try {
                const res = await api.get('/admin/auth/check');
                setIsAdminAuthenticated(res.data.ok);
                setAdminLevel(typeof res.data.level === 'number' ? res.data.level : 2);
                setAdminEmail(res.data.email ?? null);
            } catch (err) {
                setIsAdminAuthenticated(false);
            }
        };
        checkAdminAuth();
    }, []);

    if (isAdminAuthenticated === null) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (isAdminAuthenticated === false) {
        return <Navigate to="/admin/login" replace />;
    }

    return (
        <AdminContext.Provider value={{ adminLevel, adminEmail }}>
        <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans">
            <AdminSidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-20 bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50 flex items-center px-8 sticky top-0 z-10">
                    <div className="flex-1">
                        <h1 className="text-xl font-black text-white tracking-tight uppercase">Painel de Controle</h1>
                        <p className="text-[10px] text-amber-500/70 font-bold uppercase tracking-widest">Modo Administrador Ativo</p>
                    </div>
                    {adminLevel <= 1 && (
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${ adminLevel === 0 ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20' }`}>
                            { adminLevel === 0 ? '⬡ Super Admin' : '★ Admin Full' }
                        </span>
                    )}
                </header>
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
        </AdminContext.Provider>
    );
}
