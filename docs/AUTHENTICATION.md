# Authentication System Documentation

## Overview

This application uses NextAuth.js for authentication with a custom credentials provider. The system automatically updates user login timestamps and stores user information in localStorage for easy access throughout the application.

## Features

### 1. Automatic LastLogin Tracking
- When a user successfully logs in, the `lastLogin` field in the database is automatically updated
- This happens in the NextAuth authorize function in `app/api/auth/[...nextauth]/route.ts`

### 2. LocalStorage Integration
- User details are automatically stored in localStorage upon successful login
- Includes: user ID, name, email, role, and other profile information
- Provides offline access to user data throughout the application

### 3. Custom Hooks

#### `useAuth()` Hook
Location: `hooks/use-auth.ts`

```typescript
const { 
  user, 
  isLoading, 
  isAuthenticated, 
  isAdmin, 
  isStaff, 
  session, 
  status, 
  refreshUser 
} = useAuth();
```

**Features:**
- Automatically syncs with NextAuth session
- Stores/Retrieves user data from localStorage
- Provides convenient boolean flags for role checking
- Includes refresh functionality to update user data

#### `useUserRole()` Hook
Location: `hooks/use-userRole.tsx`

```typescript
const { 
  role, 
  updateRole, 
  isLoading, 
  isAuthenticated, 
  isAdmin, 
  isStaff 
} = useUserRole();
```

**Features:**
- Integrated with the main `useAuth` hook
- Provides role-based access control
- Legacy compatibility for existing components

#### `useLocalStorage()` Hook
Location: `hooks/use-localStorage.ts`

```typescript
const [value, setValue] = useLocalStorage('key', initialValue);
```

**Features:**
- Generic localStorage management
- Automatic JSON parsing/stringifying
- Cross-tab synchronization

### 4. Utility Functions

Location: `lib/auth-utils.ts`

```typescript
import { 
  getStoredUser, 
  getStoredUserRole, 
  isUserAdmin, 
  clearStoredUser 
} from '@/lib/auth-utils';
```

**Available Functions:**
- `getStoredUser()` - Get complete user object from localStorage
- `getStoredUserRole()` - Get user role ('admin' | 'staff')
- `getStoredUserEmail()` - Get user email
- `getStoredUserName()` - Get user full name
- `getStoredUserId()` - Get user ID
- `isUserAdmin()` - Check if user is admin
- `isUserStaff()` - Check if user is staff
- `clearStoredUser()` - Clear all user data from localStorage

## Data Stored in LocalStorage

The following keys are used:
- `authUser` - Complete user object (JSON string)
- `userRole` - User role ('admin' | 'staff')
- `userEmail` - User email address
- `userName` - User full name
- `userId` - User unique ID

## Usage Examples

### Checking User Authentication
```typescript
import { useAuth } from '@/hooks/use-auth';

function MyComponent() {
  const { isAuthenticated, user, isAdmin } = useAuth();
  
  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }
  
  if (isAdmin) {
    return <AdminPanel user={user} />;
  }
  
  return <UserPanel user={user} />;
}
```

### Direct Access to Stored Data
```typescript
import { getStoredUser, isUserAdmin } from '@/lib/auth-utils';

// Get user data without React hook
const user = getStoredUser();
const isAdmin = isUserAdmin();
```

### Role-Based Rendering
```typescript
import { useUserRole } from '@/hooks/use-userRole';

function Navigation() {
  const { isAdmin } = useUserRole();
  
  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      {isAdmin && <Link href="/users">User Management</Link>}
    </nav>
  );
}
```

## Security Considerations

1. **Password Hashing**: All passwords are hashed using bcrypt before storage
2. **Session Management**: NextAuth handles secure session tokens
3. **LocalStorage**: While convenient for UI state, sensitive operations always verify with the backend
4. **Role Validation**: All API endpoints verify user roles server-side

## Database Schema

The User model includes:
- `lastLogin` - Automatically updated on successful login
- `mustChangePassword` - Flag for password change requirements
- `role` - User role ('admin' | 'staff')
- `status` - Account status ('active' | 'inactive')

## API Integration

All user-related API endpoints:
- Require authentication via NextAuth session
- Update the `lastLogin` field automatically
- Return user data that syncs with localStorage
- Include proper role-based access control

## Migration Notes

If migrating from the old mock data system:
1. Replace `getUserById()` calls with API calls to `/api/users/[id]`
2. Replace `getCurrentUser()` with `useAuth()` hook
3. Replace `isAdmin()` checks with `useAuth().isAdmin`
4. Update components to use the new authentication hooks

The system maintains backward compatibility while providing enhanced functionality and better integration with the database.
