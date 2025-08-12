// Utility to check if a session or user object is admin
import type { UserSession } from './auth';

export function isAdmin(session: UserSession | { role?: string; is_admin?: boolean }): boolean {
  if (!session) return false;
  if ('is_admin' in session && typeof session.is_admin === 'boolean') {
    return session.is_admin;
  }
  if ('role' in session && typeof session.role === 'string') {
    return session.role === 'admin' || session.role === 'super_admin';
  }
  return false;
}
