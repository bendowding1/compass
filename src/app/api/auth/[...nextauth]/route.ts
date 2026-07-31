import { handlers } from "@/auth";

// Auth.js sign-in / callback / sign-out endpoints (e.g. the Microsoft callback
// at /api/auth/callback/microsoft-entra-id). Excluded from the middleware gate.
export const { GET, POST } = handlers;
