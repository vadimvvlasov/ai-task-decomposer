import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage, getKanbanService } from "@/services/kanban";

const service = () => getKanbanService();

export const boardsKey = ["boards"] as const;
export const boardKey = (boardId: string) => ["board", boardId] as const;

export function useBoards() {
  return useQuery({ queryKey: boardsKey, queryFn: () => service().listBoards() });
}

export function useBoard(boardId: string) {
  return useQuery({ queryKey: boardKey(boardId), queryFn: () => service().getBoard(boardId) });
}

/** Refetch-on-mutation: after any write the board tree is re-read. */
export function useBoardMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<unknown>,
  options: { boardId?: string; successMessage?: string } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardsKey });
      if (options.boardId) void queryClient.invalidateQueries({ queryKey: boardKey(options.boardId) });
      if (options.successMessage) toast.success(options.successMessage);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
