import {
  SELF_ASSIGNABLE_ROLES,
  PRIVILEGED_ROLES,
  sanitizeSignupRole,
  isPrivilegedRole,
  DEFAULT_SIGNUP_ROLE,
} from './roles';

describe('role taxonomy (BH-01)', () => {
  it('never lets a privileged role be self-assigned at signup', () => {
    for (const role of PRIVILEGED_ROLES) {
      expect(sanitizeSignupRole(role)).toBe(DEFAULT_SIGNUP_ROLE);
      expect(sanitizeSignupRole(role.toLowerCase())).toBe(DEFAULT_SIGNUP_ROLE);
      expect(sanitizeSignupRole(` ${role} `)).toBe(DEFAULT_SIGNUP_ROLE);
    }
  });

  it('keeps the self-assignable roles working', () => {
    for (const role of SELF_ASSIGNABLE_ROLES) {
      expect(sanitizeSignupRole(role)).toBe(role);
      expect(sanitizeSignupRole(role.toLowerCase())).toBe(role);
    }
  });

  it('collapses unknown or malformed input to the default role', () => {
    for (const value of [undefined, null, 42, {}, '', 'SUPERADMIN', "'; drop table"]) {
      expect(sanitizeSignupRole(value)).toBe(DEFAULT_SIGNUP_ROLE);
    }
  });

  it('does not overlap the two sets', () => {
    for (const role of SELF_ASSIGNABLE_ROLES) {
      expect(isPrivilegedRole(role)).toBe(false);
    }
    for (const role of PRIVILEGED_ROLES) {
      expect(isPrivilegedRole(role)).toBe(true);
    }
  });
});
