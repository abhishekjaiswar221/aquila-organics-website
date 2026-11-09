import { createAuthClient } from "better-auth/react";

// Same-origin client: no base URL (and so no NEXT_PUBLIC_ variable) needed.
// There is deliberately no sign-up export; accounts come from `seed:admin`.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
