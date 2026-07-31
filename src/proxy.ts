// Gate the whole app behind Microsoft sign-in. This is Next 16's `proxy`
// convention (formerly `middleware`). The `auth` export applies the `authorized`
// callback from src/auth.ts to every matched request: no session → redirect to
// the Microsoft sign-in. Server Actions POST to page routes, so they are covered
// by the same matcher (defence in depth lives in currentAuthor()).
export { auth as proxy } from "@/auth";

export const config = {
  // Run on everything except the Auth.js endpoints (else infinite redirect),
  // Next internals, and static assets (.png covers the logo + app icon).
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\.png$|favicon.ico).*)"],
};
