import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CircleDashed,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/kanban/confirm-dialog";
import { PriorityBadge } from "@/components/kanban/priority-badge";
import { CardDetailDialog } from "@/components/kanban/card-detail-dialog";
import { useBoard, useBoardMutation } from "@/hooks/use-kanban";
import { getKanbanService, type Card as KanbanCard, type Column } from "@/services/kanban";

export const Route = createFileRoute("/boards/$boardId")({
  head: () => ({
    meta: [
      { title: "Board — Mini Kanban" },
      {
        name: "description",
        content:
          "Move cards across To Do, In Progress and Done, edit details, and break big cards into reviewable subtasks.",
      },
      { property: "og:title", content: "Board — Mini Kanban" },
      {
        property: "og:description",
        content: "Three columns, editable cards, and AI-suggested subtasks you approve first.",
      },
    ],
  }),
  component: BoardView,
});

function BoardView() {
  const { boardId } = Route.useParams();
  const service = getKanbanService();
  const { data: board, isLoading, isError, refetch } = useBoard(boardId);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const moveCard = useBoardMutation(
    (input: { cardId: string; target_column_id: string; target_position: number }) =>
      service.moveCard(input.cardId, {
        target_column_id: input.target_column_id,
        target_position: input.target_position,
      }),
    { boardId },
  );
  const deleteCard = useBoardMutation((cardId: string) => service.deleteCard(cardId), { boardId });
  const renameBoard = useBoardMutation((name: string) => service.renameBoard(boardId, name), {
    boardId,
    successMessage: "Board renamed",
  });

  useEffect(() => {
    if (board) setRenameValue(board.name);
    // Intentional: sync only when the board name changes remotely,
    // so typing in the rename input is not clobbered on refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.name]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10" aria-label="Loading board">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-8 w-64" />
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[0, 1, 2].map((c) => (
            <div key={c} className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="mt-3 h-20 w-full" />
              <Skeleton className="mt-3 h-9 w-full" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (isError || !board)
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <span className="mx-auto inline-flex size-11 items-center justify-center rounded-xl bg-muted">
          <CircleDashed className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">That board could not be found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been deleted. Pick another board or create a new one.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
          <Button asChild>
            <Link to="/">Back to boards</Link>
          </Button>
        </div>
      </main>
    );

  const openCard = board.columns.flatMap((c) => c.cards).find((c) => c.id === openCardId) ?? null;

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Board needs a name.");
      return;
    }
    if (trimmed.length > 120) {
      setRenameError("Keep the name under 120 characters.");
      return;
    }
    if (trimmed === board.name) {
      setRenaming(false);
      return;
    }
    setRenameError(null);
    renameBoard.mutate(trimmed, { onSuccess: () => setRenaming(false) });
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden /> All boards
      </Link>

      <div className="mt-3 mb-8 flex flex-wrap items-center gap-3">
        {renaming ? (
          <div className="flex items-center gap-2">
            <Input
              value={renameValue}
              autoFocus
              aria-label="Board name"
              className="h-9 w-64"
              onChange={(e) => {
                setRenameValue(e.target.value);
                if (renameError) setRenameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setRenameValue(board.name);
                }
              }}
            />
            <Button
              size="icon"
              variant="secondary"
              aria-label="Save board name"
              disabled={renameBoard.isPending}
              onClick={submitRename}
            >
              {renameBoard.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Cancel rename"
              onClick={() => {
                setRenaming(false);
                setRenameValue(board.name);
                setRenameError(null);
              }}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{board.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Rename ${board.name}`}
              onClick={() => {
                setRenameValue(board.name);
                setRenameError(null);
                setRenaming(true);
              }}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>
      {renameError ? (
        <p className="mb-6 text-sm text-destructive" role="alert">
          {renameError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {board.columns.map((column) => (
          <ColumnPanel
            key={column.id}
            column={column}
            columns={board.columns}
            boardId={boardId}
            onOpenCard={setOpenCardId}
            onMove={(cardId, targetColumnId, targetPosition) =>
              moveCard.mutate({
                cardId,
                target_column_id: targetColumnId,
                target_position: targetPosition,
              })
            }
            onDelete={(cardId) => deleteCard.mutate(cardId)}
          />
        ))}
      </div>

      <CardDetailDialog
        card={openCard}
        boardId={boardId}
        open={openCard !== null}
        onOpenChange={(open) => !open && setOpenCardId(null)}
      />
    </main>
  );
}

function ColumnPanel({
  column,
  columns,
  boardId,
  onOpenCard,
  onMove,
  onDelete,
}: {
  column: Column;
  columns: Column[];
  boardId: string;
  onOpenCard: (cardId: string) => void;
  onMove: (cardId: string, targetColumnId: string, targetPosition: number) => void;
  onDelete: (cardId: string) => void;
}) {
  const service = getKanbanService();
  const [title, setTitle] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const createCard = useBoardMutation(
    (cardTitle: string) => service.createCard(column.id, { title: cardTitle }),
    { boardId },
  );

  const submitCard = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setCardError("Give the card a title first.");
      return;
    }
    if (trimmed.length > 200) {
      setCardError("Keep the title under 200 characters.");
      return;
    }
    setCardError(null);
    createCard.mutate(trimmed, { onSuccess: () => setTitle("") });
  };

  return (
    <section className="flex flex-col rounded-xl border bg-card p-4" aria-label={column.name}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase">{column.name}</h2>
        <span
          className="inline-flex min-w-7 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
          aria-label={`${column.cards.length} cards in ${column.name}`}
        >
          {column.cards.length}
        </span>
      </header>

      {column.cards.length === 0 ? (
        <p className="mb-3 rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No cards yet — add the first one below.
        </p>
      ) : (
        <ul className="space-y-3">
          {column.cards.map((card, index) => (
            <CardTile
              key={card.id}
              card={card}
              columns={columns}
              index={index}
              totalInColumn={column.cards.length}
              onOpen={() => onOpenCard(card.id)}
              onDelete={() => onDelete(card.id)}
              onMove={onMove}
            />
          ))}
        </ul>
      )}

      <form className="mt-3" onSubmit={submitCard} noValidate>
        <div className="flex gap-2">
          <Input
            value={title}
            placeholder="Add a card"
            className="h-9"
            aria-label={`Add card to ${column.name}`}
            aria-invalid={cardError ? true : undefined}
            onChange={(e) => {
              setTitle(e.target.value);
              if (cardError) setCardError(null);
            }}
          />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            aria-label={`Add card to ${column.name}`}
            disabled={createCard.isPending}
          >
            {createCard.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
          </Button>
        </div>
        {cardError ? (
          <p className="mt-1.5 text-xs text-destructive" role="alert">
            {cardError}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function CardTile({
  card,
  columns,
  index,
  totalInColumn,
  onOpen,
  onDelete,
  onMove,
}: {
  card: KanbanCard;
  columns: Column[];
  index: number;
  totalInColumn: number;
  onOpen: () => void;
  onDelete: () => void;
  onMove: (cardId: string, targetColumnId: string, targetPosition: number) => void;
}) {
  const done = card.subtasks.filter((s) => s.is_done).length;
  const total = card.subtasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <li className="rounded-lg border bg-background p-3 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md">
      <button
        onClick={onOpen}
        className="block w-full rounded text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="font-medium">{card.title}</span>
        {card.description ? (
          <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
            {card.description}
          </span>
        ) : null}
      </button>
      <div className="mt-2 flex items-center gap-2">
        <PriorityBadge priority={card.priority} />
        {total > 0 ? (
          <span
            className="text-xs text-muted-foreground"
            aria-label={`${done} of ${total} subtasks done`}
          >
            {done}/{total} done
          </span>
        ) : null}
      </div>
      {total > 0 ? (
        <Progress
          value={progress}
          className="mt-2 h-1.5"
          aria-label={`Subtask progress ${progress}%`}
        />
      ) : null}
      <div className="mt-2 flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Move ${card.title}`}>
              <MoreHorizontal className="size-4" aria-hidden />
              Move
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Move to column</DropdownMenuLabel>
            {columns.map((col) => (
              <DropdownMenuItem
                key={col.id}
                disabled={col.id === card.column_id}
                onSelect={() => onMove(card.id, col.id, 0)}
              >
                {col.name}
                {col.id === card.column_id ? " (current)" : ""}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Reorder in column</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() => onMove(card.id, card.column_id, index - 1)}
            >
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index >= totalInColumn - 1}
              onSelect={() => onMove(card.id, card.column_id, index + 1)}
            >
              Move down
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmDialog
          title="Delete this card?"
          description="The card and its subtasks are removed. This cannot be undone."
          onConfirm={onDelete}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${card.title}`}
              className="ml-auto"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          }
        />
      </div>
    </li>
  );
}
