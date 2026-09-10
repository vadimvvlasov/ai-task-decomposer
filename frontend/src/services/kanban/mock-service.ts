import { createMockProvider, runDecomposition, type LLMProvider } from "./decompose";
import { ApiError, invalid, notFound } from "./errors";
import type {
  BoardSummary,
  BoardTree,
  BulkCreateSubtasksInput,
  Card,
  Column,
  CreateCardInput,
  HealthResponse,
  KanbanService,
  MoveCardInput,
  Priority,
  Subtask,
  UpdateCardInput,
  UpdateSubtaskInput,
} from "./types";

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];
const COLUMN_NAMES = ["To Do", "In Progress", "Done"];
const STORAGE_KEY = "mini-kanban.v1";

interface Store {
  boards: BoardTree[];
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function renumber<T extends { position: number }>(items: T[]): T[] {
  items.forEach((item, index) => {
    item.position = index;
  });
  return items;
}

export interface MockServiceOptions {
  /** Persist to localStorage under a stable key. Off in tests. */
  persist?: boolean;
  /** Override the LLM provider (tests inject stubs). */
  provider?: LLMProvider;
  /** Simulate an unconfigured provider (spec §6.4). */
  providerConfigured?: boolean;
  /** Artificial latency in ms so the UI's loading states are real. */
  latencyMs?: number;
  seed?: boolean;
}

export function createMockKanbanService(options: MockServiceOptions = {}): KanbanService {
  const {
    persist = false,
    provider = createMockProvider(),
    providerConfigured = true,
    latencyMs = 0,
    seed = false,
  } = options;

  const store: Store = { boards: [] };

  const canPersist = () => persist && typeof localStorage !== "undefined";

  const load = () => {
    if (!canPersist()) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) store.boards = JSON.parse(raw) as BoardTree[];
    } catch {
      store.boards = [];
    }
  };

  const save = () => {
    if (!canPersist()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store.boards));
    } catch {
      /* storage full or unavailable: in-memory state still works */
    }
  };

  const delay = () =>
    latencyMs > 0 ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve();

  load();

  const findBoard = (boardId: string): BoardTree => {
    const board = store.boards.find((b) => b.id === boardId);
    if (!board) throw notFound("That board");
    return board;
  };

  const findColumn = (columnId: string): { board: BoardTree; column: Column } => {
    for (const board of store.boards) {
      const column = board.columns.find((c) => c.id === columnId);
      if (column) return { board, column };
    }
    throw notFound("That column");
  };

  const findCard = (cardId: string): { board: BoardTree; column: Column; card: Card } => {
    for (const board of store.boards) {
      for (const column of board.columns) {
        const card = column.cards.find((c) => c.id === cardId);
        if (card) return { board, column, card };
      }
    }
    throw notFound("That card");
  };

  const findSubtask = (subtaskId: string): { card: Card; subtask: Subtask } => {
    for (const board of store.boards) {
      for (const column of board.columns) {
        for (const card of column.cards) {
          const subtask = card.subtasks.find((s) => s.id === subtaskId);
          if (subtask) return { card, subtask };
        }
      }
    }
    throw notFound("That subtask");
  };

  const service: KanbanService = {
    async health(): Promise<HealthResponse> {
      await delay();
      return { status: "ok", llm_provider: provider.name };
    },

    async listBoards() {
      await delay();
      return store.boards.map<BoardSummary>((board) => ({
        id: board.id,
        name: board.name,
        created_at: board.created_at,
        card_count: board.columns.reduce((total, c) => total + c.cards.length, 0),
      }));
    },

    async createBoard(name) {
      await delay();
      const trimmed = name.trim();
      if (!trimmed) throw invalid("A board needs a name.");
      if (trimmed.length > 120) throw invalid("That board name is too long.");
      const boardId = uid();
      const board: BoardTree = {
        id: boardId,
        name: trimmed,
        created_at: now(),
        columns: COLUMN_NAMES.map((columnName, index) => ({
          id: uid(),
          board_id: boardId,
          name: columnName,
          position: index,
          cards: [],
        })),
      };
      store.boards.push(board);
      save();
      return clone(board);
    },

    async getBoard(boardId) {
      await delay();
      return clone(findBoard(boardId));
    },

    async renameBoard(boardId, name) {
      await delay();
      const trimmed = name.trim();
      if (!trimmed) throw invalid("A board needs a name.");
      const board = findBoard(boardId);
      board.name = trimmed;
      save();
      return clone(board);
    },

    async deleteBoard(boardId) {
      await delay();
      findBoard(boardId);
      store.boards = store.boards.filter((b) => b.id !== boardId);
      save();
    },

    async createCard(columnId, input: CreateCardInput) {
      await delay();
      const { column } = findColumn(columnId);
      const title = input.title.trim();
      if (!title) throw invalid("A card needs a title.");
      if (title.length > 200) throw invalid("That card title is too long.");
      if (input.priority && !PRIORITIES.includes(input.priority))
        throw invalid("That priority is not allowed.");
      const timestamp = now();
      const card: Card = {
        id: uid(),
        column_id: column.id,
        title,
        description: input.description?.trim() ? input.description.trim() : null,
        priority: input.priority ?? "MEDIUM",
        position: column.cards.length,
        created_at: timestamp,
        updated_at: timestamp,
        subtasks: [],
      };
      column.cards.push(card);
      renumber(column.cards);
      save();
      return clone(card);
    },

    async updateCard(cardId, input: UpdateCardInput) {
      await delay();
      const { card } = findCard(cardId);
      if (input.priority !== undefined && !PRIORITIES.includes(input.priority))
        throw invalid("That priority is not allowed.");
      if (input.title !== undefined) {
        const title = input.title.trim();
        if (!title) throw invalid("A card needs a title.");
        if (title.length > 200) throw invalid("That card title is too long.");
        card.title = title;
      }
      if (input.description !== undefined)
        card.description = input.description?.trim() ? input.description.trim() : null;
      if (input.priority !== undefined) card.priority = input.priority;
      card.updated_at = now();
      save();
      return clone(card);
    },

    async deleteCard(cardId) {
      await delay();
      const { column } = findCard(cardId);
      column.cards = column.cards.filter((c) => c.id !== cardId);
      renumber(column.cards);
      save();
    },

    async moveCard(cardId, input: MoveCardInput) {
      await delay();
      const { board, column: source, card } = findCard(cardId);
      const target = board.columns.find((c) => c.id === input.target_column_id);
      if (!target) {
        const existsElsewhere = store.boards.some((b) =>
          b.columns.some((c) => c.id === input.target_column_id),
        );
        if (existsElsewhere)
          throw new ApiError(
            409,
            "CROSS_BOARD_MOVE",
            "A card can only move between columns of the same board.",
          );
        throw notFound("That column");
      }
      source.cards = source.cards.filter((c) => c.id !== cardId);
      renumber(source.cards);
      const index = Math.max(0, Math.min(input.target_position, target.cards.length));
      card.column_id = target.id;
      card.updated_at = now();
      target.cards.splice(index, 0, card);
      renumber(target.cards);
      save();
      return clone(board);
    },

    async decompose(cardId) {
      const { card } = findCard(cardId);
      if (!card.title.trim()) throw invalid("A card needs a title before it can be broken down.");
      if (!providerConfigured)
        throw new ApiError(
          503,
          "LLM_NOT_CONFIGURED",
          "The assistant is not configured yet.",
        );
      await delay();
      const proposal = await runDecomposition(provider, {
        title: card.title,
        description: card.description,
        existingSubtasks: card.subtasks.map((s) => s.title),
      });
      return {
        card_id: card.id,
        proposal,
        model: provider.model,
        provider: provider.name,
      };
    },

    async bulkCreateSubtasks(cardId, input: BulkCreateSubtasksInput) {
      await delay();
      const { card } = findCard(cardId);
      if (!Array.isArray(input.subtasks) || input.subtasks.length === 0)
        throw invalid("Add at least one subtask.");
      if (input.subtasks.length > 20) throw invalid("That is more than 20 subtasks.");
      const titles = input.subtasks.map((s) => s.title.trim());
      if (titles.some((t) => !t)) throw invalid("A subtask needs a title.");
      if (titles.some((t) => t.length > 200)) throw invalid("A subtask title is too long.");
      if (input.priority !== undefined) {
        if (!PRIORITIES.includes(input.priority)) throw invalid("That priority is not allowed.");
        card.priority = input.priority;
      }
      const created = titles.map((title, offset) => {
        const subtask: Subtask = {
          id: uid(),
          card_id: card.id,
          title,
          is_done: false,
          position: card.subtasks.length + offset,
          created_at: now(),
          origin: input.origin ?? "USER",
        };
        return subtask;
      });
      card.subtasks.push(...created);
      renumber(card.subtasks);
      card.updated_at = now();
      save();
      return clone(created);
    },

    async updateSubtask(subtaskId, input: UpdateSubtaskInput) {
      await delay();
      const { subtask, card } = findSubtask(subtaskId);
      if (input.title !== undefined) {
        const title = input.title.trim();
        if (!title) throw invalid("A subtask needs a title.");
        if (title.length > 200) throw invalid("That subtask title is too long.");
        subtask.title = title;
      }
      if (input.is_done !== undefined) subtask.is_done = input.is_done;
      card.updated_at = now();
      save();
      return clone(subtask);
    },

    async deleteSubtask(subtaskId) {
      await delay();
      const { card } = findSubtask(subtaskId);
      card.subtasks = card.subtasks.filter((s) => s.id !== subtaskId);
      renumber(card.subtasks);
      save();
    },
  };

  if (seed && store.boards.length === 0) {
    void (async () => {
      const board = await service.createBoard("Launch MVP");
      const [todo] = board.columns;
      if (todo) {
        await service.createCard(todo.id, {
          title: "Set up deployment pipeline",
          description: "CI, staging, prod",
          priority: "HIGH",
        });
      }
    })();
  }

  return service;
}
