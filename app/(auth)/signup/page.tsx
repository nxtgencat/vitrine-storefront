import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Sign up to shop, save items to your wishlist, and track orders. The
        sign-up form is wired up in an upcoming phase.
      </p>
      <p className="mt-6 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}