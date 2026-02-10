import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// --- GUARDS (I file che hai appena creato) ---
import DeviceGuard from './components/DeviceGuard';
import RequireAuth from './components/RequireAuth';

// --- PAGINE ---
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
      {/* 1. LOGIN (Pubblico) */}
      <Route path="/login" element={<LoginPage />} />

      {/* 2. AREA ADMIN (Desktop + Auth) */}
      {/* Avvolgiamo ogni rotta admin con DeviceGuard (solo PC) e RequireAuth (solo loggati) */}
      
      <Route path="/" element={
        <DeviceGuard requireDesktop={true}>
          <RequireAuth>
            <WeeklyScheduler />
          </RequireAuth>
        </DeviceGuard>
      } />

      <Route path="/costs" element={
        <DeviceGuard requireDesktop={true}>
          <RequireAuth>
            <CostDashboard />
          </RequireAuth>
        </DeviceGuard>
      } />

      <Route path="/requests" element={
        <DeviceGuard requireDesktop={true}>
          <RequireAuth>
            <AdminRequestsPanel isOpen={true} onClose={() => {}} />
          </RequireAuth>
        </DeviceGuard>
      } />

      <Route path="/leaves" element={
        <DeviceGuard requireDesktop={true}>
          <RequireAuth>
            <LeavesPage />
          </RequireAuth>
        </DeviceGuard>
      } />

      <Route path="/settings" element={
        <DeviceGuard requireDesktop={true}>
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        </DeviceGuard>
      } />

      {/* 3. AREA DIPENDENTE (Mobile/Desktop + Auth) */}
      <Route path="/employee" element={
        <RequireAuth>
          <EmployeeDashboard />
        </RequireAuth>
      } />

      {/* 4. CATCH ALL (Redirect intelligente) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;