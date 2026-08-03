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

export function setUser(user: any): void {
  localStorage.setItem('user', JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
