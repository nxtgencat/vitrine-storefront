import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Inbox, type LucideIcon } from "lucide-react";

/** Empty state for storefront lists (wishlist, orders, cart, search). */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyContent>
          <EmptyTitle>{title}</EmptyTitle>
          {description !== undefined && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyContent>
      </EmptyHeader>
    </Empty>
  );
}