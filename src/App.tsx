import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// --- UTILITIES ---
// Importiamo il componente "Buttafuori" per gestire i dispositivi
// (Assicurati di aver creato il file src/components/DeviceGuard.tsx come concordato)
import DeviceGuard from './components/DeviceGuard';

// --- COMPONENTI ADMIN (Desktop/Tablet) ---
import LoginPage from './components/LoginPage';
import WeeklyScheduler from './components/WeeklyScheduler';
import CostDashboard from './components/CostDashboard';
import AdminRequestsPanel from './components/AdminRequestsPanel';
import SettingsPage from './components/SettingsPage';
import LeavesPage from './components/LeavesPage';

// --- COMPONENTI DIPENDENTE (Mobile First) ---
import EmployeeDashboard from './components/EmployeeDashboard';

// --- STILI ---
import './App.css';

const App: React.FC = () => {
  return (
    <Routes>
      {/* -----------------------------------------------------------------------
        AREA PUBBLICA
        -----------------------------------------------------------------------
      */}
      <Route path="/login" element={<LoginPage />} />

      {/* -----------------------------------------------------------------------
        AREA ADMIN (Planning & Gestione)
        Queste rotte sono accessibili SOLO da Desktop/Tablet.
        Se un utente Mobile prova ad accedere, DeviceGuard lo reindirizza a /employee.
        -----------------------------------------------------------------------
      */}
      <Route 
        path="/" 
        element={
          <DeviceGuard requireDesktop={true}>
            <WeeklyScheduler />
          </DeviceGuard>
        } 
      />

      <Route 
        path="/costs" 
        element={
          <DeviceGuard requireDesktop={true}>
            <CostDashboard />
          </DeviceGuard>
        } 
      />

      <Route 
        path="/requests" 
        element={
          <DeviceGuard requireDesktop={true}>
            <AdminRequestsPanel />
          </DeviceGuard>
        } 
      />

      <Route 
        path="/leaves" 
        element={
          <DeviceGuard requireDesktop={true}>
            <LeavesPage />
          </DeviceGuard>
        } 
      />

      <Route 
        path="/settings" 
        element={
          <DeviceGuard requireDesktop={true}>
            <SettingsPage />
          </DeviceGuard>
        } 
      />

      {/* -----------------------------------------------------------------------
        AREA DIPENDENTE (Mobile Experience)
        Questa è la dashboard semplificata per chi consulta i turni da smartphone.
        -----------------------------------------------------------------------
      */}
      <Route path="/employee" element={<EmployeeDashboard />} />

      {/* -----------------------------------------------------------------------
        CATCH-ALL (Gestione 404)
        Qualsiasi rotta non riconosciuta riporta alla Home ("/").
        Da lì, il DeviceGuard smisterà di nuovo l'utente (Mobile -> Employee, Desktop -> Admin).
        -----------------------------------------------------------------------
      */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;