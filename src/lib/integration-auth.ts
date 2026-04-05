import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';

const INTEGRATION_JWT_SECRET = process.env.INTEGRATION_JWT_SECRET || '';

export function getIntegrationToken(payload: Record<string, any> = {}) {
  if (!INTEGRATION_JWT_SECRET) throw new Error('INTEGRATION_JWT_SECRET is not set');
  return jwt.sign({ scope: 'integration', ...payload }, INTEGRATION_JWT_SECRET, { expiresIn: '10m' });
}

export function verifyIntegrationRequest(req: NextRequest) {
  if (!INTEGRATION_JWT_SECRET) throw new Error('INTEGRATION_JWT_SECRET is not set');
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new Error('Missing integration token');
  const decoded = jwt.verify(token, INTEGRATION_JWT_SECRET) as any;
  if (!decoded || decoded.scope !== 'integration') throw new Error('Invalid integration token');
  return decoded;
}
