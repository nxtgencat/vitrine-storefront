"use client";

import { create } from "zustand";

import { messageFor } from "@/lib/api/errors";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { getSession, signIn as apiSignIn, signOut as apiSignOut, signUp as apiSignUp } from "@/lib/api/requests";
import { logger } from "@/lib/logger";

/**
 * The customer session store (architecture.md §7). One hydrate path: better-
 * auth session → `{ userId, name, email }`. The storefront never needs
 * `customerId` client-side — every `C`-guarded call resolves it server-side.
 * On 401 mid-request, lib/api asks this store to rehydrate once.
 */

export type SessionStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

export type Actor = {
  userId: string;
  name: string;
  email: string;
};

export type SignInResult = { ok: true } | { ok: false; message: string };

type SessionState = {
  status: SessionStatus;
  actor: Actor | null;
  error: string | null;
  hydratedAt: number | null;
  hydrate: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (name: string, email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  reset: () => void;
};

async function buildActor(): Promise<Actor | null> {
  const session = await getSession();
  if (session === null || session.user === null || session.session === null) return null;
  return { userId: session.user.id, name: session.user.name, email: session.user.email };
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  status: "idle",
  actor: null,
  error: null,
  hydratedAt: null,

  hydrate: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const actor = await buildActor();
      if (actor === null) {
        set({ status: "unauthenticated", actor: null, error: null, hydratedAt: Date.now() });
        return;
      }
      set({ status: "authenticated", actor, error: null, hydratedAt: Date.now() });
    } catch (err) {
      logger.error("session hydrate failed", { error: String(err) });
      set({ status: "unauthenticated", actor: null, error: messageFor(err, "Couldn't load your session."), hydratedAt: Date.now() });
    }
  },

  signIn: async (email, password) => {
    try {
      await apiSignIn({ email, password });
      await get().hydrate();
      return get().status === "authenticated" ? { ok: true } : { ok: false, message: "This account has no customer profile." };
    } catch (err) {
      logger.warn("sign-in failed", { error: String(err) });
      return { ok: false, message: messageFor(err, "Couldn't sign in. Check your email and password.") };
    }
  },

  signUp: async (name, email, password) => {
    try {
      await apiSignUp({ name, email, password });
      await get().hydrate();
      return get().status === "authenticated" ? { ok: true } : { ok: false, message: "Couldn't start your session." };
    } catch (err) {
      logger.warn("sign-up failed", { error: String(err) });
      return { ok: false, message: messageFor(err, "Couldn't create your account. Try a different email.") };
    }
  },

  signOut: async () => {
    try {
      await apiSignOut();
    } catch (err) {
      logger.warn("sign-out failed", { error: String(err) });
    } finally {
      get().reset();
    }
  },

  reset: () => set({ status: "unauthenticated", actor: null, error: null, hydratedAt: null }),
}));

let rehydrating = false;

/**
 * Registered into lib/api: a 401 on a guarded request means the session is
 * stale — rehydrate once, retry the request if that restored the session,
 * otherwise send the customer back to the login page.
 */
setUnauthorizedHandler(async () => {
  if (rehydrating) return false;
  rehydrating = true;
  try {
    await useSessionStore.getState().hydrate();
    if (useSessionStore.getState().status === "authenticated") return true;
    if (typeof window !== "undefined") {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.assign(`/login?next=${next}`);
    }
    return false;
  } finally {
    rehydrating = false;
  }
});