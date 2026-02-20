import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

// Use the browser origin when available so client code posts to the same
// host that serves the app. This avoids hard-coded "http://localhost:3000"
// which was inlined at build time and caused requests to target localhost.
const runtimeBaseUrl = (() => {
  if (typeof window !== "undefined") {
    return (
      (process.env.NEXT_PUBLIC_BASE_URL as string) || window.location.origin
    );
  }
  // Server-side fallback used during build/SSR
  return (
    (process.env.NEXT_PUBLIC_BASE_URL as string) || "http://localhost:3000"
  );
})();

export const authClient = createAuthClient({
  baseURL: runtimeBaseUrl,
  plugins: [adminClient()],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  resetPassword,
  updateUser,
  changeEmail,
  changePassword,
} = authClient;
