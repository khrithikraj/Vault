import { describe, expect, it } from 'vitest'
import {
  createSupabaseContext,
  withSupabase,
  type SupabaseContext,
} from '@supabase/server'

// Mirrors the exact options used by supabase/functions/send-reminders/index.ts:
// withSupabase({ auth: 'secret:sendreminders' }, handler). The function reads a
// dedicated secret key (Dashboard -> Settings -> API keys -> Secret keys -> "New
// key", named `sendreminders`) from the `apikey` header; the platform JWT gate
// is off for this function (config.toml), so this SDK gate is the ONLY auth.
const AUTH = 'secret:sendreminders' as const

const SECRET_KEY = 'sb_secret_send_reminders_test_value_abc123'
const OTHER_SECRET_KEY = 'sb_secret_other_automations_test_value_def456'
const PUBLISHABLE_KEY = 'sb_publishable_test_public_frontend_key_789'

// Mirrors the env Supabase auto-injects on Edge Functions: SUPABASE_URL,
// SUPABASE_PUBLISHABLE_KEYS (default key) and SUPABASE_SECRET_KEYS.
const ENV = {
  url: 'https://test-project.supabase.co',
  publishableKeys: { default: PUBLISHABLE_KEY },
  secretKeys: { 'sendreminders': SECRET_KEY, other: OTHER_SECRET_KEY },
}

const URL = 'https://test-project.supabase.co/functions/v1/send-reminders'

const ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHNud2JxdnRxcmF2bnB5dmN6Iiwicm9sZSI6ImFub24ifQ.signature'
const SERVICE_ROLE_JWT =
  'eyJhbGciOiJIUzI1NiIsImlzcyI6InN1cGFiYXNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.signature'

function postReq(headers: Record<string, string> = {}): Request {
  return new Request(URL, { method: 'POST', headers })
}

describe('send-reminders caller authorization (secret:sendreminders)', () => {
  it('accepts the dedicated named secret key on the apikey header', async () => {
    const { data: ctx, error } = await createSupabaseContext(
      postReq({ apikey: SECRET_KEY }),
      { auth: AUTH, env: ENV },
    )
    expect(error).toBeNull()
    expect(ctx).not.toBeNull()
    expect(ctx!.authMode).toBe('secret')
    expect(ctx!.authKeyName).toBe('sendreminders')
    expect(typeof ctx!.supabaseAdmin.from).toBe('function')
    expect(ctx!.userClaims).toBeNull()
    expect(ctx!.jwtClaims).toBeNull()
  })

  it('rejects a different named secret key', async () => {
    const { data, error } = await createSupabaseContext(
      postReq({ apikey: OTHER_SECRET_KEY }),
      { auth: AUTH, env: ENV },
    )
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
    expect(error?.code).toBe('INVALID_API_KEY')
  })

  it('rejects a publishable key (public, shipped in the frontend)', async () => {
    const { data, error } = await createSupabaseContext(
      postReq({ apikey: PUBLISHABLE_KEY }),
      { auth: AUTH, env: ENV },
    )
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
    expect(error?.code).toBe('INVALID_API_KEY')
  })

  it('rejects a legacy service_role JWT sent on the apikey header', async () => {
    const { data, error } = await createSupabaseContext(
      postReq({ apikey: SERVICE_ROLE_JWT }),
      { auth: AUTH, env: ENV },
    )
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
    expect(error?.code).toBe('INVALID_API_KEY')
  })

  it('rejects a user (anon) JWT sent on the apikey header', async () => {
    const { data, error } = await createSupabaseContext(
      postReq({ apikey: ANON_JWT }),
      { auth: AUTH, env: ENV },
    )
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
    expect(error?.code).toBe('INVALID_API_KEY')
  })

  it('rejects a bearer user JWT (even when it is the only credential)', async () => {
    const { data, error } = await createSupabaseContext(
      postReq({ authorization: `Bearer ${ANON_JWT}` }),
      { auth: AUTH, env: ENV },
    )
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
  })

  it('rejects a browser-style request (user JWT + publishable apikey)', async () => {
    const { data, error } = await createSupabaseContext(
      postReq({ apikey: PUBLISHABLE_KEY, authorization: `Bearer ${ANON_JWT}` }),
      { auth: AUTH, env: ENV },
    )
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
    expect(error?.code).toBe('INVALID_API_KEY')
  })

  it('rejects a request with no credential', async () => {
    const { data, error } = await createSupabaseContext(postReq(), { auth: AUTH, env: ENV })
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
    expect(error?.code).toBe('MISSING_CREDENTIALS')
  })

  it('rejects an empty apikey header', async () => {
    const { data, error } = await createSupabaseContext(
      postReq({ apikey: '' }),
      { auth: AUTH, env: ENV },
    )
    expect(data).toBeNull()
    expect(error?.status).toBe(401)
  })

  it('rejects a malformed / unrecognized apikey value', async () => {
    for (const bad of ['not-a-key', '!!invalid!!']) {
      const { data, error } = await createSupabaseContext(
        postReq({ apikey: bad }),
        { auth: AUTH, env: ENV },
      )
      expect(data).toBeNull()
      expect(error?.status).toBe(401)
      expect(error?.code).toBe('INVALID_API_KEY')
    }
  })

  it('fails closed (500) when the named key is not configured on the server', async () => {
    const { data, error } = await createSupabaseContext(
      postReq({ apikey: SECRET_KEY }),
      { auth: AUTH, env: { ...ENV, secretKeys: { other: OTHER_SECRET_KEY } } },
    )
    expect(data).toBeNull()
    expect(error?.status).toBe(500)
    expect(error?.code).toBe('NO_KEYS_CONFIGURED')
  })
})

describe('send-reminders endpoint gate (withSupabase)', () => {
  function wrapped() {
    const calls: string[] = []
    const fn = withSupabase(
      { auth: AUTH, env: ENV },
      async (_req: Request, ctx: SupabaseContext) => {
        calls.push(ctx.authKeyName ?? ctx.authMode)
        return Response.json({ mode: ctx.authMode, keyName: ctx.authKeyName })
      },
    )
    return { fn, calls }
  }

  it('routes an authorized request to the handler and returns its response', async () => {
    const { fn, calls } = wrapped()
    const res = await fn(postReq({ apikey: SECRET_KEY }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ mode: 'secret', keyName: 'sendreminders' })
    expect(calls).toEqual(['sendreminders'])
  })

  it('never runs the handler for a wrong secret key (401 with error header)', async () => {
    const { fn, calls } = wrapped()
    const res = await fn(postReq({ apikey: OTHER_SECRET_KEY }))
    expect(res.status).toBe(401)
    expect(res.headers.get('x-supabase-server-error')).toBe('INVALID_API_KEY')
    expect((await res.json())?.code).toBe('INVALID_API_KEY')
    expect(calls).toHaveLength(0)
  })

  it('never runs the handler for a publishable key (401)', async () => {
    const { fn, calls } = wrapped()
    const res = await fn(postReq({ apikey: PUBLISHABLE_KEY }))
    expect(res.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('never runs the handler for a request with no credential (401)', async () => {
    const { fn, calls } = wrapped()
    const res = await fn(postReq())
    expect(res.status).toBe(401)
    expect(res.headers.get('x-supabase-server-error')).toBe('MISSING_CREDENTIALS')
    expect(calls).toHaveLength(0)
  })

  it('never runs the handler for a user-only request (401)', async () => {
    const { fn, calls } = wrapped()
    const res = await fn(postReq({ authorization: `Bearer ${ANON_JWT}` }))
    expect(res.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('never runs the handler for a browser-style request (401)', async () => {
    const { fn, calls } = wrapped()
    const res = await fn(postReq({ apikey: PUBLISHABLE_KEY, authorization: `Bearer ${ANON_JWT}` }))
    expect(res.status).toBe(401)
    expect(calls).toHaveLength(0)
  })
})