export type UserRole = 'admin' | 'production' | 'packaging' | 'sales' | 'research'

export type Module = 'inventory' | 'formulations' | 'production' | 'packaging' | 'sales' | 'research' | 'settings'

export const ROLE_PERMISSIONS: Record<UserRole, Module[]> = {
  admin: ['inventory', 'formulations', 'production', 'packaging', 'sales', 'research', 'settings'],
  production: ['inventory', 'formulations', 'production'],
  packaging: ['packaging'],
  sales: ['sales'],
  research: ['research']
}

export function hasPermission(userRoles: UserRole[], module: Module): boolean {
  // Admin has access to everything
  if (userRoles.includes('admin')) {
    return true
  }

  // Check if any of the user's roles have permission for the module
  return userRoles.some(role => ROLE_PERMISSIONS[role]?.includes(module))
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
