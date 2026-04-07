import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import AdminLogin from './pages/AdminLogin';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminMiners from './pages/AdminMiners';
import AdminUsers from './pages/AdminUsers';
import AdminLogs from './pages/AdminLogs';
import AdminMetrics from './pages/AdminMetrics';
import AdminOfferEvents from './pages/AdminOfferEvents';
import AdminOfferEventManage from './pages/AdminOfferEventManage';
import AdminSupport from './pages/AdminSupport';
import AdminDepositTickets from './pages/AdminDepositTickets';
import AdminBanners from './pages/AdminBanners';
import AdminCreators from './pages/AdminCreators';
import AdminTransparency from './pages/AdminTransparency';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminBroadcast from './pages/AdminBroadcast';

function App() {
  return (
    <BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors={false}
        expand={true}
        toastOptions={{
          className: 'bg-slate-950/80 backdrop-blur-md border border-white/5 rounded-xl text-white font-mono text-[10px] uppercase tracking-widest p-4 shadow-2xl',
          style: {
            background: 'rgba(2, 6, 23, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            color: '#fff',
          },
          classNames: {
            error: 'border-red-500/30 !text-red-400',
            success: 'border-emerald-500/30 !text-emerald-400',
            warning: 'border-orange-500/30 !text-orange-400',
            info: 'border-blue-500/30 !text-blue-400',
          },
        }}
      />
      <Routes>
        {/* Redireciona raiz direto para login admin */}
        <Route path="/" element={<Navigate to="/admin/login" replace />} />

        {/* Login do admin */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Painel admin protegido */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/miners" element={<AdminMiners />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/admin/metrics" element={<AdminMetrics />} />
          <Route path="/admin/offer-events" element={<AdminOfferEvents />} />
          <Route path="/admin/offer-events/:id" element={<AdminOfferEventManage />} />
          <Route path="/admin/support" element={<AdminSupport />} />
          <Route path="/admin/deposit-tickets" element={<AdminDepositTickets />} />
          <Route path="/admin/banners" element={<AdminBanners />} />
          <Route path="/admin/creators" element={<AdminCreators />} />
          <Route path="/admin/transparency" element={<AdminTransparency />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/broadcast" element={<AdminBroadcast />} />
        </Route>

        {/* Qualquer rota desconhecida vai pro login */}
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
