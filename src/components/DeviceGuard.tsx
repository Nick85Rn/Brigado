import React from 'react';
import { Navigate } from 'react-router-dom';
import useMobile from '../hooks/useMobile';

interface DeviceGuardProps {
  children: React.ReactNode;
  requireDesktop?: boolean; // Se true, solo desktop può vedere
}

const DeviceGuard: React.FC<DeviceGuardProps> = ({ children, requireDesktop = false }) => {
  const isMobile = useMobile();

  // SE la pagina richiede Desktop (es. Planning) E l'utente è su Mobile...
  if (requireDesktop && isMobile) {
    // ...Reindirizza forzatamente alla dashboard dipendente
    return <Navigate to="/employee" replace />;
  }

  // Altrimenti mostra il contenuto
  return <>{children}</>;
};

export default DeviceGuard;