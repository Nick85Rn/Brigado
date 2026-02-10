import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Guards
import DeviceGuard from './components/DeviceGuard';
import RequireAuth from './components/RequireAuth'; // <--- NUOVO IMPORT

// Pages
import LoginPage from './components/LoginPage';
import WeeklyScheduler from './components/WeeklyScheduler';
import CostDashboard from './components/CostDashboard';
import AdminRequestsPanel from './components/AdminRequestsPanel';
import SettingsPage from './components/SettingsPage';
import LeavesPage from './components/LeavesPage';
import EmployeeDashboard from './components/EmployeeDashboard';

import './App.css';

const App: React.FC = () => {
  return (
    <Routes>
      {/* --- PAGINA PUBBLICA --- */}
      <Route path="/login" element={<LoginPage />} />

      {/* --- ROTTE ADMIN (Desktop + Loggato) --- */}
      {/* Nota: Raggruppiamo le rotte per evitare di ripetere i wrapper mille volte */}
      <Route element={
        <DeviceGuard requireDesktop={true}>
          <RequireAuth> {/* <-- Qui scatta il controllo Login */}
             {/* Qui va inserito un Outlet se usassimo Layout, ma per ora avvolgiamo singolarmente o usiamo un wrapper comune */}
          </RequireAuth>
        </DeviceGuard>
      }>
        {/* Purtroppo React Router v6 semplice richiede nesting esplicito o wrapper ripetuti se non si usa Outlet. 
            Per chiarezza massima e sicurezza, avvolgo singolarmente ogni rotta critica qui sotto. */}
      </Route>

      <Route 
        path="/" 
        element={
          <DeviceGuard requireDesktop={true}>
            <RequireAuth>
              <WeeklyScheduler />
            </RequireAuth>
          </DeviceGuard>
        } 
      />

      <Route 
        path="/costs" 
        element={
          <DeviceGuard requireDesktop={true}>
            <RequireAuth>
              <CostDashboard />
            </RequireAuth>
          </DeviceGuard>
        } 
      />

      <Route 
        path="/requests" 
        element={
          <DeviceGuard requireDesktop={true}>
            <RequireAuth>
              <AdminRequestsPanel isOpen={true} onClose={() => {}} />
            </RequireAuth>
          </DeviceGuard>
        } 
      />

      <Route 
        path="/leaves" 
        element={
          <DeviceGuard requireDesktop={true}>
            <RequireAuth>
              <LeavesPage />
            </RequireAuth>
          </DeviceGuard>
        } 
      />

      <Route 
        path="/settings" 
        element={
          <DeviceGuard requireDesktop={true}>
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          </DeviceGuard>
        } 
      />

      {/* --- ROTTA DIPENDENTE (Mobile + Loggato) --- */}
      <Route 
        path="/employee" 
        element={
          <RequireAuth> {/* Anche il dipendente deve essere loggato! */}
            <EmployeeDashboard />
          </RequireAuth>
        } 
      />

      {/* --- CATCH ALL --- */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;