import React from 'react';
import { Navigate } from 'react-router-dom';
import useMobile from '../hooks/useMobile';

interface DeviceGuardProps {
  children: React.ReactNode;
  requireDesktop?: boolean;
}

const DeviceGuard: React.FC<DeviceGuardProps> = ({ children, requireDesktop = false }) => {
  const isMobile = useMobile();

  if (requireDesktop && isMobile) {
    return <Navigate to="/employee" replace />;
  }

  return <>{children}</>;
};

export default DeviceGuard;