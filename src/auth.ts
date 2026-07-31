import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Single sign-on against the company's Microsoft Entra ID (Azure AD) tenant —
 * i.e. employees sign in with the same Microsoft account they use for M365.
 *
 * - **Single-tenant.** `AUTH_MICROSOFT_ENTRA_ID_ISSUER` pins sign-in to your
 *   directory, so only people in your organisation can get in.
 * - **No database.** Sessions are JWTs held in an encrypted cookie (signed with
 *   `AUTH_SECRET`), which fits Compass's "git as store" design — there is no
 *   user table to provision.
 * - **The whole app is gated** by `middleware.ts`, which uses the `authorized`
 *   callback below. Reads and writes both require a signed-in employee.
 *
 * Configuration lives entirely in env vars (see `.env.example`); Auth.js reads
 * `AUTH_SECRET` and `AUTH_TRUST_HOST` automatically.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  callbacks: {
    // Gate every matched route (see middleware.ts): no session → Auth.js bounces
    // the request to the Microsoft sign-in.
    authorized: ({ auth }) => !!auth,
    // Entra work accounts don't reliably emit an `email` claim; the UPN in
    // `preferred_username` is the dependable address. Pin a real name + email
    // onto the token so git commit attribution (the change-history view) is
    // meaningful instead of "unknown".
    jwt({ token, profile }) {
      if (profile) {
        token.name = profile.name ?? token.name;
        token.email =
          profile.email ??
          (profile as { preferred_username?: string }).preferred_username ??
          token.email;
      }
      return token;
    },
  },
});
