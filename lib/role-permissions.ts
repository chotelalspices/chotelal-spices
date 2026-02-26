export type UserRole = 'admin' | 'production' | 'packaging' | 'sales' | 'research'

export type Module = 'inventory' | 'formulations' | 'production' | 'packaging' | 'sales' | 'research' | 'settings'

// Granular permissions for specific actions
export type FormulationPermission = 
  | 'view_formulations'
  | 'create_formulation' 
  | 'edit_formulation'
  | 'delete_formulation'

export type ProductPermission = 
  | 'view_products'
  | 'create_product'
  | 'edit_product'
  | 'delete_product'

export const ROLE_PERMISSIONS: Record<UserRole, Module[]> = {
  admin: ['inventory', 'formulations', 'production', 'packaging', 'sales', 'research', 'settings'],
  production: ['inventory', 'formulations', 'production'],
  packaging: ['packaging', 'formulations'], // Can access formulations module but with limited permissions
  sales: ['sales'],
  research: ['research']
}

// Granular formulation permissions
export const FORMULATION_PERMISSIONS: Record<UserRole, FormulationPermission[]> = {
  admin: ['view_formulations', 'create_formulation', 'edit_formulation', 'delete_formulation'],
  production: ['view_formulations', 'create_formulation', 'edit_formulation', 'delete_formulation'],
  packaging: ['view_formulations'], // ✅ Can only VIEW formulations, cannot create/edit/delete
  sales: [],
  research: ['view_formulations']
}

// Granular product permissions
export const PRODUCT_PERMISSIONS: Record<UserRole, ProductPermission[]> = {
  admin: ['view_products', 'create_product', 'edit_product', 'delete_product'],
  production: ['view_products', 'create_product', 'edit_product', 'delete_product'],
  packaging: ['view_products', 'create_product', 'edit_product', 'delete_product'], // ✅ Full access to products
  sales: [],
  research: ['view_products']
}

export function hasPermission(userRoles: UserRole[], module: Module): boolean {
  // Admin has access to everything
  if (userRoles.includes('admin')) {
    return true
  }

  // Check if any of the user's roles have permission for the module
  return userRoles.some(role => ROLE_PERMISSIONS[role]?.includes(module))
}

export function hasFormulationPermission(
  userRoles: UserRole[], 
  permission: FormulationPermission
): boolean {
  // Admin has all permissions
  if (userRoles.includes('admin')) {
    return true
  }

  // Check if any role has the specific permission
  return userRoles.some(role => 
    FORMULATION_PERMISSIONS[role]?.includes(permission)
  )
}

export function hasProductPermission(
  userRoles: UserRole[], 
  permission: ProductPermission
): boolean {
  // Admin has all permissions
  if (userRoles.includes('admin')) {
    return true
  }

  // Check if any role has the specific permission
  return userRoles.some(role => 
    PRODUCT_PERMISSIONS[role]?.includes(permission)
  )
}

export function getAccessibleModules(userRoles: UserRole[]): Module[] {
  // Admin has access to everything
  if (userRoles.includes('admin')) {
    return ROLE_PERMISSIONS.admin
  }

  // Get unique modules from all user roles
  const modules = new Set<Module>()
  userRoles.forEach(role => {
    ROLE_PERMISSIONS[role]?.forEach(module => modules.add(module))
  })

  return Array.from(modules)
}

export function canAccessModule(userRoles: UserRole[], module: Module): boolean {
  return hasPermission(userRoles, module)
}

// Helper to check if user can manage formulations (create/edit/delete)
export function canManageFormulations(userRoles: UserRole[]): boolean {
  return hasFormulationPermission(userRoles, 'create_formulation') ||
         hasFormulationPermission(userRoles, 'edit_formulation') ||
         hasFormulationPermission(userRoles, 'delete_formulation')
}

// Helper to check if user can manage products (create/edit/delete)
export function canManageProducts(userRoles: UserRole[]): boolean {
  return hasProductPermission(userRoles, 'create_product') ||
         hasProductPermission(userRoles, 'edit_product') ||
         hasProductPermission(userRoles, 'delete_product')
}