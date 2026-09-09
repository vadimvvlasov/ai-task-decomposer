import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2, X } from "lucide-react";
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

export function AiProposalDialog({ card, open, onOpenChange, onAccept }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !card) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTitles([]);
    setRationale("");
    getKanbanService()
      .decompose(card.id)
      .then((response) => {
        if (cancelled) return;
        setTitles(response.proposal.subtasks);
        setPriority(response.proposal.suggested_priority);
        setRationale(response.proposal.rationale);
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
  }, [open, card]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-ai" /> Suggested breakdown
          </DialogTitle>
          <DialogDescription>
            Nothing is saved until you accept. Edit or remove anything first.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError(null)}>
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking through this card...
          </div>
        ) : titles.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {titles.map((title, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) =>
                      setTitles((prev) => prev.map((t, i) => (i === index ? e.target.value : t)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove suggestion"
                    onClick={() => setTitles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {rationale}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Suggested priority</span>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
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
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={accept} disabled={loading || saving || titles.length === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
