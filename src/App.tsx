import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Componenti di Utilità
// Assicurati di aver creato questo componente come discusso nello step precedente
import DeviceGuard from './components/DeviceGuard';

// Componenti Pagine (Admin & Auth)
import LoginPage from './components/LoginPage';
import WeeklyScheduler from './components/WeeklyScheduler';
import CostDashboard from './components/CostDashboard';
import AdminRequestsPanel from './components/AdminRequestsPanel';
import SettingsPage from './components/SettingsPage';
import LeavesPage from './components/LeavesPage';

// Componenti Pagine (Dipendente)
import EmployeeDashboard from './components/EmployeeDashboard';

// Stili globali
import './App.css';

const App: React.FC = () => {
  return (
    <Routes>
      {/* -----------------------------------------------------
          ROTTA PUBBLICA (Login)
      ------------------------------------------------------ */}
      <Route path="/login" element={<LoginPage />} />

      {/* -----------------------------------------------------
          ROTTE ADMIN (Protette da Mobile)
          Se un mobile accede qui, viene reindirizzato a /employee
      ------------------------------------------------------ */}
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

      {/* -----------------------------------------------------
          ROTTA DIPENDENTE (Mobile First)
          Questa è la "Home" per chi accede da smartphone.
      ------------------------------------------------------ */}
      <Route path="/employee" element={<EmployeeDashboard />} />

      {/* -----------------------------------------------------
          FALLBACK / 404
          Reindirizza alla home (che poi lo smisterà in base al device)
      ------------------------------------------------------ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;