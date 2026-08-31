import { ForbiddenException } from '@nestjs/common';
import {
  ProfilesService,
  assertNoProtectedProfileFields,
} from './profiles.service';
import { DEFAULT_SIGNUP_ROLE } from '../../common/constants/roles';

function fakeSupabase() {
  const writes: Array<{ table: string; op: string; payload: unknown }> = [];
  const client = {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.single = () =>
        Promise.resolve({ data: { id: 'u', role: DEFAULT_SIGNUP_ROLE }, error: null });
      chain.insert = (payload: unknown) => {
        writes.push({ table, op: 'insert', payload });
        return chain;
      };
      chain.update = (payload: unknown) => {
        writes.push({ table, op: 'update', payload });
        return chain;
      };
      return chain;
    },
  };
  return { client, writes };
}

function service(client: unknown) {
  return new ProfilesService({ getAdminClient: () => client } as never);
}

describe('ProfilesService · self-service privilege escalation (BH-01)', () => {
  it('rejects an attempt to change your own role', async () => {
    const { client } = fakeSupabase();
    await expect(
      service(client).updateProfile('u', { role: 'ADMIN' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an attempt to reactivate your own account', async () => {
    const { client } = fakeSupabase();
    await expect(
      service(client).updateProfile('u', { is_active: true } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['role', 'is_active', 'kyc_status', 'company_id', 'id', 'email'])(
    'names the offending field %s so the user knows what was refused',
    (field) => {
      expect(() => assertNoProtectedProfileFields({ [field]: 'x' })).toThrow(
        new RegExp(field),
      );
    },
  );

  it('still allows the ordinary profile fields', async () => {
    const { client, writes } = fakeSupabase();
    await service(client).updateProfile('u', {
      first_name: 'Ana',
      last_name: 'Lopez',
      phone: '+52 55 1234 5678',
    });
    const payload = writes[0]?.payload as Record<string, unknown>;
    expect(payload.first_name).toBe('Ana');
    expect(payload.role).toBeUndefined();
  });

  it('forces the default role on profile creation, whatever was sent', async () => {
    const { client, writes } = fakeSupabase();
    await service(client).createProfile({
      id: 'u',
      email: 'a@b.com',
      // A future DTO change (or a loosened ValidationPipe) must not be enough
      // to make this land in the database.
      role: 'ADMIN',
    } as never);
    const payload = writes[0]?.payload as Record<string, unknown>;
    expect(payload.role).toBe(DEFAULT_SIGNUP_ROLE);
  });
});
