import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { data: boards, isLoading } = useBoards();
  const [name, setName] = useState("");

  const createBoard = useBoardMutation((boardName: string) => service.createBoard(boardName), {
    successMessage: "Board created",
  });
  const deleteBoard = useBoardMutation((id: string) => service.deleteBoard(id), {
    successMessage: "Board deleted",
  });

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

      <form
        className="mb-8 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createBoard.mutate(name.trim());
          setName("");
        }}
      >
        <Input
          value={name}
          placeholder="Board name, e.g. Launch MVP"
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={createBoard.isPending}>
          {createBoard.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Create
        </Button>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">Loading boards...</p>
      ) : boards && boards.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li
              key={board.id}
              className="group relative rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <Link to="/boards/$boardId" params={{ boardId: board.id }} className="block">
                <h2 className="text-lg font-semibold">{board.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {board.card_count} {board.card_count === 1 ? "card" : "cards"}
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
                    className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No boards yet. Create your first one above.
        </p>
      )}
    </main>
  );
}
