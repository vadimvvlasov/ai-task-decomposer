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
  const [description, setDescription] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description ?? "");
    }
  }, [card]);

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Card details</DialogTitle>
            <DialogDescription>Changes save when you leave a field.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-title">Title</Label>
              <Input
                id="card-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title !== card.title && updateCard.mutate({ title })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-description">Description</Label>
              <Textarea
                id="card-description"
                rows={3}
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Subtasks{" "}
                  <span className="text-muted-foreground">
                    {done}/{card.subtasks.length} done
                  </span>
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAiOpen(true)}
                  disabled={aiOpen}
                >
                  <Sparkles className="size-4 text-ai" /> Break into subtasks
                </Button>
              </div>

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
                      defaultValue={subtask.title}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== subtask.title)
                          renameSubtask.mutate({ id: subtask.id, title: value });
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
                        <Button variant="ghost" size="icon" aria-label="Delete subtask">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubtask.trim()) return;
                  addSubtask.mutate(newSubtask.trim());
                  setNewSubtask("");
                }}
              >
                <Input
                  value={newSubtask}
                  placeholder="Add a subtask"
                  onChange={(e) => setNewSubtask(e.target.value)}
                />
                <Button type="submit" variant="secondary" disabled={addSubtask.isPending}>
                  {addSubtask.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Add
                </Button>
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
