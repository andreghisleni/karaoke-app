/** biome-ignore-all lint/a11y/noStaticElementInteractions: test */
/** biome-ignore-all lint/nursery/noNoninteractiveElementInteractions: test */
import { cn } from "@/lib/utils";

export function ActionsDiv({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  function stopPropagation(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.stopPropagation();
  }

  return (
    <div
      className={cn(
        "flex gap-2",
        className
      )}
      onDoubleClick={stopPropagation}
      {...props}
    />
  );
}
