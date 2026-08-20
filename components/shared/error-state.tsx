import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import { messageFor } from "@/lib/api/errors";

/** Error state for storefront pages and panels: friendly copy from the ApiError. */
export function ErrorState({ error, fallback = "Something went wrong." }: { error: unknown; fallback?: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert className="h-4 w-4" />
      <AlertTitle>Couldn't load</AlertTitle>
      <AlertDescription>{messageFor(error, fallback)}</AlertDescription>
    </Alert>
  );
}