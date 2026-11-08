import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, ROLES, can, decideAccess, type AdminAction } from "@/lib/access";

const ACTIONS: AdminAction[] = ["products.publish", "enquiries.view", "enquiries.update"];

const expected: Record<(typeof ROLES)[number], boolean> = {
  SUPER_ADMIN: true,
  ADMINISTRATOR: false,
  SALES_MANAGER: true,
  SALES_EXECUTIVE: false,
  CONTENT_EDITOR: false,
  HR_MANAGER: false,
};

describe("can", () => {
  it("covers all six roles", () => {
    expect([...ROLES].sort()).toEqual(Object.keys(expected).sort());
  });

  for (const role of ROLES) {
    for (const action of ACTIONS) {
      it(`${role} ${expected[role] ? "may" : "may not"} ${action}`, () => {
        expect(can(role, action)).toBe(expected[role]);
      });
    }
  }

  it("denies unknown roles and actions", () => {
    expect(can("ROOT" as never, "enquiries.view")).toBe(false);
    expect(can("SUPER_ADMIN", "users.delete" as never)).toBe(false);
  });
});

describe("decideAccess", () => {
  it("redirects when there is no session", () => {
    expect(decideAccess(null, ADMIN_ROLES)).toEqual({ kind: "redirect" });
  });

  it("forbids a signed-in user whose role is not allowed", () => {
    expect(decideAccess({ userId: "u1", role: "CONTENT_EDITOR" }, ADMIN_ROLES)).toEqual({
      kind: "forbidden",
    });
  });

  it("forbids a role outside the narrowed allow-list", () => {
    expect(decideAccess({ userId: "u1", role: "SALES_MANAGER" }, ["SUPER_ADMIN"])).toEqual({
      kind: "forbidden",
    });
  });

  it("forbids a missing or unrecognised role", () => {
    expect(decideAccess({ userId: "u1", role: undefined }, ADMIN_ROLES)).toEqual({ kind: "forbidden" });
    expect(decideAccess({ userId: "u1", role: "ROOT" }, ADMIN_ROLES)).toEqual({ kind: "forbidden" });
  });

  it("forbids everyone when the allow-list is empty", () => {
    expect(decideAccess({ userId: "u1", role: "SUPER_ADMIN" }, [])).toEqual({ kind: "forbidden" });
  });

  it.each(["SUPER_ADMIN", "SALES_MANAGER"] as const)("allows %s by default", (role) => {
    expect(decideAccess({ userId: "u1", role }, ADMIN_ROLES)).toEqual({
      kind: "allow",
      userId: "u1",
      role,
    });
  });
});
