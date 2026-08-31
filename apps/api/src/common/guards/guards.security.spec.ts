import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  ACCOUNT_DISABLED_CODE,
  NOTARY_NOT_VERIFIED_CODE,
} from '../constants/account-status';

/* ------------------------------------------------------------------ */
/*  Test doubles                                                       */
/* ------------------------------------------------------------------ */

type TableRow = Record<string, unknown> | null;

interface FakeTables {
  profiles?: TableRow;
  notary_profiles?: TableRow;
  profilesError?: { message: string } | null;
  notaryError?: { message: string } | null;
}

function fakeSupabase(tables: FakeTables, user: { id: string } | null = { id: 'user-1' }) {
  const query = (table: string) => {
    const result =
      table === 'profiles'
        ? { data: tables.profiles ?? null, error: tables.profilesError ?? null }
        : { data: tables.notary_profiles ?? null, error: tables.notaryError ?? null };
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = () => Promise.resolve(result);
    chain.single = () => Promise.resolve(result);
    return chain;
  };

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'invalid' },
      }),
    },
    from: jest.fn(query),
  };
}

function makeConfig(client: unknown) {
  return { getAdminClient: () => client } as never;
}

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function reflectorWith(values: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => values[key],
  } as unknown as Reflector;
}

const bearer = { headers: { authorization: 'Bearer token-123' } };

/* ------------------------------------------------------------------ */
/*  BH-04 — AuthGuard rejects deactivated accounts                     */
/* ------------------------------------------------------------------ */

describe('AuthGuard · is_active (BH-04)', () => {
  it('rejects a user whose profile has is_active = false', async () => {
    const client = fakeSupabase({ profiles: { role: 'BROKER', is_active: false } });
    const guard = new AuthGuard(reflectorWith({}), makeConfig(client));
    const request: Record<string, unknown> = { ...bearer };

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    try {
      await guard.canActivate(makeContext({ ...bearer }));
      fail('expected ForbiddenException');
    } catch (err) {
      const body = (err as ForbiddenException).getResponse() as {
        code: string;
        message: string;
      };
      expect(body.code).toBe(ACCOUNT_DISABLED_CODE);
      // The message must be actionable Spanish, not "Forbidden resource".
      expect(body.message).toMatch(/desactivada/i);
      expect(body.message).toMatch(/soporte@bithauss\.com/);
    }
  });

  it('lets an active user through and caches the role on the request', async () => {
    const client = fakeSupabase({ profiles: { role: 'VENDEDOR', is_active: true } });
    const guard = new AuthGuard(reflectorWith({}), makeConfig(client));
    const request: Record<string, unknown> = { ...bearer };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.userRole).toBe('VENDEDOR');
    expect(request.user).toEqual({ id: 'user-1' });
  });

  it('does not block a brand-new user who has no profile row yet', async () => {
    // POST /profiles must stay reachable right after signup.
    const client = fakeSupabase({ profiles: null });
    const guard = new AuthGuard(reflectorWith({}), makeConfig(client));
    const request: Record<string, unknown> = { ...bearer };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.userRole).toBeNull();
  });

  it('fails closed when the profile lookup errors', async () => {
    const client = fakeSupabase({ profilesError: { message: 'db down' } });
    const guard = new AuthGuard(reflectorWith({}), makeConfig(client));

    await expect(
      guard.canActivate(makeContext({ ...bearer })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('skips every check on @Public() routes', async () => {
    const client = fakeSupabase({ profiles: { role: 'X', is_active: false } });
    const guard = new AuthGuard(
      reflectorWith({ [IS_PUBLIC_KEY]: true }),
      makeConfig(client),
    );
    await expect(guard.canActivate(makeContext({}))).resolves.toBe(true);
  });

  it('still rejects a missing token', async () => {
    const client = fakeSupabase({ profiles: { role: 'ADMIN', is_active: true } });
    const guard = new AuthGuard(reflectorWith({}), makeConfig(client));
    await expect(
      guard.canActivate(makeContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

/* ------------------------------------------------------------------ */
/*  BH-01 — RolesGuard demands a verified notary                       */
/* ------------------------------------------------------------------ */

describe('RolesGuard · verified notary (BH-01)', () => {
  const notaryRoute = reflectorWith({ [ROLES_KEY]: ['NOTARIO', 'ADMIN'] });

  it('rejects a NOTARIO whose notary_profiles.is_verified is false', async () => {
    const client = fakeSupabase({ notary_profiles: { is_verified: false } });
    const guard = new RolesGuard(notaryRoute, makeConfig(client));
    const request = { user: { id: 'user-1' }, userRole: 'NOTARIO' };

    try {
      await guard.canActivate(makeContext(request));
      fail('expected ForbiddenException');
    } catch (err) {
      const body = (err as ForbiddenException).getResponse() as {
        code: string;
        message: string;
      };
      expect(body.code).toBe(NOTARY_NOT_VERIFIED_CODE);
      expect(body.message).toMatch(/verificad/i);
    }
  });

  it('rejects a NOTARIO with no notary_profiles row at all', async () => {
    const client = fakeSupabase({ notary_profiles: null });
    const guard = new RolesGuard(notaryRoute, makeConfig(client));
    await expect(
      guard.canActivate(makeContext({ user: { id: 'u' }, userRole: 'NOTARIO' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed when the verification lookup errors', async () => {
    const client = fakeSupabase({ notaryError: { message: 'boom' } });
    const guard = new RolesGuard(notaryRoute, makeConfig(client));
    await expect(
      guard.canActivate(makeContext({ user: { id: 'u' }, userRole: 'NOTARIO' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a verified NOTARIO', async () => {
    const client = fakeSupabase({ notary_profiles: { is_verified: true } });
    const guard = new RolesGuard(notaryRoute, makeConfig(client));
    const request: Record<string, unknown> = { user: { id: 'u' }, userRole: 'NOTARIO' };
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.notaryVerified).toBe(true);
  });

  it('does not run the notary check for other roles', async () => {
    const client = fakeSupabase({ notary_profiles: { is_verified: false } });
    const guard = new RolesGuard(notaryRoute, makeConfig(client));
    await expect(
      guard.canActivate(makeContext({ user: { id: 'u' }, userRole: 'ADMIN' })),
    ).resolves.toBe(true);
    expect(client.from).not.toHaveBeenCalledWith('notary_profiles');
  });

  it('denies a role that is not in the required list', async () => {
    const client = fakeSupabase({});
    const guard = new RolesGuard(notaryRoute, makeConfig(client));
    await expect(
      guard.canActivate(makeContext({ user: { id: 'u' }, userRole: 'COMPRADOR' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('re-checks is_active when it has to load the profile itself', async () => {
    const client = fakeSupabase({ profiles: { role: 'ADMIN', is_active: false } });
    const guard = new RolesGuard(notaryRoute, makeConfig(client));
    try {
      await guard.canActivate(makeContext({ user: { id: 'u' } }));
      fail('expected ForbiddenException');
    } catch (err) {
      const body = (err as ForbiddenException).getResponse() as { code: string };
      expect(body.code).toBe(ACCOUNT_DISABLED_CODE);
    }
  });
});
