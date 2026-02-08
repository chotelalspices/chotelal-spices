import { UserRole } from './role-permissions'
import { hasPermission, getAccessibleModules } from './role-permissions'

// Utility functions for authentication

export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const storedUser = localStorage.getItem('authUser');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error('Error parsing stored user:', error);
    return null;
  }
};

export const getStoredUserRoles = (): UserRole[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const storedRoles = localStorage.getItem('userRoles');
    return storedRoles ? JSON.parse(storedRoles) : [];
  } catch (error) {
    console.error('Error parsing stored user roles:', error);
    return [];
  }
};

export const getStoredUserRole = (): 'admin' | 'staff' => {
  // Legacy function - returns first role or defaults to admin
  const roles = getStoredUserRoles();
  return (roles[0] as 'admin' | 'staff') || 'admin';
};

export const getStoredUserEmail = (): string => {
  if (typeof window === 'undefined') return '';
  
  const user = getStoredUser();
  return user?.email || '';
};

export const getStoredUserName = (): string => {
  if (typeof window === 'undefined') return '';
  
  const user = getStoredUser();
  return user?.fullName || '';
};

export const getStoredUserId = (): string => {
  if (typeof window === 'undefined') return '';
  
  const user = getStoredUser();
  return user?.id || '';
};

export const isUserAdmin = (): boolean => {
  const roles = getStoredUserRoles();
  return roles.includes('admin');
};

export const hasModuleAccess = (module: string): boolean => {
  const roles = getStoredUserRoles();
  return hasPermission(roles, module as any);
};

export const getAccessibleModuleList = (): string[] => {
  const roles = getStoredUserRoles();
  return getAccessibleModules(roles);
};

export const isUserStaff = (): boolean => {
  // Legacy function - staff role no longer exists
  return false;
};

export const clearStoredUser = () => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('authUser');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userRoles');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('userId');
};
