import Link from "next/link";

const accountLinks = [
  { href: "/cart", label: "Cart" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/addresses", label: "Addresses" },
  { href: "/orders", label: "Orders" },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div>
          <p className="flex items-center gap-2 font-semibold tracking-tight">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-primary" />
            Vitrine
          </p>
          <p className="mt-1 max-w-[40ch] text-sm leading-relaxed text-muted-foreground">
            Your account — cart, wishlist, addresses, and orders.
          </p>
        </div>
        <nav aria-label="Account" className="flex flex-col gap-2 text-sm">
          {accountLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Vitrine</span>
          <span>Prices in INR</span>
        </div>
      </div>
    </footer>
  );
}