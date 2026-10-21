import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto'
import { sendVapidPush } from './vapid'

afterEach(() => vi.unstubAllGlobals())

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'jwk' })
  const priv = privateKey.export({ format: 'jwk' })
  const encoded = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(pub.x!, 'base64url'),
    Buffer.from(pub.y!, 'base64url'),
  ]).toString('base64url')
  return { publicKey: encoded, privateKey: priv.d!, verifyKey: createPublicKey(privateKey) }
}

describe('Web Push VAPID authorization', () => {
  it('signs an ES256 JWT for the push service origin without private payload', async () => {
    const keys = fixture()
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendVapidPush('https://push.example.test/some-token', keys.publicKey, keys.privateKey, 'mailto:admin@example.test')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [endpoint, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(endpoint).toBe('https://push.example.test/some-token')
    expect(options.method).toBe('POST')
    const authorization = (options.headers as Record<string, string>).Authorization
    const token = authorization.match(/^vapid t=([^,]+), k=/)?.[1]
    expect(token).toBeTruthy()
    const [header, claims, signature] = token!.split('.')
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toMatchObject({ alg: 'ES256' })
    const body = JSON.parse(Buffer.from(claims, 'base64url').toString())
    expect(body.aud).toBe('https://push.example.test')
    expect(body.sub).toBe('mailto:admin@example.test')
    expect(verify('SHA256', Buffer.from(header + '.' + claims), {
      key: keys.verifyKey, dsaEncoding: 'ieee-p1363',
    }, Buffer.from(signature, 'base64url'))).toBe(true)
  })
  it('rejects a non-HTTPS push endpoint before contacting provider', async () => {
    const keys = fixture()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendVapidPush('http://push.example.test/path',keys.publicKey,keys.privateKey,'mailto:admin@example.test')).rejects.toThrow('HTTPS')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('reports unsuccessful provider HTTP status', async () => {
    const keys = fixture()
    vi.stubGlobal('fetch',vi.fn(async () => ({ok:false,status:410})))
    await expect(sendVapidPush('https://push.example.test/path',keys.publicKey,keys.privateKey,'mailto:admin@example.test')).rejects.toMatchObject({statusCode:410})
  })
})
