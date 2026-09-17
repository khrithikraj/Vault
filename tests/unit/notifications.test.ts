import { describe, expect, it } from 'vitest'
import { decodeVapidKey, describePushError, isValidApplicationServerKey } from '../../src/lib/notifications'

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function point(byteLength: number, firstByte = 0x04): Uint8Array {
  const bytes = new Uint8Array(byteLength)
  bytes[0] = firstByte
  return bytes
}

describe('decodeVapidKey', () => {
  it('decodes an unpadded base64url 65-byte EC point correctly', () => {
    const key = point(65)
    key[1] = 0xab
    const value = toBase64Url(key)
    const decoded = decodeVapidKey(value)
    expect(decoded).toHaveLength(65)
    expect(decoded[0]).toBe(0x04)
    expect(decoded[1]).toBe(0xab)
  })

  it('round-trips with and without padding', () => {
    const key = point(65)
    expect(decodeVapidKey(toBase64Url(key))).toEqual(key)
    expect(decodeVapidKey(toBase64Url(key) + '=')).toEqual(key)
  })
})

describe('isValidApplicationServerKey', () => {
  it('accepts a 65-byte uncompressed P-256 point', () => {
    expect(isValidApplicationServerKey(point(65))).toBe(true)
  })

  it('rejects keys that are too short (e.g. a 32-byte raw secret)', () => {
    expect(isValidApplicationServerKey(point(32))).toBe(false)
  })

  it('rejects keys missing the 0x04 uncompressed prefix', () => {
    expect(isValidApplicationServerKey(point(65, 0x02))).toBe(false)
    expect(isValidApplicationServerKey(point(65, 0x03))).toBe(false)
  })

  it('rejects empty buffers', () => {
    expect(isValidApplicationServerKey(new Uint8Array(0))).toBe(false)
  })
})

describe('describePushError', () => {
  it('maps the opaque Chrome DOMException names to actionable text', () => {
    expect(describePushError(new DOMException('x', 'NotAllowedError'))).toMatch(/permission/i)
    expect(describePushError(new DOMException('x', 'InvalidStateError'))).toMatch(/conflicting subscription/i)
    expect(describePushError(new DOMException('x', 'SecurityError'))).toMatch(/secure connection/i)
    expect(describePushError(new DOMException('x', 'NetworkError'))).toMatch(/push service/i)
    expect(describePushError(new DOMException('x', 'AbortError'))).toMatch(/aborted/i)
  })

  it('falls back to the raw name/message and to plain Error messages', () => {
    const domException = new DOMException('Registration failed - push service error', 'UnknownError')
    expect(describePushError(domException)).toContain('UnknownError')
    expect(describePushError(new Error('boom'))).toBe('boom')
  })

  it('has a final fallback for non-Error failures', () => {
    expect(describePushError(undefined)).toBe('Could not enable notifications.')
  })
})