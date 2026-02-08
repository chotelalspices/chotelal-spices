'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Key,
  UserX,
  UserCheck,
  Filter,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

type UserRole = 'admin' | 'production' | 'packaging' | 'sales' | 'research';
type UserStatus = 'active' | 'inactive';

interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: UserRole[];
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
  mustChangePassword: boolean;
}

export default function UserListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, isAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data: User[] = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/dashboard');
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access the User Management page.',
        variant: 'destructive',
      });
    }
  }, [isAdmin, isLoading, router, toast]);

  // Show loading or redirect state
  if (isLoading || !isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as any);
    const matchesStatus =
      statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleToggleStatus = async (user: any) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: user.fullName,
          phone: user.phone,
          roles: user.roles,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user status');
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, status: newStatus } : u
        )
      );

      toast({
        title: `User ${newStatus === 'active' ? 'Enabled' : 'Disabled'}`,
        description: `${user.fullName} has been ${newStatus === 'active' ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  const getRoleDisplayNames = (roles: string[]): string => {
    if (roles.includes('admin')) return 'Administrator';
    if (roles.length === 1) return roles[0].charAt(0).toUpperCase() + roles[0].slice(1);
    return roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ');
  };

  const getStatusBadgeClass = (status: UserStatus): string => {
    return status === 'active' ? 'status-active' : 'status-inactive';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-3">
              <Users className="h-7 w-7 text-primary" />
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage system users and permissions
            </p>
          </div>
          <Button onClick={() => router.push('/users/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Filters */}
        <div className="industrial-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-3">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block industrial-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Full Name</TableHead>
                <TableHead>Email / Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.fullName}
                  </TableCell>

                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-sm">{user.email}</p>
                      {user.phone && (
                        <p className="text-xs text-muted-foreground">
                          {user.phone}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        (user as any).roles?.includes('admin') ? 'default' : 'secondary'
                      }
                    >
                      {getRoleDisplayNames((user as any).roles || [])}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <span
                      className={`status-badge ${
                        user.status === 'active'
                          ? 'status-active'
                          : 'status-inactive'
                      }`}
                    >
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {user.lastLogin
                      ? new Intl.DateTimeFormat('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(user.lastLogin))
                      : 'Never'}
                  </TableCell>

                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/users/${user.id}/edit`)
                          }
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(user)}
                          className={
                            user.status === 'active'
                              ? 'text-destructive'
                              : 'text-success'
                          }
                        >
                          {user.status === 'active' ? (
                            <>
                              <UserX className="h-4 w-4 mr-2" />
                              Disable User
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Enable User
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No users found matching your criteria
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {filteredUsers.map((user) => (
            <div key={user.id} className="mobile-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-medium text-primary">
                      {user.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/users/${user.id}/edit`)
                      }
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit User
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => handleToggleStatus(user)}
                      className={
                        user.status === 'active'
                          ? 'text-destructive'
                          : 'text-success'
                      }
                    >
                      {user.status === 'active'
                        ? 'Disable User'
                        : 'Enable User'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    (user as any).roles?.includes('admin') ? 'default' : 'secondary'
                  }
                  className="text-xs"
                >
                  {getRoleDisplayNames((user as any).roles || [])}
                </Badge>

                <span
                  className={`status-badge text-xs ${
                    user.status === 'active'
                      ? 'status-active'
                      : 'status-inactive'
                  }`}
                >
                  {user.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
