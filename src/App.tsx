import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// GUARDS
import DeviceGuard from './components/DeviceGuard';
import RequireAuth from './components/RequireAuth';

// PAGES
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

      {/* 2. AREA ADMIN (Desktop + Loggato) */}
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

      {/* 3. AREA DIPENDENTE (Mobile/Desktop + Loggato) */}
      <Route path="/employee" element={
        <RequireAuth>
          <EmployeeDashboard />
        </RequireAuth>
      } />

      {/* 4. CATCH ALL - FIX LOOP */}
      {/* Se la rotta non esiste, manda al login che saprà dove smistare l'utente */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;