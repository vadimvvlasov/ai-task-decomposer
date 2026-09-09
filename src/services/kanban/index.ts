import { createHttpKanbanService } from "./http-service";
import { createMockKanbanService } from "./mock-service";
import type { KanbanService } from "./types";

export * from "./types";
export * from "./errors";
export { createMockKanbanService } from "./mock-service";
export { createHttpKanbanService } from "./http-service";

let instance: KanbanService | null = null;

/**
 * The one place the app resolves its backend.
 * With no API base URL configured, everything runs on the mock service.
 */
export function getKanbanService(): KanbanService {
  if (!instance) {
    const baseUrl = import.meta.env["VITE_KANBAN_API_URL"] as string | undefined;
    instance = baseUrl
      ? createHttpKanbanService(baseUrl)
      : createMockKanbanService({ persist: true, latencyMs: 120, seed: true });
  }
  return instance;
}

/** Test/storybook escape hatch. */
export function setKanbanService(service: KanbanService | null) {
  instance = service;
}
