// Settings Data Types and API Functions

export interface BusinessSettings {
  id?: string;
  businessName: string;
  logoUrl?: string;
  currency: string;
  currencySymbol: string;
  measurementUnits: {
    production: string;
    packaging: string;
  };
}

export interface DefaultValues {
  id?: string;
  baseFormulationQuantity: number;
  minimumStockAlertQuantity: number;
  packagingLossVisibility: boolean;
}

export interface PermissionSettings {
  showProfitToStaff: boolean;
  showCostOnDashboard: boolean;
  allowSalesEdit: boolean;
}

export interface SystemSettings {
  businessSettings: BusinessSettings;
  defaultValues: DefaultValues;
  permissions: PermissionSettings;
  lastUpdated: string;
  updatedBy: string;
}

// API Functions for Settings Management

// Settings getters
export const getSettings = async (): Promise<SystemSettings> => {
  try {
    const response = await fetch('/api/settings', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching settings:', error);
    // Return default settings as fallback
    return {
      businessSettings: {
        businessName: 'SpiceMaster Industries',
        logoUrl: undefined,
        currency: 'INR',
        currencySymbol: '₹',
        measurementUnits: {
          production: 'kg',
          packaging: 'g',
        },
      },
      defaultValues: {
        baseFormulationQuantity: 100,
        minimumStockAlertQuantity: 25,
        packagingLossVisibility: true,
      },
      permissions: {
        showProfitToStaff: false,
        showCostOnDashboard: true,
        allowSalesEdit: false,
      },
      lastUpdated: '2024-12-20',
      updatedBy: 'Rajesh Kumar Singh',
    };
  }
};

export const getBusinessSettings = async (): Promise<BusinessSettings> => {
  const settings = await getSettings();
  return settings.businessSettings;
};

export const getDefaultValues = async (): Promise<DefaultValues> => {
  const settings = await getSettings();
  return settings.defaultValues;
};

export const getPermissionSettings = async (): Promise<PermissionSettings> => {
  const settings = await getSettings();
  return settings.permissions;
};

// Settings setters
export const updateSettings = async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error('Failed to update settings');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
};

export const updateBusinessSettings = async (settings: Partial<BusinessSettings>): Promise<BusinessSettings> => {
  const currentSettings = await getSettings();
  const updatedSettings = await updateSettings({
    ...currentSettings,
    businessSettings: {
      ...currentSettings.businessSettings,
      ...settings,
    },
  });
  return updatedSettings.businessSettings;
};

export const updateDefaultValues = async (values: Partial<DefaultValues>): Promise<DefaultValues> => {
  const currentSettings = await getSettings();
  const updatedSettings = await updateSettings({
    ...currentSettings,
    defaultValues: {
      ...currentSettings.defaultValues,
      ...values,
    },
  });
  return updatedSettings.defaultValues;
};

export const updatePermissions = async (permissions: Partial<PermissionSettings>): Promise<PermissionSettings> => {
  const currentSettings = await getSettings();
  const updatedSettings = await updateSettings({
    ...currentSettings,
    permissions: {
      ...currentSettings.permissions,
      ...permissions,
    },
  });
  return updatedSettings.permissions;
};

// Permission checks
export const canViewProfit = async (userRole: 'admin' | 'staff'): Promise<boolean> => {
  if (userRole === 'admin') return true;
  const settings = await getSettings();
  return settings.permissions.showProfitToStaff;
};

export const canViewCostOnDashboard = async (): Promise<boolean> => {
  const settings = await getSettings();
  return settings.permissions.showCostOnDashboard;
};

export const canEditSales = async (userRole: 'admin' | 'staff'): Promise<boolean> => {
  if (userRole === 'admin') return true;
  const settings = await getSettings();
  return settings.permissions.allowSalesEdit;
};

export const isPackagingLossVisible = async (): Promise<boolean> => {
  const settings = await getSettings();
  return settings.defaultValues.packagingLossVisibility;
};

// Reset to defaults
export const resetToDefaults = async (): Promise<SystemSettings> => {
  const defaultSettings = {
    businessSettings: {
      businessName: 'SpiceMaster Industries',
      logoUrl: undefined,
      currency: 'INR',
      currencySymbol: '₹',
      measurementUnits: {
        production: 'kg',
        packaging: 'g',
      },
    },
    defaultValues: {
      baseFormulationQuantity: 100,
      minimumStockAlertQuantity: 25,
      packagingLossVisibility: true,
    },
    permissions: {
      showProfitToStaff: false,
      showCostOnDashboard: true,
      allowSalesEdit: false,
    },
    lastUpdated: new Date().toISOString().split('T')[0],
    updatedBy: 'System Reset',
  };

  return await updateSettings(defaultSettings);
};

// Currency formatter
export const formatCurrency = async (amount: number): Promise<string> => {
  const settings = await getSettings();
  const { currencySymbol } = settings.businessSettings;
  return `${currencySymbol}${amount.toLocaleString('en-IN')}`;
};

// Unit formatter
export const formatProductionUnit = async (value: number): Promise<string> => {
  const settings = await getSettings();
  const { production } = settings.businessSettings.measurementUnits;
  return `${value} ${production}`;
};

export const formatPackagingUnit = async (value: number): Promise<string> => {
  const settings = await getSettings();
  const { packaging } = settings.businessSettings.measurementUnits;
  return `${value} ${packaging}`;
};
