import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';

/**
 * Minimal PostgREST-shaped double. `tables` holds the row each table returns;
 * `writes` records every update so the assertions can look at what was
 * actually persisted rather than at the return value.
 */
function fakeSupabase(tables: Record<string, unknown>) {
  const writes: Array<{ table: string; payload: unknown }> = [];
  const signOut = jest.fn().mockResolvedValue({ error: null });

  const client = {
    auth: { admin: { signOut } },
    from: (table: string) => {
      const result = { data: tables[table] ?? null, error: null };
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve(result);
      chain.single = () => Promise.resolve(result);
      chain.update = (payload: unknown) => {
        writes.push({ table, payload });
        return chain;
      };
      chain.insert = (payload: unknown) => {
        writes.push({ table, payload });
        return chain;
      };
      return chain;
    },
  };

  return { client, writes, signOut };
}

function service(client: unknown) {
  return new AdminService({ getAdminClient: () => client } as never);
}

const ADMIN_ID = 'admin-1';
const TARGET_ID = 'target-1';

describe('AdminService · role grants (BH-01)', () => {
  it('refuses to let an admin change their own role', async () => {
    const { client } = fakeSupabase({});
    await expect(
      service(client).updateUserRole(ADMIN_ID, 'ADMIN', ADMIN_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to grant NOTARIO when there is no notary application', async () => {
    const { client } = fakeSupabase({
      profiles: { id: TARGET_ID, role: 'COMPRADOR' },
      notary_profiles: null,
    });
    await expect(
      service(client).updateUserRole(TARGET_ID, 'NOTARIO', ADMIN_ID),
    ).rejects.toThrow(/solicitud notarial/i);
  });

  it('refuses to grant NOTARIO before the notary is verified', async () => {
    const { client } = fakeSupabase({
      profiles: { id: TARGET_ID, role: 'COMPRADOR' },
      notary_profiles: { is_verified: false },
    });
    await expect(
      service(client).updateUserRole(TARGET_ID, 'NOTARIO', ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grants NOTARIO once the notary is verified', async () => {
    const { client, writes } = fakeSupabase({
      profiles: { id: TARGET_ID, role: 'NOTARIO' },
      notary_profiles: { is_verified: true },
    });
    await service(client).updateUserRole(TARGET_ID, 'NOTARIO', ADMIN_ID);
    expect(writes).toContainEqual({ table: 'profiles', payload: { role: 'NOTARIO' } });
  });

  it('grants a non-privileged role without extra ceremony', async () => {
    const { client, writes } = fakeSupabase({
      profiles: { id: TARGET_ID, role: 'VENDEDOR' },
    });
    await service(client).updateUserRole(TARGET_ID, 'VENDEDOR', ADMIN_ID);
    expect(writes).toHaveLength(1);
  });
});

describe('AdminService · deactivation (BH-04)', () => {
  it('revokes live sessions when an account is deactivated', async () => {
    const { client, signOut } = fakeSupabase({ profiles: { id: TARGET_ID, is_active: false } });
    await service(client).updateUserActive(TARGET_ID, false, ADMIN_ID);
    // Without this, Supabase keeps minting access tokens from a refresh token
    // that outlives the deactivation and the user never actually loses access.
    expect(signOut).toHaveBeenCalledWith(TARGET_ID, 'global');
  });

  it('does not revoke sessions when re-activating', async () => {
    const { client, signOut } = fakeSupabase({ profiles: { id: TARGET_ID, is_active: true } });
    await service(client).updateUserActive(TARGET_ID, true, ADMIN_ID);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('refuses to let an admin deactivate themselves', async () => {
    const { client } = fakeSupabase({});
    await expect(
      service(client).updateUserActive(ADMIN_ID, false, ADMIN_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AdminService · notary verification (BH-01)', () => {
  it('promotes to NOTARIO when the notary is verified', async () => {
    const { client, writes } = fakeSupabase({
      notary_profiles: { id: 'n1', profile_id: TARGET_ID, is_verified: true },
      profiles: { role: 'COMPRADOR' },
    });
    await service(client).verifyNotary(TARGET_ID, true, ADMIN_ID);
    expect(writes).toContainEqual({
      table: 'notary_profiles',
      payload: { is_verified: true },
    });
    expect(writes).toContainEqual({ table: 'profiles', payload: { role: 'NOTARIO' } });
  });

  it('revokes the role and the sessions when verification is withdrawn', async () => {
    const { client, writes, signOut } = fakeSupabase({
      notary_profiles: { id: 'n1', profile_id: TARGET_ID, is_verified: false },
      profiles: { role: 'NOTARIO' },
    });
    await service(client).verifyNotary(TARGET_ID, false, ADMIN_ID);
    expect(writes).toContainEqual({ table: 'profiles', payload: { role: 'COMPRADOR' } });
    expect(signOut).toHaveBeenCalledWith(TARGET_ID, 'global');
  });
});

describe('AdminService · expediente assignment (BH-01)', () => {
  it('refuses to assign an unverified notary to an expediente', async () => {
    const { client } = fakeSupabase({ notary_profiles: { is_verified: false } });
    await expect(
      service(client).assignExpediente('exp-1', 'notary-1', undefined),
    ).rejects.toThrow(/notarios verificados/i);
  });

  it('assigns a verified notary', async () => {
    const { client } = fakeSupabase({
      notary_profiles: { is_verified: true },
      brc_expedientes: { id: 'exp-1', assigned_notary_id: 'notary-1' },
    });
    await expect(
      service(client).assignExpediente('exp-1', 'notary-1', undefined),
    ).resolves.toMatchObject({ id: 'exp-1' });
  });
});
