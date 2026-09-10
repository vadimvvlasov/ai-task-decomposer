import { ApiError } from "./errors";
import type {
  BoardSummary,
  BoardTree,
  BulkCreateSubtasksInput,
  Card,
  CreateCardInput,
  DecomposeResponse,
  HealthResponse,
  KanbanService,
  MoveCardInput,
  Subtask,
  UpdateCardInput,
  UpdateSubtaskInput,
} from "./types";

/**
 * Talks to the real backend described in the spec (FastAPI at /api).
 * Swapped in by `getKanbanService()` when a base URL is configured.
 */
export function createHttpKanbanService(baseUrl: string): KanbanService {
  const root = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${root}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server.");
    }
    if (!response.ok) {
      let code = "REQUEST_FAILED";
      let message = `Request failed (${response.status}).`;
      try {
        const body = (await response.json()) as { detail?: unknown };
        const detail = body.detail;
        if (detail && typeof detail === "object") {
          const d = detail as Record<string, unknown>;
          if (typeof d["code"] === "string") code = d["code"];
          if (typeof d["message"] === "string") message = d["message"];
        } else if (typeof detail === "string") {
          message = detail;
        }
      } catch {
        /* keep defaults */
      }
      throw new ApiError(response.status, code, message);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const post = <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
  const patch = <T,>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) });

  return {
    health: () => request<HealthResponse>("/health"),
    listBoards: () => request<BoardSummary[]>("/boards"),
    createBoard: (name) => post<BoardTree>("/boards", { name }),
    getBoard: (boardId) => request<BoardTree>(`/boards/${boardId}`),
    renameBoard: (boardId, name) => patch<BoardTree>(`/boards/${boardId}`, { name }),
    deleteBoard: (boardId) =>
      request<void>(`/boards/${boardId}`, { method: "DELETE" }).then(() => undefined),
    createCard: (columnId, input: CreateCardInput) =>
      post<Card>(`/columns/${columnId}/cards`, input),
    updateCard: (cardId, input: UpdateCardInput) => patch<Card>(`/cards/${cardId}`, input),
    deleteCard: (cardId) =>
      request<void>(`/cards/${cardId}`, { method: "DELETE" }).then(() => undefined),
    moveCard: (cardId, input: MoveCardInput) => post<BoardTree>(`/cards/${cardId}/move`, input),
    decompose: (cardId) => post<DecomposeResponse>(`/cards/${cardId}/ai/decompose`),
    bulkCreateSubtasks: (cardId, input: BulkCreateSubtasksInput) =>
      post<Subtask[]>(`/cards/${cardId}/subtasks`, input),
    updateSubtask: (subtaskId, input: UpdateSubtaskInput) =>
      patch<Subtask>(`/subtasks/${subtaskId}`, input),
    deleteSubtask: (subtaskId) =>
      request<void>(`/subtasks/${subtaskId}`, { method: "DELETE" }).then(() => undefined),
  };
}
