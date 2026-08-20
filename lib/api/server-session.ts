import { cookies } from "next/headers";
import { sessionResponseSchema, type AuthSession, type AuthUser } from "@/lib/types/auth";

/**
 * Server-side session guard for the (account) route segment (architecture.md
 * §7). The layout fetches the backend's authoritative session directly with
 * the forwarded httpOnly cookie — the guard only redirects on a definitive
 * "no session" answer; a backend outage lets the request through and the
 * client hydration surfaces reality (the 401 rehydrate path, §6).
 *
 * Origin resolution (architecture.md §2/§3): API_SERVER_ORIGIN (prod
 * gateway deployments) → NEXT_PUBLIC_API_PROXY → NEXT_PUBLIC_API_BASE →
 * http://localhost:3000 (dev default). This is the ONLY server-side fetch in
 * the app; it lives in lib/api so the "one network boundary" hygiene rule
 * still holds.
 */

function resolveServerOrigin(): string {
  const explicit = process.env.API_SERVER_ORIGIN?.trim();
  if (explicit) return explicit;
  const proxy = process.env.NEXT_PUBLIC_API_PROXY?.trim();
  if (proxy) return proxy;
  const base = process.env.NEXT_PUBLIC_API_BASE?.trim();
  return base ?? "http://localhost:3000";
}

export type ServerSession = { user: AuthUser; session: AuthSession };

export async function getServerSession(): Promise<ServerSession | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let response: Response;
  try {
    response = await fetch(`${resolveServerOrigin().replace(/\/$/, "")}/api/auth/get-session`, {
      headers: {
        Accept: "application/json",
        ...(cookieHeader !== "" ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return null;
  }

  if (response.status === 401 || !response.ok) return null;

  const parsed = sessionResponseSchema.safeParse(await response.json());
  if (!parsed.success) return null;
  if (parsed.data === null || parsed.data.user === null || parsed.data.session === null) return null;

  return { user: parsed.data.user, session: parsed.data.session };
}