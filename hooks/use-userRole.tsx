'use client';

import { useAuth } from './use-auth';

type UserRole = 'admin' | 'production' | 'packaging' | 'sales' | 'research';

export const useUserRole = () => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const roles = user?.roles || [];

  const hasRole = (role: UserRole) => {
    return roles.includes(role);
  };

  const hasAnyRole = (roleList: UserRole[]) => {
    return roleList.some(role => roles.includes(role));
  };

  const updateRoles = (newRoles: UserRole[]) => {
    // This would typically be handled by updating the user in the database
    // and then refreshing the session, but for now we'll update localStorage
    if (user) {
      const updatedUser = { ...user, roles: newRoles };
      localStorage.setItem('authUser', JSON.stringify(updatedUser));
      localStorage.setItem('userRoles', JSON.stringify(newRoles));
    }
  };

  return { 
    roles,
    hasRole,
    hasAnyRole,
    updateRoles,
    isLoading, 
    isAuthenticated,
    isAdmin: hasRole('admin'),
    isProduction: hasRole('production'),
    isPackaging: hasRole('packaging'),
    isSales: hasRole('sales'),
    isResearch: hasRole('research'),
  };
};
