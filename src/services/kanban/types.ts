export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type SubtaskOrigin = "USER" | "AI";

export interface Subtask {
  id: string;
  card_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
  origin: SubtaskOrigin;
}

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  position: number;
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  cards: Card[];
}

export interface BoardTree {
  id: string;
  name: string;
  created_at: string;
  columns: Column[];
}

export interface BoardSummary {
  id: string;
  name: string;
  created_at: string;
  card_count: number;
}

export interface CreateCardInput {
  title: string;
  description?: string | null;
  priority?: Priority;
}

export interface UpdateCardInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
}

export interface MoveCardInput {
  target_column_id: string;
  target_position: number;
}

export interface BulkCreateSubtasksInput {
  subtasks: { title: string }[];
  origin?: SubtaskOrigin;
  priority?: Priority;
}

export interface UpdateSubtaskInput {
  title?: string;
  is_done?: boolean;
}

export interface DecomposeProposal {
  subtasks: string[];
  suggested_priority: Priority;
  rationale: string;
}

export interface DecomposeResponse {
  card_id: string;
  proposal: DecomposeProposal;
  model: string;
  provider: string;
}

export interface HealthResponse {
  status: "ok";
  llm_provider: string;
}

/**
 * The single boundary between the UI and any backend.
 * Every backend call in the app goes through this interface.
 */
export interface KanbanService {
  health(): Promise<HealthResponse>;

  listBoards(): Promise<BoardSummary[]>;
  createBoard(name: string): Promise<BoardTree>;
  getBoard(boardId: string): Promise<BoardTree>;
  renameBoard(boardId: string, name: string): Promise<BoardTree>;
  deleteBoard(boardId: string): Promise<void>;

  createCard(columnId: string, input: CreateCardInput): Promise<Card>;
  updateCard(cardId: string, input: UpdateCardInput): Promise<Card>;
  deleteCard(cardId: string): Promise<void>;
  moveCard(cardId: string, input: MoveCardInput): Promise<BoardTree>;

  decompose(cardId: string): Promise<DecomposeResponse>;

  bulkCreateSubtasks(cardId: string, input: BulkCreateSubtasksInput): Promise<Subtask[]>;
  updateSubtask(subtaskId: string, input: UpdateSubtaskInput): Promise<Subtask>;
  deleteSubtask(subtaskId: string): Promise<void>;
}
