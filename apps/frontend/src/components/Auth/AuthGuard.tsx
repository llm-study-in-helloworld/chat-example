import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../../api/authService';
import { useAuthStore } from '../../store/authStore';

const AuthGuard: React.FC = () => {
  const { isAuthenticated, token, user, setAuth } = useAuthStore();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // Verify token by getting the user profile
        const currentUser = await authService.getCurrentUser();
        
        // If we have a token but different user details, update them
        if (user?.id !== currentUser.id || user?.email !== currentUser.email) {
          setAuth(currentUser, token);
        }
        
        setIsValid(true);
      } catch (error) {
        // If token is invalid, logout
        useAuthStore.getState().logout();
      } finally {
        setIsLoading(false);
      }
    };

    validateAuth();
  }, [token, user, setAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isValid) {
    // Redirect to login page but save the location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated and token is valid, show protected route
  return <Outlet />;
};

export default AuthGuard; 