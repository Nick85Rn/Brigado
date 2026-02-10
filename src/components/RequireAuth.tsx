import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface RequireAuthProps {
  children: React.ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Controllo basato sul tuo sistema attuale (localStorage)
    const userStr = localStorage.getItem('brigade_user');
    if (userStr) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  if (isAuthenticated === null) {
    return null; // O uno spinner di caricamento
  }

  if (!isAuthenticated) {
    // Se non sei loggato, vai al login salvando la provenienza
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;