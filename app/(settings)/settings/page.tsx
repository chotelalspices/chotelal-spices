'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Building2, Sliders, Shield, Loader2 } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import { getSettings, updateSettings, SystemSettings } from '@/data/settingsData';

export default function Settings() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access the Settings page.',
        variant: 'destructive',
      });
    }
  }, [isAdmin, authLoading, router, toast]);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load settings. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [toast]);

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

  const handleSave = () => setShowConfirmDialog(true);

  const handleConfirm = async () => {
    if (!settings) return;

    setIsSaving(true);
    setShowConfirmDialog(false);

    try {
      await updateSettings(settings);
      toast({
        title: 'Settings Saved',
        description: 'Your settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="page-title">Settings</h1>
              <p className="text-muted-foreground">
                Configure system behavior and permissions
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading settings...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!settings) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="page-title">Settings</h1>
              <p className="text-muted-foreground">
                Configure system behavior and permissions
              </p>
            </div>
          </div>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Failed to load settings.</p>
            <Button 
              className="mt-4" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="text-muted-foreground">
              Configure system behavior and permissions
            </p>
          </div>
        </div>

        {/* Business Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={settings.businessSettings.businessName}
                onChange={(e) =>
                  setSettings((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      businessSettings: {
                        ...prev.businessSettings,
                        businessName: e.target.value,
                      },
                    };
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={`${settings.businessSettings.currency} (${settings.businessSettings.currencySymbol})`}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Units</Label>
                <Input value="kg / g" disabled className="bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Values */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5" />
              Default Values
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Formulation Qty (kg)</Label>
                <Input
                  type="number"
                  value={settings.defaultValues.baseFormulationQuantity}
                  onChange={(e) =>
                    setSettings((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        defaultValues: {
                          ...prev.defaultValues,
                          baseFormulationQuantity: Number(e.target.value),
                        },
                      };
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Min Stock Alert (kg)</Label>
                <Input
                  type="number"
                  value={settings.defaultValues.minimumStockAlertQuantity}
                  onChange={(e) =>
                    setSettings((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        defaultValues: {
                          ...prev.defaultValues,
                          minimumStockAlertQuantity: Number(e.target.value),
                        },
                      };
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save Settings?</AlertDialogTitle>
              <AlertDialogDescription>
                Changes will take effect immediately but won't affect historical data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm}>
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
