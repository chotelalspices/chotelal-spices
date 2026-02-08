'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, User } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

import { UserRole } from '@/lib/role-permissions';
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

export default function AddEditUser() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const { toast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    tempPassword: '',
    roles: [] as UserRole[],
    status: 'active' as UserStatus,
  });

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page.',
        variant: 'destructive',
      });
    }
  }, [isAdmin, authLoading, router, toast]);

  useEffect(() => {
    if (isEditing && id) {
      fetchUser();
    }
  }, [id, isEditing]);

  // Show loading or redirect state
  if (authLoading || !isAdmin) {
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

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      const user: User = await response.json();
      setFormData({
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || '',
        tempPassword: '',
        roles: user.roles || [],
        status: user.status,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch user data',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate at least one role is selected
    if (formData.roles.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one role for the user.',
        variant: 'destructive',
      });
      return;
    }
    
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setShowConfirmDialog(false);

    try {
      const url = isEditing ? `/api/users/${id}` : '/api/users';
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = isEditing ? {
        fullName: formData.fullName,
        phone: formData.phone,
        roles: formData.roles,
        status: formData.status,
      } : {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        tempPassword: formData.tempPassword,
        roles: formData.roles,
        status: formData.status,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save user');
      }

      if (isEditing) {
        toast({
          title: 'User Updated',
          description: `${formData.fullName} has been updated successfully.`,
        });
      } else {
        toast({
          title: 'User Created',
          description: `${formData.fullName} has been added. A temporary password has been sent.`,
        });
      }

      router.push('/users');
    } catch (error) {
      console.error('Error saving user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save user',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: Math.random().toString(36).slice(-8), // Generate random temp password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }

      const result = await response.json();
      toast({
        title: 'Password Reset',
        description: result.message || `A new temporary password has been sent to ${formData.email}.`,
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/users')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">{isEditing ? 'Edit User' : 'Add New User'}</h1>
            <p className="text-muted-foreground">
              {isEditing
                ? 'Update user details and permissions'
                : 'Create a new system user'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Details
              </CardTitle>
              <CardDescription>
                {isEditing
                  ? 'Modify user information below'
                  : 'Enter the details for the new user'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="Enter full name"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@company.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  disabled={isEditing}
                />
                {isEditing && (
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed after creation
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>

              {/* Temporary Password */}
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="tempPassword">Temporary Password *</Label>
                  <Input
                    id="tempPassword"
                    type="password"
                    placeholder="Enter temporary password"
                    value={formData.tempPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        tempPassword: e.target.value,
                      }))
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    User will be required to change password on first login
                  </p>
                </div>
              )}

              {/* Roles */}
              <div className="space-y-3">
                <Label>Roles *</Label>
                <div className="space-y-2">
                  {(['admin', 'production', 'packaging', 'sales', 'research'] as UserRole[]).map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={role}
                        checked={formData.roles.includes(role)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData((prev) => ({
                              ...prev,
                              roles: [...prev.roles, role],
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              roles: prev.roles.filter((r) => r !== role),
                            }));
                          }
                        }}
                      />
                      <Label htmlFor={role} className="text-sm font-normal">
                        {role === 'admin' && 'Administrator'}
                        {role === 'production' && 'Production'}
                        {role === 'packaging' && 'Packaging'}
                        {role === 'sales' && 'Sales'}
                        {role === 'research' && 'Research'}
                      </Label>
                    </div>
                  ))}
                </div>
                {formData.roles.length === 0 && (
                  <p className="text-xs text-destructive">At least one role must be selected</p>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label>Account Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.status === 'active'
                      ? 'User can access the system'
                      : 'User is blocked from accessing'}
                  </p>
                </div>
                <Switch
                  checked={formData.status === 'active'}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: checked ? 'active' : 'inactive',
                    }))
                  }
                />
              </div>

              {/* Reset Password */}
              {isEditing && (
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Reset Password</Label>
                      <p className="text-sm text-muted-foreground">
                        Send a new temporary password to user
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetPassword}
                      disabled={isLoading}
                    >
                      Reset Password
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={() => router.push('/users')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Update User' : 'Create User'}
                </span>
              )}
            </Button>
          </div>
        </form>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isEditing ? 'Update User?' : 'Create New User?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isEditing
                  ? `Are you sure you want to update ${formData.fullName}'s details?`
                  : `This will create a new user account for ${formData.fullName} with roles: ${formData.roles.join(', ')}. They will receive login credentials at ${formData.email}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm}>
                {isEditing ? 'Update' : 'Create'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
