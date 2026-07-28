import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07101f] text-white flex items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading account</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
