import { describe, it, expect } from "vitest";
import {
  isAccountDisabledResponse,
  ACCOUNT_DISABLED_CODE,
} from "./account-status";

describe("account status detection (BH-04)", () => {
  it("recognises the API's deactivation response", () => {
    expect(
      isAccountDisabledResponse(403, {
        statusCode: 403,
        code: ACCOUNT_DISABLED_CODE,
        message: "Tu cuenta está desactivada.",
      }),
    ).toBe(true);
  });

  it("does not confuse an ordinary permission denial with a deactivation", () => {
    // Signing the user out on every 403 would log people out for merely
    // opening a page their role cannot see.
    expect(
      isAccountDisabledResponse(403, { statusCode: 403, message: "Forbidden" }),
    ).toBe(false);
    expect(
      isAccountDisabledResponse(403, { code: "NOTARY_NOT_VERIFIED" }),
    ).toBe(false);
  });

  it("ignores other status codes and malformed bodies", () => {
    expect(isAccountDisabledResponse(401, { code: ACCOUNT_DISABLED_CODE })).toBe(false);
    expect(isAccountDisabledResponse(403, null)).toBe(false);
    expect(isAccountDisabledResponse(403, "nope")).toBe(false);
  });
});
