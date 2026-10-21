import { createPrivateKey, sign } from 'node:crypto'

// Payload-free Web Push uses VAPID authentication without external npm packages.
// Service worker supplies a generic message; private task details never leave the server.
export async function sendVapidPush(endpoint: string, publicKey: string, privateKey: string, subject: string) {
  const origin = new URL(endpoint).origin
  if (!origin.startsWith('https://')) throw new Error('Push endpoint must use HTTPS')
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    throw new Error('VAPID subject must be mailto: or https:')
  }
  const keyBytes = Buffer.from(publicKey, 'base64url')
  const dBytes = Buffer.from(privateKey, 'base64url')
  if (keyBytes.length !== 65 || keyBytes[0] !== 4 || dBytes.length !== 32) {
    throw new Error('Invalid VAPID P-256 key pair')
  }
  const key = createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC', crv: 'P-256',
      x: keyBytes.subarray(1, 33).toString('base64url'),
      y: keyBytes.subarray(33, 65).toString('base64url'),
      d: dBytes.toString('base64url'),
    },
  })
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url')
  const claims = Buffer.from(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 11 * 3600,
    sub: subject,
  })).toString('base64url')
  const message = header + '.' + claims
  const signature = sign('SHA256', Buffer.from(message), {
    key, dsaEncoding: 'ieee-p1363',
  }).toString('base64url')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: 'vapid t=' + message + '.' + signature + ', k=' + publicKey,
      TTL: '3600',
      Urgency: 'normal',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const error = new Error('Push provider HTTP ' + response.status) as Error & { statusCode: number }
    error.statusCode = response.status
    throw error
  }
}
