import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/kanban/confirm-dialog";
import { AiProposalDialog } from "@/components/kanban/ai-proposal-dialog";
import { useBoardMutation } from "@/hooks/use-kanban";
import { getKanbanService, type Card as KanbanCard, type Priority } from "@/services/kanban";

interface Props {
  card: KanbanCard | null;
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardDetailDialog({ card, boardId, open, onOpenChange }: Props) {
  const service = getKanbanService();
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const cardId = card?.id;
  useEffect(() => {
    if (card && open) {
      setTitle(card.title);
      setTitleError(null);
      setDescription(card.description ?? "");
      setNewSubtask("");
      setSubtaskError(null);
    }
    // Intentional: sync only on card switch / open, not on every refetch,
    // so in-progress edits are not clobbered while mutations re-read the board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, open]);

  const updateCard = useBoardMutation(
    (input: { title?: string; description?: string | null; priority?: Priority }) =>
      service.updateCard(card!.id, input),
    { boardId },
  );
  const addSubtask = useBoardMutation(
    (text: string) => service.bulkCreateSubtasks(card!.id, { subtasks: [{ title: text }] }),
    { boardId },
  );
  const acceptProposal = useBoardMutation(
    (input: { titles: string[]; priority: Priority }) =>
      service.bulkCreateSubtasks(card!.id, {
        subtasks: input.titles.map((t) => ({ title: t })),
        origin: "AI",
        priority: input.priority,
      }),
    { boardId, successMessage: "Subtasks added" },
  );
  const toggleSubtask = useBoardMutation(
    (input: { id: string; is_done: boolean }) =>
      service.updateSubtask(input.id, { is_done: input.is_done }),
    { boardId },
  );
  const renameSubtask = useBoardMutation(
    (input: { id: string; title: string }) =>
      service.updateSubtask(input.id, { title: input.title }),
    { boardId },
  );
  const removeSubtask = useBoardMutation((id: string) => service.deleteSubtask(id), { boardId });

  if (!card) return null;
  const done = card.subtasks.filter((s) => s.is_done).length;

  const blurSaveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Card needs a title.");
      return;
    }
    if (trimmed.length > 200) {
      setTitleError("Keep the title under 200 characters.");
      return;
    }
    setTitleError(null);
    if (trimmed !== card.title) updateCard.mutate({ title: trimmed });
  };

  const submitSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubtask.trim();
    if (!trimmed) {
      setSubtaskError("Write a subtask first.");
      return;
    }
    if (trimmed.length > 200) {
      setSubtaskError("Keep subtasks under 200 characters.");
      return;
    }
    setSubtaskError(null);
    addSubtask.mutate(trimmed, { onSuccess: () => setNewSubtask("") });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Card details
              {updateCard.isPending ? (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden /> Saving…
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>Title saves when you leave the field.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-title">Title</Label>
              <Input
                id="card-title"
                value={title}
                aria-invalid={titleError ? true : undefined}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError(null);
                }}
                onBlur={blurSaveTitle}
              />
              {titleError ? (
                <p className="text-xs text-destructive" role="alert">
                  {titleError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-description">Description</Label>
              <Textarea
                id="card-description"
                rows={3}
                placeholder="What does done look like? Add context, links, acceptance notes…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() =>
                  description !== (card.description ?? "") && updateCard.mutate({ description })
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label>Priority</Label>
              <Select
                value={card.priority}
                onValueChange={(v) => updateCard.mutate({ priority: v as Priority })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Subtasks{" "}
                  <span className="font-normal text-muted-foreground">
                    {done}/{card.subtasks.length} done
                  </span>
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAiOpen(true)}
                  disabled={aiOpen}
                >
                  <Sparkles className="size-4 text-ai" aria-hidden /> AI Split &amp; Prioritize
                </Button>
              </div>

              {card.subtasks.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  No subtasks yet — add one below or let AI draft a breakdown.
                </p>
              ) : (
                <ul className="space-y-2">
                  {card.subtasks.map((subtask) => (
                    <li key={subtask.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={subtask.is_done}
                        onCheckedChange={(checked) =>
                          toggleSubtask.mutate({ id: subtask.id, is_done: checked === true })
                        }
                        aria-label={`Mark ${subtask.title} done`}
                      />
                      <Input
                        key={`${subtask.id}-${subtask.title}`}
                        defaultValue={subtask.title}
                        aria-label={`Subtask ${subtask.title}`}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (!value || value === subtask.title) return;
                          if (value.length > 200) return;
                          renameSubtask.mutate({ id: subtask.id, title: value });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="h-9 flex-1"
                      />
                      {subtask.origin === "AI" ? (
                        <span className="rounded-full bg-ai/15 px-2 py-0.5 text-[11px] font-semibold text-ai">
                          AI
                        </span>
                      ) : null}
                      <ConfirmDialog
                        title="Delete this subtask?"
                        description="This cannot be undone."
                        onConfirm={() => removeSubtask.mutate(subtask.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete subtask ${subtask.title}`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={submitSubtask} noValidate>
                <div className="flex gap-2">
                  <Input
                    value={newSubtask}
                    placeholder="Add a subtask and press Enter"
                    aria-label="New subtask title"
                    onChange={(e) => {
                      setNewSubtask(e.target.value);
                      if (subtaskError) setSubtaskError(null);
                    }}
                  />
                  <Button type="submit" variant="secondary" disabled={addSubtask.isPending}>
                    {addSubtask.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Plus className="size-4" aria-hidden />
                    )}
                    Add
                  </Button>
                </div>
                {subtaskError ? (
                  <p className="mt-1.5 text-xs text-destructive" role="alert">
                    {subtaskError}
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AiProposalDialog
        card={card}
        open={aiOpen}
        onOpenChange={setAiOpen}
        onAccept={async (titles, priority) => {
          await acceptProposal.mutateAsync({ titles, priority });
        }}
      />
    </>
  );
}
