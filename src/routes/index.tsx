import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { KanbanSquare, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/kanban/confirm-dialog";
import { useBoardMutation, useBoards } from "@/hooks/use-kanban";
import { getKanbanService } from "@/services/kanban";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mini Kanban — Boards with AI subtask breakdown" },
      {
        name: "description",
        content:
          "A focused Kanban board: three columns, editable cards, and an assistant that breaks big cards into subtasks you review before saving.",
      },
      { property: "og:title", content: "Mini Kanban — Boards with AI subtask breakdown" },
      {
        property: "og:description",
        content:
          "Create boards, move cards across To Do, In Progress and Done, and turn vague cards into concrete subtasks.",
      },
    ],
  }),
  component: BoardList,
});

function BoardList() {
  const service = getKanbanService();
  const { data: boards, isLoading, isError, refetch } = useBoards();
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createBoard = useBoardMutation((boardName: string) => service.createBoard(boardName), {
    successMessage: "Board created",
  });
  const deleteBoard = useBoardMutation((id: string) => service.deleteBoard(id), {
    successMessage: "Board deleted",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Give your board a name — e.g. Launch MVP.");
      return;
    }
    if (trimmed.length > 120) {
      setFormError("Keep the name under 120 characters.");
      return;
    }
    setFormError(null);
    createBoard.mutate(trimmed, {
      onSuccess: () => setName(""),
      onError: () => setName((v) => v),
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <header className="mb-10">
        <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
          Mini Kanban
        </p>
        <h1 className="mt-2 text-4xl font-bold">Your boards</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Three columns, plain cards, and an assistant that breaks the big ones down for you.
        </p>
      </header>

      <form className="mb-2 flex max-w-md gap-2" onSubmit={submit} noValidate>
        <Input
          value={name}
          placeholder="Board name, e.g. Launch MVP"
          aria-label="New board name"
          aria-invalid={formError ? true : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (formError) setFormError(null);
          }}
        />
        <Button type="submit" disabled={createBoard.isPending}>
          {createBoard.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Create
        </Button>
      </form>
      <div aria-live="polite" className="mb-6 min-h-5">
        {formError ? (
          <p className="text-sm text-destructive">{formError}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Names can be up to 120 characters.</p>
        )}
      </div>

      {isLoading ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading boards">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="rounded-xl border bg-card p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <p className="font-medium">Couldn&apos;t load your boards.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : boards && boards.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li
              key={board.id}
              className="group relative rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md"
            >
              <Link
                to="/boards/$boardId"
                params={{ boardId: board.id }}
                className="block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <h2 className="truncate text-lg font-semibold">{board.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {board.card_count} {board.card_count === 1 ? "card" : "cards"} · Created{" "}
                  {format(new Date(board.created_at), "MMM d, yyyy")}
                </p>
              </Link>
              <ConfirmDialog
                title={`Delete "${board.name}"?`}
                description="Its columns, cards and subtasks are deleted too. This cannot be undone."
                onConfirm={() => deleteBoard.mutate(board.id)}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${board.name}`}
                    className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <span className="mx-auto inline-flex size-11 items-center justify-center rounded-xl bg-muted">
            <KanbanSquare className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <h2 className="mt-4 font-semibold">No boards yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first board above — you&apos;ll get To Do, In Progress and Done columns
            ready to go.
          </p>
        </div>
      )}
    </main>
  );
}
