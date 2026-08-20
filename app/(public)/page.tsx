export default function PublicHomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Shop the catalog
        </h1>
        <p className="max-w-[60ch] text-base leading-relaxed text-muted-foreground">
          Browse the store&apos;s catalog, add to your cart, and check out. The
          catalog view is wired up in an upcoming phase.
        </p>
      </div>
    </div>
  );
}