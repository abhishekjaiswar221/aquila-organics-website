import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLES,
  ROLES,
  adminHomePath,
  adminLinksFor,
  can,
  decideAccess,
  rolesFor,
  type AdminAction,
} from "@/lib/access";

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
  "jobs.manage",
  "applications.view",
  "applications.update",
];

// Spec section 2 (full admin) and section 3 (careers), cell by cell.
// Column order: SUPER_ADMIN, ADMINISTRATOR, SALES_MANAGER, CONTENT_EDITOR, HR_MANAGER.
const MATRIX: Record<AdminAction, [boolean, boolean, boolean, boolean, boolean]> = {
  "enquiries.view": [true, false, true, false, false],
  "enquiries.update": [true, false, true, false, false],
  "products.edit": [true, true, true, true, false],
  "products.publish": [true, true, true, false, false],
  "products.verify": [true, false, false, false, false],
  "documents.manage": [true, true, false, true, false],
  "settings.edit": [true, true, false, false, false],
  "users.manage": [true, false, false, false, false],
  "audit.view": [true, false, false, false, false],
  "jobs.manage": [true, false, false, false, true],
  "applications.view": [true, false, false, false, true],
  "applications.update": [true, false, false, false, true],
};
const COLUMNS = ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR", "HR_MANAGER"] as const;

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

  it("SALES_EXECUTIVE may do nothing yet", () => {
    for (const action of ACTIONS) expect(can("SALES_EXECUTIVE", action), action).toBe(false);
  });

  it("HR_MANAGER may do nothing outside the careers actions", () => {
    const allowed = ACTIONS.filter((a) => can("HR_MANAGER", a)).sort();
    expect(allowed).toEqual(["applications.update", "applications.view", "jobs.manage"]);
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

  it("gives a content editor only Products and Categories", () => {
    expect(labels("CONTENT_EDITOR")).toEqual(["Products", "Categories"]);
  });

  it("gives each admin role the links for the screens it may use", () => {
    expect(labels("SALES_MANAGER")).toEqual(["Products", "Categories", "Enquiries"]);
    expect(labels("ADMINISTRATOR")).toEqual(["Products", "Categories", "Settings"]);
    expect(labels("SUPER_ADMIN")).toEqual([
      "Products",
      "Categories",
      "Enquiries",
      "Jobs",
      "Applications",
      "Settings",
      "Users",
      "Audit log",
    ]);
  });

  it("gives an HR manager exactly Jobs and Applications, with their hrefs", () => {
    expect(adminLinksFor("HR_MANAGER")).toEqual([
      { href: "/admin/jobs", label: "Jobs" },
      { href: "/admin/applications", label: "Applications" },
    ]);
  });

  it("gives a role with no admin access no links", () => {
    expect(labels("SALES_EXECUTIVE")).toEqual([]);
  });
});

describe("adminHomePath", () => {
  it("opens the applications inbox for HR and Products for every other admin role", () => {
    expect(adminHomePath("HR_MANAGER")).toBe("/admin/applications");
    for (const role of ["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR"] as const) {
      expect(adminHomePath(role), role).toBe("/admin/products");
    }
  });
});

describe("decideAccess", () => {
  it("redirects when there is no session", () => {
    expect(decideAccess(null, ADMIN_ROLES)).toEqual({ kind: "redirect" });
  });

  it("forbids SALES_EXECUTIVE, which has no admin access yet", () => {
    expect(decideAccess({ userId: "u1", role: "SALES_EXECUTIVE" }, ADMIN_ROLES)).toEqual({ kind: "forbidden" });
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

  it.each(["SUPER_ADMIN", "ADMINISTRATOR", "SALES_MANAGER", "CONTENT_EDITOR", "HR_MANAGER"] as const)(
    "allows %s by default",
    (role) => {
      expect(decideAccess({ userId: "u1", role }, ADMIN_ROLES)).toEqual({ kind: "allow", userId: "u1", role });
    },
  );
});
