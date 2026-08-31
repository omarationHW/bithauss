import { describe, it, expect } from "vitest";
import {
  loginErrorMessage,
  signupErrorMessage,
  LOGIN_INVALID_CREDENTIALS,
  LOGIN_EMAIL_NOT_CONFIRMED,
  LOGIN_RATE_LIMITED,
  SIGNUP_INVALID_EMAIL,
  MIN_PASSWORD_LENGTH,
} from "./auth-messages";

describe("login copy (BH-21)", () => {
  it("gives the SAME answer for a wrong password and an unknown account", () => {
    const wrongPassword = loginErrorMessage("Invalid login credentials");
    const unknownAccount = loginErrorMessage("User not found");
    expect(wrongPassword).toBe(LOGIN_INVALID_CREDENTIALS);
    expect(unknownAccount).toBe(LOGIN_INVALID_CREDENTIALS);
    expect(wrongPassword).toBe(unknownAccount);
  });

  it("never leaks whether an address is registered", () => {
    for (const raw of [
      "Invalid login credentials",
      "User not found",
      "user with this email does not exist",
    ]) {
      expect(loginErrorMessage(raw)).not.toMatch(/registrad|existe|cuenta no/i);
    }
  });

  it("still distinguishes the states the user can act on", () => {
    expect(loginErrorMessage("Email not confirmed")).toBe(LOGIN_EMAIL_NOT_CONFIRMED);
    expect(loginErrorMessage("email rate limit exceeded")).toBe(LOGIN_RATE_LIMITED);
  });
});

describe("signup copy (BH-21)", () => {
  it("treats an already-registered address as the success path", () => {
    for (const raw of [
      "User already registered",
      "A user with this email address has already been registered",
      "user already exists",
    ]) {
      expect(signupErrorMessage(raw)).toBeNull();
    }
  });

  it("does not tell the caller the account exists", () => {
    const message = signupErrorMessage("User already registered");
    expect(message).toBeNull(); // caller renders "revisa tu correo"
  });

  it("still reports genuine input problems", () => {
    expect(signupErrorMessage("Unable to validate email address")).toBe(
      SIGNUP_INVALID_EMAIL,
    );
    expect(signupErrorMessage("Password should be at least 6 characters")).toMatch(
      /contraseña/i,
    );
  });
});

describe("password policy (BH-22)", () => {
  it("requires more than Supabase's 6-character default", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});
