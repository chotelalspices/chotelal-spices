'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  status: 'active' | 'inactive';
  mustChangePassword: boolean;
  lastLogin?: string;
  createdAt: string;
}

export const useAuth = () => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (session?.user) {
      const sessionRoles = (session.user as any).roles || [];
      console.log('Session roles:', sessionRoles);
      
      const authUser: AuthUser = {
        id: (session.user as any).id || '',
        fullName: (session.user as any).fullName || '',
        email: session.user.email || '',
        roles: sessionRoles,
        status: 'active', // Default status, can be updated from API if needed
        mustChangePassword: (session.user as any).mustChangePassword || false,
        lastLogin: (session.user as any).lastLogin,
        createdAt: (session.user as any).createdAt || new Date().toISOString(),
      };

      console.log('Created authUser:', authUser);

      // Store in localStorage
      localStorage.setItem('authUser', JSON.stringify(authUser));
      localStorage.setItem('userRoles', JSON.stringify(authUser.roles));
      localStorage.setItem('userRole', authUser.roles.length > 0 ? authUser.roles[0] : 'admin'); // Better fallback
      localStorage.setItem('userEmail', authUser.email);
      localStorage.setItem('userName', authUser.fullName);
      localStorage.setItem('userId', authUser.id);
      
      setUser(authUser);
    } else {
      // Clear localStorage on logout
      localStorage.removeItem('authUser');
      localStorage.removeItem('userRoles');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userId');
      
      setUser(null);
    }

    setIsLoading(false);
  }, [session, status]);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (status === 'loading') return;

    const storedUser = localStorage.getItem('authUser');
    console.log('Stored user from localStorage:', storedUser);
    
    if (storedUser && !session?.user) {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        console.log('Parsed user from localStorage:', parsedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        // Clear corrupted data
        localStorage.removeItem('authUser');
        localStorage.removeItem('userRoles');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
      }
    }
    setIsLoading(false);
  }, [status, session]);

  const isAdmin = user?.roles.includes('admin') || false;
  const isStaff = false; // Staff role no longer exists
  const isAuthenticated = !!user;
  
  console.log('Auth state:', { 
    userRoles: user?.roles, 
    isAdmin, 
    isStaff, 
    userEmail: user?.email 
  });

  const refreshUser = () => {
    // This can be called to refresh user data from localStorage
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing stored user:', error);
      }
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    isStaff,
    session,
    status,
    refreshUser,
  };
};
