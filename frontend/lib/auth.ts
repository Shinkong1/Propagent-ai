export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function clearToken(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getUser(): any {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

// Components that read getUser() once on mount (Sidebar's plan/owner badge,
// DashboardLayout's email-verify banner, etc.) never re-render when some
// other part of the app calls setUser() later in the same session --
// localStorage writes aren't reactive on their own. Real report: had to
// refresh the page to see profile changes reflected. Dispatching this lets
// already-mounted components listen and refresh instead of going stale
// until a full reload. (The native "storage" event doesn't cover this --
// it only fires in *other* tabs, never the tab that made the change.)
export const USER_UPDATED_EVENT = 'propagent:user-updated';

export function setUser(user: any): void {
  localStorage.setItem('user', JSON.stringify(user));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT, { detail: user }));
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
