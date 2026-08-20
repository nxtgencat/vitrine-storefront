"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNext } from "@/lib/domain/lists";
import { useSessionStore } from "@/stores/use-session";

/**
 * Full sign-in form (todo.md phase 2): controlled fields validated with the
 * request zod schema, per-field errors on submit, the API's own message on
 * failure (architecture.md §6 — better-auth error bodies surface verbatim),
 * and a redirect to `next` — honored only for internal paths (never an
 * external or protocol-relative URL).
 */

const loginFormSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof loginFormSchema>, string>>;

export default function LoginPage() {
  const router = useRouter();
  const signIn = useSessionStore((state) => state.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((previous) => {
      if (previous[field] === undefined) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") nextErrors[field as keyof FieldErrors] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    setBusy(true);
    const result = await signIn(parsed.data.email, parsed.data.password);
    setBusy(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    router.replace(next ?? "/");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Sign in to view your cart, orders, and addresses.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
              aria-invalid={fieldErrors.email !== undefined}
              aria-describedby={fieldErrors.email !== undefined ? "email-error" : undefined}
            />
            {fieldErrors.email !== undefined && (
              <p id="email-error" className="text-destructive text-sm">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
              aria-invalid={fieldErrors.password !== undefined}
              aria-describedby={fieldErrors.password !== undefined ? "password-error" : undefined}
            />
            {fieldErrors.password !== undefined && (
              <p id="password-error" className="text-destructive text-sm">
                {fieldErrors.password}
              </p>
            )}
          </div>
          {formError !== null && <p className="text-destructive text-sm">{formError}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-sm">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}