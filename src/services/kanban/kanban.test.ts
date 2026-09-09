import { describe, expect, it } from "vitest";
import { createMockKanbanService } from "./mock-service";
import { ApiError } from "./errors";
import { parseProposal, runDecomposition, type LLMProvider } from "./decompose";
import type { KanbanService } from "./types";

const svc = (options = {}) => createMockKanbanService({ persist: false, ...options });

async function boardWithCards(service: KanbanService, titles: string[]) {
  const board = await service.createBoard("Launch MVP");
  const todo = board.columns[0]!;
  for (const title of titles) await service.createCard(todo.id, { title });
  return { board: await service.getBoard(board.id), todoId: todo.id };
}

const stub = (responses: string[]): LLMProvider => {
  let i = 0;
  return {
    name: "stub",
    model: "stub-1",
    async complete() {
      return responses[Math.min(i++, responses.length - 1)]!;
    },
  };
};

describe("boards", () => {
  it("AC1: seeds three columns in order", async () => {
    const board = await svc().createBoard("Launch MVP");
    expect(board.columns.map((c) => [c.name, c.position])).toEqual([
      ["To Do", 0],
      ["In Progress", 1],
      ["Done", 2],
    ]);
  });

  it("AC2: rejects a blank name and creates nothing", async () => {
    const service = svc();
    await expect(service.createBoard("   ")).rejects.toMatchObject({ status: 422 });
    expect(await service.listBoards()).toHaveLength(0);
  });

  it("AC3: lists boards with accurate card counts", async () => {
    const service = svc();
    await boardWithCards(service, ["a", "b"]);
    expect((await service.listBoards())[0]!.card_count).toBe(2);
  });

  it("AC4: deleting a board removes it and its descendants", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a"]);
    await service.deleteBoard(board.id);
    await expect(service.getBoard(board.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.listBoards()).toHaveLength(0);
  });
});

describe("cards", () => {
  it("AC5: appends cards at 0,1,2", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a", "b", "c"]);
    expect(board.columns[0]!.cards.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it("AC6: deleting the middle card renumbers the rest", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a", "b", "c"]);
    await service.deleteCard(board.columns[0]!.cards[1]!.id);
    const after = await service.getBoard(board.id);
    expect(after.columns[0]!.cards.map((c) => [c.title, c.position])).toEqual([
      ["a", 0],
      ["c", 1],
    ]);
  });

  it("AC7/AC8/AC9: patch semantics, default priority and invalid priority", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a"]);
    const card = board.columns[0]!.cards[0]!;
    expect(card.priority).toBe("MEDIUM");
    const updated = await service.updateCard(card.id, { description: "hi" });
    expect(updated.title).toBe("a");
    expect(updated.description).toBe("hi");
    await expect(
      service.updateCard(card.id, { priority: "URGENT" as never }),
    ).rejects.toMatchObject({ status: 422 });
    expect((await service.getBoard(board.id)).columns[0]!.cards[0]!.priority).toBe("MEDIUM");
  });
});

describe("moving", () => {
  it("AC10: moves to another column at position 0 and keeps both contiguous", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a", "b", "c"]);
    const tree = await service.moveCard(board.columns[0]!.cards[1]!.id, {
      target_column_id: board.columns[1]!.id,
      target_position: 0,
    });
    expect(tree.columns[0]!.cards.map((c) => [c.title, c.position])).toEqual([
      ["a", 0],
      ["c", 1],
    ]);
    expect(tree.columns[1]!.cards.map((c) => [c.title, c.position])).toEqual([["b", 0]]);
  });

  it("AC11: clamps an out-of-range target position", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a", "b", "c"]);
    const tree = await service.moveCard(board.columns[0]!.cards[0]!.id, {
      target_column_id: board.columns[0]!.id,
      target_position: 999,
    });
    expect(tree.columns[0]!.cards.map((c) => c.title)).toEqual(["b", "c", "a"]);
  });

  it("AC12: rejects a cross-board move with CROSS_BOARD_MOVE", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a"]);
    const other = await service.createBoard("Other");
    await expect(
      service.moveCard(board.columns[0]!.cards[0]!.id, {
        target_column_id: other.columns[0]!.id,
        target_position: 0,
      }),
    ).rejects.toMatchObject({ status: 409, code: "CROSS_BOARD_MOVE" });
    const after = await service.getBoard(board.id);
    expect(after.columns[0]!.cards).toHaveLength(1);
  });
});

describe("subtasks", () => {
  it("AC13: bulk create appends at 2,3,4", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a"]);
    const cardId = board.columns[0]!.cards[0]!.id;
    await service.bulkCreateSubtasks(cardId, { subtasks: [{ title: "x" }, { title: "y" }] });
    const created = await service.bulkCreateSubtasks(cardId, {
      subtasks: [{ title: "1" }, { title: "2" }, { title: "3" }],
    });
    expect(created.map((s) => s.position)).toEqual([2, 3, 4]);
  });

  it("AC14: toggling is_done persists", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a"]);
    const cardId = board.columns[0]!.cards[0]!.id;
    const [subtask] = await service.bulkCreateSubtasks(cardId, { subtasks: [{ title: "x" }] });
    await service.updateSubtask(subtask!.id, { is_done: true });
    const after = await service.getBoard(board.id);
    expect(after.columns[0]!.cards[0]!.subtasks[0]!.is_done).toBe(true);
  });

  it("AC15/AC16: deleting a card removes subtasks; empty bulk create is rejected", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["a"]);
    const cardId = board.columns[0]!.cards[0]!.id;
    await service.bulkCreateSubtasks(cardId, { subtasks: [{ title: "x" }] });
    await expect(service.bulkCreateSubtasks(cardId, { subtasks: [] })).rejects.toMatchObject({
      status: 422,
    });
    await service.deleteCard(cardId);
    await expect(service.updateSubtask("missing", {})).rejects.toMatchObject({ status: 404 });
  });
});

describe("ai decomposition", () => {
  it("AC17: mock provider returns a valid proposal", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["Set up deployment pipeline"]);
    const response = await service.decompose(board.columns[0]!.cards[0]!.id);
    expect(response.proposal.subtasks.length).toBeGreaterThanOrEqual(3);
    expect(response.proposal.subtasks.length).toBeLessThanOrEqual(6);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(response.proposal.suggested_priority);
    expect(response.proposal.rationale.length).toBeGreaterThan(0);
  });

  it("AC18: decompose writes nothing", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["Set up deployment pipeline"]);
    const cardId = board.columns[0]!.cards[0]!.id;
    await service.decompose(cardId);
    const after = await service.getBoard(board.id);
    expect(after.columns[0]!.cards).toHaveLength(1);
    expect(after.columns[0]!.cards[0]!.subtasks).toHaveLength(0);
  });

  it("AC19: an unconfigured provider returns LLM_NOT_CONFIGURED", async () => {
    const service = svc({ providerConfigured: false });
    const { board } = await boardWithCards(service, ["a"]);
    await expect(service.decompose(board.columns[0]!.cards[0]!.id)).rejects.toMatchObject({
      status: 503,
      code: "LLM_NOT_CONFIGURED",
    });
  });

  it("AC20: malformed JSON on every attempt yields LLM_INVALID_OUTPUT", async () => {
    const service = svc({ provider: stub(["not json", "still not json"]) });
    const { board } = await boardWithCards(service, ["a"]);
    await expect(service.decompose(board.columns[0]!.cards[0]!.id)).rejects.toMatchObject({
      status: 502,
      code: "LLM_INVALID_OUTPUT",
    });
  });

  it("AC21: fenced JSON parses", () => {
    const proposal = parseProposal(
      '```json\n{"subtasks":["a","b","c"],"suggested_priority":"HIGH","rationale":"why"}\n```',
    );
    expect(proposal.subtasks).toEqual(["a", "b", "c"]);
  });

  it("AC22: eight subtasks are rejected, not truncated", () => {
    const payload = JSON.stringify({
      subtasks: ["1", "2", "3", "4", "5", "6", "7", "8"],
      suggested_priority: "LOW",
      rationale: "why",
    });
    expect(() => parseProposal(payload)).toThrow(ApiError);
  });

  it("repairs on retry: an invalid first answer followed by a valid one succeeds", async () => {
    const provider = stub([
      "garbage",
      '{"subtasks":["a","b","c"],"suggested_priority":"LOW","rationale":"ok"}',
    ]);
    const proposal = await runDecomposition(provider, { title: "x", existingSubtasks: [] });
    expect(proposal.suggested_priority).toBe("LOW");
  });

  it("removes case-insensitive duplicates", () => {
    const payload = JSON.stringify({
      subtasks: ["Alpha", "alpha", "Beta", "Gamma"],
      suggested_priority: "MEDIUM",
      rationale: "why",
    });
    expect(parseProposal(payload).subtasks).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("AC23/AC24: accepting edited titles persists the edits with origin AI", async () => {
    const service = svc();
    const { board } = await boardWithCards(service, ["Set up deployment pipeline"]);
    const cardId = board.columns[0]!.cards[0]!.id;
    const response = await service.decompose(cardId);
    const edited = [...response.proposal.subtasks];
    edited[0] = "Edited by the user";
    await service.bulkCreateSubtasks(cardId, {
      subtasks: edited.map((title) => ({ title })),
      origin: "AI",
      priority: "HIGH",
    });
    await service.bulkCreateSubtasks(cardId, { subtasks: [{ title: "manual" }] });
    const after = (await service.getBoard(board.id)).columns[0]!.cards[0]!;
    expect(after.subtasks[0]!.title).toBe("Edited by the user");
    expect(after.subtasks[0]!.origin).toBe("AI");
    expect(after.subtasks.at(-1)!.origin).toBe("USER");
    expect(after.priority).toBe("HIGH");
  });
});

describe("AC28: end to end", () => {
  it("board -> card -> decompose -> accept -> tick -> move to Done", async () => {
    const service = svc();
    const board = await service.createBoard("Launch MVP");
    const card = await service.createCard(board.columns[0]!.id, {
      title: "Set up deployment pipeline",
      description: "CI, staging, prod",
    });
    const proposal = await service.decompose(card.id);
    await service.bulkCreateSubtasks(card.id, {
      subtasks: proposal.proposal.subtasks.map((title) => ({ title })),
      origin: "AI",
      priority: proposal.proposal.suggested_priority,
    });
    const withSubtasks = (await service.getBoard(board.id)).columns[0]!.cards[0]!;
    await service.updateSubtask(withSubtasks.subtasks[0]!.id, { is_done: true });
    const tree = await service.moveCard(card.id, {
      target_column_id: board.columns[2]!.id,
      target_position: 0,
    });
    expect(tree.columns[0]!.cards).toHaveLength(0);
    expect(tree.columns[2]!.cards[0]!.subtasks[0]!.is_done).toBe(true);
  });
});
