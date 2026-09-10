import { Link } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";

export function AppHeader({ breadcrumb }: { breadcrumb?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md font-display text-base font-bold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KanbanSquare className="size-4" aria-hidden />
          </span>
          Mini Kanban
        </Link>
        {breadcrumb ? (
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
          >
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="truncate">{breadcrumb}</span>
          </nav>
        ) : null}
        <span className="ml-auto hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          Mock backend ready
        </span>
      </div>
    </header>
  );
}
