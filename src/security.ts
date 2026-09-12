export type Role = 'viewer' | 'editor' | 'operator' | 'admin'
export type Permission = 'workflow:read' | 'workflow:edit' | 'workflow:execute' | 'workflow:publish' | 'secret:bind' | 'audit:read'

const rolePermissions: Record<Role, Permission[]> = {
  viewer: ['workflow:read'],
  editor: ['workflow:read', 'workflow:edit', 'secret:bind'],
  operator: ['workflow:read', 'workflow:execute', 'audit:read'],
  admin: ['workflow:read', 'workflow:edit', 'workflow:execute', 'workflow:publish', 'secret:bind', 'audit:read'],
}

export function can(role: Role, permission: Permission) { return rolePermissions[role].includes(permission) }

/** Never put secret values into workflow JSON or client-side logs. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const sensitive = /secret|password|token|api[_-]?key|authorization/i.test(key)
    return [key, sensitive ? '••••••••' : redactSecrets(item)]
  }))
}

export function safeAuditEvent(action: string, actor: string, metadata: Record<string, unknown> = {}) {
  return { action, actor, at: new Date().toISOString(), metadata: redactSecrets(metadata) }
}
