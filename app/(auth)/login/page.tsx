import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Sign in to view your cart, orders, and addresses. The sign-in form is
        wired up in an upcoming phase.
      </p>
      <p className="mt-6 text-sm">
        New here?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}