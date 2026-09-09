import { cn } from "@/lib/utils";
import type { Priority } from "@/services/kanban";

const STYLES: Record<Priority, string> = {
  LOW: "bg-priority-low/15 text-priority-low",
  MEDIUM: "bg-priority-medium/20 text-priority-medium",
  HIGH: "bg-priority-high/15 text-priority-high",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        STYLES[priority],
        className,
      )}
    >
      {priority.toLowerCase()}
    </span>
  );
}
