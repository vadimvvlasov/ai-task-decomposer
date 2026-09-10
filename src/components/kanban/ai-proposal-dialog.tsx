import { useEffect, useState } from "react";
import { Loader2, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  errorMessage,
  getKanbanService,
  type Card as KanbanCard,
  type Priority,
} from "@/services/kanban";

interface Props {
  card: KanbanCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (titles: string[], priority: Priority) => Promise<void>;
}

const FALLBACK = "AI Service unavailable. You can still add subtasks manually.";

export function AiProposalDialog({ card, open, onOpenChange, onAccept }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [customRow, setCustomRow] = useState("");

  const cardId = card?.id;
  useEffect(() => {
    if (!open || !cardId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTitles([]);
    setRationale("");
    setCustomRow("");
    getKanbanService()
      .decompose(cardId)
      .then((response) => {
        if (cancelled) return;
        setTitles(response.proposal.subtasks);
        setPriority(response.proposal.suggested_priority);
        setRationale(response.proposal.rationale ?? "");
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cardId, attempt]);

  const accept = async () => {
    const cleaned = titles.map((t) => t.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setError("Keep at least one subtask, or cancel.");
      return;
    }
    setSaving(true);
    try {
      await onAccept(cleaned, priority);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const addCustomRow = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = customRow.trim();
    if (!trimmed) return;
    if (titles.length >= 20) {
      setError("That's more than 20 subtasks — remove one first.");
      return;
    }
    setTitles((prev) => [...prev, trimmed]);
    setCustomRow("");
    if (error === "Keep at least one subtask, or cancel.") setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-ai" aria-hidden /> Suggested breakdown
          </DialogTitle>
          <DialogDescription>
            Nothing is saved until you click Apply Suggestions. Edit, remove, or add rows first.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
            role="alert"
          >
            <span className="flex-1">
              <span className="font-medium text-destructive">{FALLBACK}</span>
              <span className="mt-0.5 block text-xs text-destructive/80">{error}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                The card is untouched — retry or add subtasks manually.
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAttempt((a) => a + 1)}
              disabled={loading}
              aria-label="Retry AI breakdown"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="size-4" aria-hidden />
              )}
              Retry
            </Button>
            <button aria-label="Dismiss error" onClick={() => setError(null)}>
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}

        {loading ? (
          <div
            className="flex items-center gap-2 py-10 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking through this card…
          </div>
        ) : titles.length > 0 || !error ? (
          <div className="space-y-4">
            {titles.length > 0 ? (
              <div className="space-y-2">
                {titles.map((title, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={title}
                      aria-label={`Suggested subtask ${index + 1}`}
                      onChange={(e) =>
                        setTitles((prev) => prev.map((t, i) => (i === index ? e.target.value : t)))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove suggestion ${index + 1}`}
                      onClick={() => setTitles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <form onSubmit={addCustomRow} className="flex gap-2">
              <Input
                value={customRow}
                placeholder="Add your own row to this proposal"
                aria-label="Add custom subtask to proposal"
                onChange={(e) => setCustomRow(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={!customRow.trim()}>
                <Plus className="size-4" aria-hidden />
                Add
              </Button>
            </form>

            {rationale.trim() ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {rationale}
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Suggested priority</span>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="w-36" aria-label="Suggested priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={accept} disabled={loading || saving || titles.length === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Apply Suggestions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
