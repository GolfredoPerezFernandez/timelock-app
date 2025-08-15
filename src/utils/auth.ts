import type { RequestEventBase } from '@builder.io/qwik-city';
import { createClient, type Client } from '@libsql/client';

// Define the structure of our session object
export interface UserSession {
  isAuthenticated: boolean;
  userId: string | null;
  role: 'freelancer' | 'admin' | 'super_admin' | null;
  is_admin: boolean;
  email: string | null;
}

// This function will be our single source of truth for session state
export const getSession = async (requestEvent: RequestEventBase): Promise<UserSession> => {
  const userId = requestEvent.cookie.get('auth_token')?.value;
  const userRole = requestEvent.cookie.get('user_type')?.value as UserSession['role'];

  // Debug log para ver cookies recibidas
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[SESSION DEBUG] auth_token:', userId, 'user_type:', userRole);
  }

  if (!userId || !userRole) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[SESSION DEBUG] Falta auth_token o user_type. userId:', userId, 'userRole:', userRole);
    }
    return { isAuthenticated: false, userId: null, role: null, is_admin: false, email: null };
  }

  // Solo el usuario con email 'admin@gmail.com' es admin
  let is_admin = false;
  let role: UserSession['role'] = userRole;

  // Buscar el email real del usuario en la base de datos
  try {
    // Usa los nombres correctos de las variables de entorno (ver turso.ts)
    const db = createClient({
      url: requestEvent.env.get('PRIVATE_TURSO_DATABASE_URL')!,
      authToken: requestEvent.env.get('PRIVATE_TURSO_AUTH_TOKEN')!,
    });
    const rs = await db.execute({
      sql: 'SELECT email, type FROM users WHERE id = ?',
      args: [userId],
    });
    if (rs.rows.length === 0) {
      clearAuthCookies(requestEvent);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[SESSION DEBUG] Usuario no encontrado en DB. userId:', userId);
      }
      return { isAuthenticated: false, userId: null, role: null, is_admin: false, email: null };
    }
    const user = rs.rows[0] as unknown as { email: string; type: string };
    if (user.email === 'admin@gmail.com') {
      is_admin = true;
      role = 'admin';
    } else {
      is_admin = false;
      // Si el usuario no es admin@gmail.com, forzar el rol a freelancer si era admin
      if (userRole === 'admin' || userRole === 'super_admin') {
        role = 'freelancer';
      }
    }
    return {
      isAuthenticated: true,
      userId: userId,
      role,
      is_admin,
      email: user.email ?? null,
    };
  } catch (e) {
    console.error('Session validation DB error:', e);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[SESSION DEBUG] Error de conexión a DB en getSession:', e);
    }
    return { isAuthenticated: false, userId: null, role: null, is_admin: false, email: null };
  }
};


// Convert string to ArrayBuffer
function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

// Convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  // Convert password to ArrayBuffer
  const passwordBuffer = stringToArrayBuffer(password);
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  // Import password as key
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  // Derive key using PBKDF2
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    256
  );
  // Combine salt and derived key
  const combined = new Uint8Array(salt.length + 32);
  combined.set(salt);
  combined.set(new Uint8Array(derivedKey), salt.length);
  const hex = arrayBufferToHex(combined.buffer);
  console.log('[hashPassword] password:', password);
  console.log('[hashPassword] salt:', arrayBufferToHex(salt.buffer));
  console.log('[hashPassword] derivedKey:', arrayBufferToHex(derivedKey));
  console.log('[hashPassword] combined hex:', hex);
  // Return as hex string
  return hex;
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  // Convert hex string back to ArrayBuffer
  const combined = new Uint8Array(hash.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  // Extract salt and derived key
  const salt = combined.slice(0, 16);
  const storedKey = combined.slice(16);
  // Hash the input password with the same salt
  const passwordBuffer = stringToArrayBuffer(password);
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    256
  );
  const derivedKeyHex = arrayBufferToHex(derivedKey);
  const storedKeyHex = arrayBufferToHex(storedKey.buffer);
  console.log('[verifyPassword] password:', password);
  console.log('[verifyPassword] salt:', arrayBufferToHex(salt.buffer));
  console.log('[verifyPassword] derivedKey:', derivedKeyHex);
  console.log('[verifyPassword] storedKey:', storedKeyHex);
  // Compare the derived key with the stored key
  return derivedKeyHex === storedKeyHex;
}

// Helper functions for cookies
export const setCookies = (
  requestEvent: RequestEventBase,
  userId: string | number | bigint,
  userType: 'freelancer' | 'admin' | 'super_admin'
) => {
  const userIdStr = String(userId);
  
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const, // Permite que la cookie se envíe en nueva pestaña/iframe
    secure: requestEvent.url.protocol === 'https:',
    maxAge: 60 * 60 * 24 * 30 // 30 días
  };

  requestEvent.cookie.set('auth_token', userIdStr, cookieOptions);
  requestEvent.cookie.set('user_type', userType, cookieOptions);
};

export const clearAuthCookies = (requestEvent: RequestEventBase) => {
  const cookieOptions = { path: '/' };
  requestEvent.cookie.delete('auth_token', cookieOptions);
  requestEvent.cookie.delete('user_type', cookieOptions);
};