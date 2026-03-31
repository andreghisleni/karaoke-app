import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

export function InputSkeleton({ className }: { className?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={cn("h-8 w-60", className)} />
    </div>
  );
}
