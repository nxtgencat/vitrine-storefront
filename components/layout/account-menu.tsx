"use client";

import { useEffect } from "react";

import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, MapPin, Package, ShoppingBag } from "lucide-react";
import { useSessionStore } from "@/stores/use-session";

/**
 * Header identity (architecture.md §7): an account menu with the customer's
 * name and email plus sign-out when authenticated, and a plain sign-in
 * button when not. Hydrates the session store on mount so a fresh page load
 * reflects the real session — the client-side re-check behind the server
 * guard (a server layout cannot see the pathname, so `next`-carrying
 * redirects happen here, from the 401 rehydrate path in use-session.ts).
 */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AccountMenu() {
  const status = useSessionStore((state) => state.status);
  const actor = useSessionStore((state) => state.actor);
  const signOut = useSessionStore((state) => state.signOut);
  const hydrate = useSessionStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (status === "idle" || status === "loading") {
    return <span className="inline-flex h-7 items-center px-2 text-sm text-muted-foreground" aria-hidden />;
  }

  if (status !== "authenticated" || actor === null) {
    return (
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
        Sign in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-6" data-size="sm">
          <AvatarFallback>{initialsOf(actor.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate font-medium sm:inline">{actor.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{actor.name}</span>
            <span className="text-xs font-normal text-muted-foreground">{actor.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/cart" />}>
            <ShoppingBag />
            Your cart
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/orders" />}>
            <Package />
            Your orders
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/addresses" />}>
            <MapPin />
            Addresses
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}