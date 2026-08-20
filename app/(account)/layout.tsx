import { redirect } from "next/navigation";

import { RealtimeIndicator } from "@/components/account/realtime-indicator";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getServerSession } from "@/lib/api/server-session";

/**
 * The authenticated shell's server-side session guard (architecture.md §7).
 * No session → /login; the client 401 rehydrate path is the one that
 * carries `next` (it redirects from the browser, which knows the URL — a
 * layout cannot see the pathname). On a backend outage the guard lets the
 * render through rather than locking customers out. The shell also mounts
 * the live indicator (architecture.md §11): it opens the realtime channel
 * and shows its connection state above the page content.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (session === null) {
    redirect("/login");
  }
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex justify-end pb-2">
          <RealtimeIndicator />
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}