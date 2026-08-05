// Tenant portal session — deliberately separate storage keys from lib/auth.ts's
// staff session, so a browser can hold a staff login and a tenant login (e.g. an
// owner checking their own unit) at the same time without either clobbering the
// other.
export function getTenantToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_token');
}

export function setTenantToken(token: string): void {
  localStorage.setItem('tenant_token', token);
}

export function clearTenantToken(): void {
  localStorage.removeItem('tenant_token');
  localStorage.removeItem('tenant');
}

export function getTenant(): any {
  if (typeof window === 'undefined') return null;
  const t = localStorage.getItem('tenant');
  return t ? JSON.parse(t) : null;
}

export function setTenant(tenant: any): void {
  localStorage.setItem('tenant', JSON.stringify(tenant));
}

export function isTenantAuthenticated(): boolean {
  return !!getTenantToken();
}
