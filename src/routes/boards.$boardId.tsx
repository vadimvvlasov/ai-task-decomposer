import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { data: board, isLoading, error } = useBoard(boardId);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const moveCard = useBoardMutation(
    (input: { cardId: string; target_column_id: string; target_position: number }) =>
      service.moveCard(input.cardId, {
        target_column_id: input.target_column_id,
        target_position: input.target_position,
      }),
    { boardId },
  );
  const deleteCard = useBoardMutation((cardId: string) => service.deleteCard(cardId), { boardId });

  if (isLoading) return <p className="p-10 text-muted-foreground">Loading board...</p>;
  if (error || !board)
    return (
      <div className="p-10">
        <p className="text-muted-foreground">That board could not be found.</p>
        <Link to="/" className="mt-4 inline-block underline">
          Back to boards
        </Link>
      </div>
    );

  const openCard =
    board.columns.flatMap((c) => c.cards).find((c) => c.id === openCardId) ?? null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All boards
      </Link>
      <h1 className="mt-3 mb-8 text-3xl font-bold">{board.name}</h1>

      <div className="grid grid-cols-3 gap-5">
        {board.columns.map((column, columnIndex) => (
          <ColumnPanel
            key={column.id}
            column={column}
            boardId={boardId}
            isFirst={columnIndex === 0}
            isLast={columnIndex === board.columns.length - 1}
            onOpenCard={setOpenCardId}
            onMove={(cardId, targetColumnId, targetPosition) =>
              moveCard.mutate({
                cardId,
                target_column_id: targetColumnId,
                target_position: targetPosition,
              })
            }
            onDelete={(cardId) => deleteCard.mutate(cardId)}
            neighbours={{
              prev: board.columns[columnIndex - 1]?.id,
              next: board.columns[columnIndex + 1]?.id,
            }}
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
  boardId,
  isFirst,
  isLast,
  neighbours,
  onOpenCard,
  onMove,
  onDelete,
}: {
  column: Column;
  boardId: string;
  isFirst: boolean;
  isLast: boolean;
  neighbours: { prev?: string | undefined; next?: string | undefined };
  onOpenCard: (cardId: string) => void;
  onMove: (cardId: string, targetColumnId: string, targetPosition: number) => void;
  onDelete: (cardId: string) => void;
}) {
  const service = getKanbanService();
  const [title, setTitle] = useState("");
  const createCard = useBoardMutation(
    (cardTitle: string) => service.createCard(column.id, { title: cardTitle }),
    { boardId },
  );

  return (
    <section className="rounded-xl border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase">{column.name}</h2>
        <span className="text-xs text-muted-foreground">{column.cards.length}</span>
      </header>

      <ul className="space-y-3">
        {column.cards.map((card, index) => (
          <CardTile
            key={card.id}
            card={card}
            canLeft={!isFirst}
            canRight={!isLast}
            canUp={index > 0}
            canDown={index < column.cards.length - 1}
            onOpen={() => onOpenCard(card.id)}
            onDelete={() => onDelete(card.id)}
            onMoveLeft={() => neighbours.prev && onMove(card.id, neighbours.prev, 0)}
            onMoveRight={() => neighbours.next && onMove(card.id, neighbours.next, 0)}
            onMoveUp={() => onMove(card.id, column.id, index - 1)}
            onMoveDown={() => onMove(card.id, column.id, index + 1)}
          />
        ))}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          createCard.mutate(title.trim());
          setTitle("");
        }}
      >
        <Input
          value={title}
          placeholder="Add a card"
          className="h-9"
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" size="icon" variant="secondary" aria-label={`Add card to ${column.name}`}>
          <Plus className="size-4" />
        </Button>
      </form>
    </section>
  );
}

function CardTile({
  card,
  canLeft,
  canRight,
  canUp,
  canDown,
  onOpen,
  onDelete,
  onMoveLeft,
  onMoveRight,
  onMoveUp,
  onMoveDown,
}: {
  card: KanbanCard;
  canLeft: boolean;
  canRight: boolean;
  canUp: boolean;
  canDown: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const done = card.subtasks.filter((s) => s.is_done).length;

  return (
    <li className="rounded-lg border bg-background p-3 shadow-xs">
      <button onClick={onOpen} className="block w-full text-left">
        <span className="font-medium">{card.title}</span>
        {card.description ? (
          <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
            {card.description}
          </span>
        ) : null}
      </button>
      <div className="mt-2 flex items-center gap-2">
        <PriorityBadge priority={card.priority} />
        {card.subtasks.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {done}/{card.subtasks.length} done
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Move left" disabled={!canLeft} onClick={onMoveLeft}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Move up" disabled={!canUp} onClick={onMoveUp}>
          <ChevronUp className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Move down" disabled={!canDown} onClick={onMoveDown}>
          <ChevronDown className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Move right" disabled={!canRight} onClick={onMoveRight}>
          <ChevronRight className="size-4" />
        </Button>
        <ConfirmDialog
          title="Delete this card?"
          description="The card and its subtasks are removed. This cannot be undone."
          onConfirm={onDelete}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Delete card" className="ml-auto">
              <Trash2 className="size-4" />
            </Button>
          }
        />
      </div>
    </li>
  );
}
