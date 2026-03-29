export type UserRole =
  | 'admin'
  | 'production'
  | 'packaging'
  | 'sales'
  | 'research'
  | 'inventory'
  | 'labels'
  | 'box_inventory'

/**
 * Added new module: 'box_inventory'
 */
export type Module =
  | 'dashboard'
  | 'inventory'
  | 'labels'
  | 'box_inventory'
  | 'formulations'
  | 'production'
  | 'packaging'
  | 'sales'
  | 'research'
  | 'settings'

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

/**
 * Optional: Box Inventory granular permissions
 */
export type BoxInventoryPermission =
  | 'view_box_inventory'
  | 'adjust_box_inventory'
  | 'update_box_minimum_stock'

/**
 * Role → Module Access Mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Module[]> = {
  admin: [
    'dashboard',
    'inventory',
    'labels',
    'box_inventory',
    'formulations',
    'production',
    'packaging',
    'sales',
    'research',
    'settings'
  ],

  production: [
    'production'
  ],

  packaging: [
    'packaging',
    'formulations',
  ],

  sales: [
    'sales'
  ],

  research: [
    'research'
  ],

  inventory: [
    'inventory'
  ],

  labels: [
    'labels'
  ],
  box_inventory: [
  'box_inventory'
]
}

// Granular formulation permissions
export const FORMULATION_PERMISSIONS: Record<UserRole, FormulationPermission[]> = {
  admin: ['view_formulations', 'create_formulation', 'edit_formulation', 'delete_formulation'],
  production: ['view_formulations', 'create_formulation', 'edit_formulation', 'delete_formulation'],
  packaging: ['view_formulations'],
  box_inventory: [],
  sales: [],
  research: ['view_formulations'],
  inventory: [],
  labels: []
}

// Granular product permissions
export const PRODUCT_PERMISSIONS: Record<UserRole, ProductPermission[]> = {
  admin: ['view_products', 'create_product', 'edit_product', 'delete_product'],
  production: ['view_products', 'create_product', 'edit_product', 'delete_product'],
  packaging: ['view_products', 'create_product', 'edit_product', 'delete_product'],
  box_inventory: [],
  sales: [],
  research: ['view_products'],
  inventory: [],
  labels: []
}

/**
 * Box Inventory permissions
 */
export const BOX_INVENTORY_PERMISSIONS: Record<UserRole, BoxInventoryPermission[]> = {
  admin: [
    'view_box_inventory',
    'adjust_box_inventory',
    'update_box_minimum_stock'
  ],
  production: [],
  packaging: [],
  sales: [],
  box_inventory: [],
  research: [],
  inventory: [],
  labels: []
}

export function hasPermission(userRoles: UserRole[], module: Module): boolean {
  if (userRoles.includes('admin')) {
    return true
  }

  return userRoles.some(role =>
    ROLE_PERMISSIONS[role]?.includes(module)
  )
}

export function hasFormulationPermission(
  userRoles: UserRole[],
  permission: FormulationPermission
): boolean {
  if (userRoles.includes('admin')) {
    return true
  }

  return userRoles.some(role =>
    FORMULATION_PERMISSIONS[role]?.includes(permission)
  )
}

export function hasProductPermission(
  userRoles: UserRole[],
  permission: ProductPermission
): boolean {
  if (userRoles.includes('admin')) {
    return true
  }

  return userRoles.some(role =>
    PRODUCT_PERMISSIONS[role]?.includes(permission)
  )
}

export function hasBoxInventoryPermission(
  userRoles: UserRole[],
  permission: BoxInventoryPermission
): boolean {
  if (userRoles.includes('admin')) {
    return true
  }

  return userRoles.some(role =>
    BOX_INVENTORY_PERMISSIONS[role]?.includes(permission)
  )
}

export function getAccessibleModules(userRoles: UserRole[]): Module[] {
  if (userRoles.includes('admin')) {
    return ROLE_PERMISSIONS.admin
  }

  const modules = new Set<Module>()

  userRoles.forEach(role => {
    ROLE_PERMISSIONS[role]?.forEach(module => modules.add(module))
  })

  return Array.from(modules)
}

export function canAccessModule(userRoles: UserRole[], module: Module): boolean {
  return hasPermission(userRoles, module)
}

export function canManageFormulations(userRoles: UserRole[]): boolean {
  return hasFormulationPermission(userRoles, 'create_formulation') ||
         hasFormulationPermission(userRoles, 'edit_formulation') ||
         hasFormulationPermission(userRoles, 'delete_formulation')
}

export function canManageProducts(userRoles: UserRole[]): boolean {
  return hasProductPermission(userRoles, 'create_product') ||
         hasProductPermission(userRoles, 'edit_product') ||
         hasProductPermission(userRoles, 'delete_product')
}

export function canManageBoxInventory(userRoles: UserRole[]): boolean {
  return hasBoxInventoryPermission(userRoles, 'adjust_box_inventory') ||
         hasBoxInventoryPermission(userRoles, 'update_box_minimum_stock')
}