// User Management Data Types and Sample Data

export type UserRole = 'admin' | 'staff';
export type UserStatus = 'active' | 'inactive';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
  mustChangePassword: boolean;
  profileImage?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
}

// Sample users data
export const sampleUsers: User[] = [
  {
    id: '1',
    fullName: 'Rajesh Kumar Singh',
    email: 'rajesh.singh@spicemaster.com',
    phone: '+91 98765 43210',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-15',
    lastLogin: '2024-12-28',
    mustChangePassword: false,
  },
  {
    id: 'USR002',
    fullName: 'Priya Sharma',
    email: 'priya.sharma@spicemaster.com',
    phone: '+91 98765 43211',
    role: 'staff',
    status: 'active',
    createdAt: '2024-03-20',
    lastLogin: '2024-12-27',
    mustChangePassword: false,
  },
  {
    id: 'USR003',
    fullName: 'Amit Patel',
    email: 'amit.patel@spicemaster.com',
    phone: '+91 98765 43212',
    role: 'staff',
    status: 'active',
    createdAt: '2024-06-10',
    lastLogin: '2024-12-28',
    mustChangePassword: false,
  },
  {
    id: 'USR004',
    fullName: 'Sunita Devi',
    email: 'sunita.devi@spicemaster.com',
    phone: '+91 98765 43213',
    role: 'staff',
    status: 'inactive',
    createdAt: '2024-02-05',
    lastLogin: '2024-10-15',
    mustChangePassword: true,
  },
  {
    id: 'USR005',
    fullName: 'Vikram Reddy',
    email: 'vikram.reddy@spicemaster.com',
    phone: '+91 98765 43214',
    role: 'admin',
    status: 'active',
    createdAt: '2024-04-12',
    lastLogin: '2024-12-26',
    mustChangePassword: false,
  },
];

// Current session state (simulated)
let currentAuthState: AuthState = {
  isAuthenticated: false,
  currentUser: null,
};

// Auth functions
export const login = (email: string, password: string): { success: boolean; user?: User; error?: string } => {
  const user = sampleUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }
  
  if (user.status === 'inactive') {
    return { success: false, error: 'Your account has been disabled. Please contact admin.' };
  }
  
  // Simulate password check (in real app, this would be backend validation)
  if (password.length < 6) {
    return { success: false, error: 'Invalid email or password' };
  }
  
  currentAuthState = {
    isAuthenticated: true,
    currentUser: user,
  };
  
  return { success: true, user };
};

export const logout = (): void => {
  currentAuthState = {
    isAuthenticated: false,
    currentUser: null,
  };
};

export const getCurrentUser = (): User | null => {
  return currentAuthState.currentUser;
};

export const isAuthenticated = (): boolean => {
  return currentAuthState.isAuthenticated;
};

export const isAdmin = (): boolean => {
  return currentAuthState.currentUser?.role === 'admin';
};

export const setCurrentUser = (user: User | null): void => {
  if (user) {
    currentAuthState = {
      isAuthenticated: true,
      currentUser: user,
    };
  } else {
    currentAuthState = {
      isAuthenticated: false,
      currentUser: null,
    };
  }
};

// User management functions
export const getUserById = (id: string): User | undefined => {
  return sampleUsers.find(u => u.id === id);
};

export const getAllUsers = (): User[] => {
  return sampleUsers;
};

export const getActiveUsers = (): User[] => {
  return sampleUsers.filter(u => u.status === 'active');
};

export const getUsersByRole = (role: UserRole): User[] => {
  return sampleUsers.filter(u => u.role === role);
};

export const generateUserId = (): string => {
  const maxId = Math.max(...sampleUsers.map(u => parseInt(u.id.replace('USR', ''))));
  return `USR${String(maxId + 1).padStart(3, '0')}`;
};

export const getRoleDisplayName = (role: UserRole): string => {
  return role === 'admin' ? 'Administrator' : 'Staff Member';
};

export const getStatusColor = (status: UserStatus): string => {
  return status === 'active' ? 'text-success' : 'text-muted-foreground';
};

export const getStatusBadgeClass = (status: UserStatus): string => {
  return status === 'active' ? 'status-active' : 'status-inactive';
};
