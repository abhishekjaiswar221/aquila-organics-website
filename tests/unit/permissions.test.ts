import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, ROLES, adminLinksFor, can, decideAccess, rolesFor, type AdminAction } from "@/lib/access";

const ACTIONS: AdminAction[] = [
  "enquiries.view",
  "enquiries.update",
  "products.edit",
  "products.publish",
  "products.verify",
  "documents.manage",
  "settings.edit",
  "users.manage",
  "audit.view",
];

// Spec section 2, cell by cell. Order of columns: SUPER_ADMIN, ADMINISTRATOR, SALES_MANAGER, CONTENT_EDITOR.
const MATRIX: Record<AdminAction, [boolean, boolean, boolean, boolean]> = {
  "enquiries.view": [true, false, true, false],
  "enquiries.update": [true, false, true, false],
  "products.edit": [true, true, true, true],
  "products.publish": [true, true, true, false],
  "products.verify": [true, false, false, false],
  "documents.manage": [true, true, false, true],
  "settings.edit": [true, true, false, false],
  "users.manage": [true, false, false, false],
  "audit.view": [true, false, false, false],
};
const COLUMNS = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"] as const;

describe("can", () => {
  it("covers all six roles", () => {
    expect([...ROLES].sort()).toEqual(
      ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "SALES_EXECUTIVE", "CONTENT_EDITOR", "HR_MANAGER"].sort(),
    );
  });

  for (const action of ACTIONS) {
    COLUMNS.forEach((role, i) => {
      const allowed = MATRIX[action][i];
      it(`${role} ${allowed ? "may" : "may not"} ${action}`, () => {
        expect(can(role, action)).toBe(allowed);
      });
    });
  }

  it.each(["HR_MANAGER", "SALES_EXECUTIVE"] as const)("%s may do nothing yet", (role) => {
    for (const action of ACTIONS) expect(can(role, action), action).toBe(false);
  });

  it("denies unknown roles and actions", () => {
    expect(can("ROOT" as never, "enquiries.view")).toBe(false);
    expect(can("SUPER_ADMIN", "users.delete" as never)).toBe(false);
    expect(rolesFor("users.delete" as never)).toEqual([]);
  });

  it("rolesFor lists exactly the roles that can", () => {
    for (const action of ACTIONS) {
      expect([...rolesFor(action)].sort(), action).toEqual(ROLES.filter((r) => can(r, action)).sort());
    }
  });
});

describe("adminLinksFor", () => {
  const labels = (role: (typeof ROLES)[number]) => adminLinksFor(role).map((l) => l.label);

  it("gives a content editor only Products", () => {
    expect(labels("CONTENT_EDITOR")).toEqual(["Products"]);
  });

  it("gives sales managers Products and Enquiries, and super admins also the Audit log", () => {
    expect(labels("SALES_MANAGER")).toEqual(["Products", "Enquiries"]);
    expect(labels("SUPER_ADMIN")).toEqual(["Products", "Enquiries", "Audit log"]);
  });

  it("gives non-admin roles no links", () => {
    expect(labels("HR_MANAGER")).toEqual([]);
  });
});

describe("decideAccess", () => {
  it("redirects when there is no session", () => {
    expect(decideAccess(null, ADMIN_ROLES)).toEqual({ kind: "redirect" });
  });

  it.each(["HR_MANAGER", "SALES_EXECUTIVE"])("forbids %s, which has no admin access yet", (role) => {
    expect(decideAccess({ userId: "u1", role }, ADMIN_ROLES)).toEqual({ kind: "forbidden" });
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

  it.each(["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"] as const)(
    "allows %s by default",
    (role) => {
      expect(decideAccess({ userId: "u1", role }, ADMIN_ROLES)).toEqual({ kind: "allow", userId: "u1", role });
    },
  );
});
