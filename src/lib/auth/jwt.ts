import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-DO-NOT-USE-IN-PRODUCTION';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  organizationSlug?: string;
  role?: string;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JWTPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: 'smokeshop-saas',
    audience: 'smokeshop-saas-users',
  });
}

/**
 * Verify and decode a JWT token
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'smokeshop-saas',
      audience: 'smokeshop-saas-users',
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Decode a JWT token without verification (use carefully)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded) return true;
  
  const payload = decoded as any;
  if (!payload.exp) return false;
  
  return Date.now() >= payload.exp * 1000;
}

/**
 * Refresh a token (generate new token with same payload)
 */
export function refreshToken(token: string): string {
  const payload = verifyToken(token);
  // Remove JWT standard claims
  const { iat, exp, iss, aud, ...userPayload } = payload as any;
  return generateToken(userPayload);
}
