import { ApiError } from "./errors";
import type { DecomposeProposal, Priority } from "./types";

/** A single-method provider protocol, mirroring the backend LLMProvider. */
export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(system: string, user: string): Promise<string>;
}

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

export const SYSTEM_PROMPT = [
  "You break a Kanban card into concrete, actionable subtasks.",
  "Return JSON only. No prose, no code fences.",
  'Shape: {"subtasks": string[3..6], "suggested_priority": "LOW"|"MEDIUM"|"HIGH", "rationale": string}',
  "Each subtask must be at most 120 characters. The rationale must be at most 240 characters.",
].join(" ");

export function buildUserPrompt(input: {
  title: string;
  description?: string | null;
  existingSubtasks: string[];
}): string {
  const lines = [`Card title: ${input.title}`];
  if (input.description?.trim()) lines.push(`Description: ${input.description.trim()}`);
  if (input.existingSubtasks.length)
    lines.push(
      `Existing subtasks (do not repeat these): ${input.existingSubtasks.join("; ")}`,
    );
  return lines.join("\n");
}

export const REPAIR_INSTRUCTION =
  "Your previous answer was invalid. Return ONLY valid JSON matching the required shape.";

/** Strips markdown fences defensively before parsing. */
export function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

/**
 * Parses and validates a raw provider response.
 * Bounds are enforced, never silently truncated.
 */
export function parseProposal(raw: string): DecomposeProposal {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    throw new ApiError(502, "LLM_INVALID_OUTPUT", "The model did not return valid JSON.");
  }
  if (typeof data !== "object" || data === null)
    throw new ApiError(502, "LLM_INVALID_OUTPUT", "The model did not return an object.");

  const obj = data as Record<string, unknown>;
  const rawSubtasks = obj['subtasks'];
  if (!Array.isArray(rawSubtasks))
    throw new ApiError(502, "LLM_INVALID_OUTPUT", "Missing subtasks list.");

  const seen = new Set<string>();
  const subtasks: string[] = [];
  for (const item of rawSubtasks) {
    if (typeof item !== "string")
      throw new ApiError(502, "LLM_INVALID_OUTPUT", "A subtask was not a string.");
    const title = item.trim();
    if (!title || title.length > 120)
      throw new ApiError(502, "LLM_INVALID_OUTPUT", "A subtask was empty or too long.");
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    subtasks.push(title);
  }
  if (subtasks.length < 3 || subtasks.length > 6)
    throw new ApiError(
      502,
      "LLM_INVALID_OUTPUT",
      "The model returned the wrong number of subtasks.",
    );

  const priority = obj['suggested_priority'];
  if (typeof priority !== "string" || !PRIORITIES.includes(priority as Priority))
    throw new ApiError(502, "LLM_INVALID_OUTPUT", "The suggested priority was invalid.");

  const rationale = typeof obj['rationale'] === "string" ? obj['rationale'].trim() : "";
  if (!rationale || rationale.length > 240)
    throw new ApiError(502, "LLM_INVALID_OUTPUT", "The rationale was empty or too long.");

  return { subtasks, suggested_priority: priority as Priority, rationale };
}

/** Runs a provider with a single repair retry, exactly like the spec's flow. */
export async function runDecomposition(
  provider: LLMProvider,
  input: { title: string; description?: string | null; existingSubtasks: string[] },
  maxRetries = 1,
): Promise<DecomposeProposal> {
  const user = buildUserPrompt(input);
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const prompt = attempt === 0 ? user : `${user}\n\n${REPAIR_INSTRUCTION}`;
    let raw: string;
    try {
      raw = await provider.complete(SYSTEM_PROMPT, prompt);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(504, "LLM_UNAVAILABLE", "The assistant could not be reached.");
    }
    try {
      return parseProposal(raw);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof ApiError
    ? lastError
    : new ApiError(502, "LLM_INVALID_OUTPUT", "The assistant returned an unusable answer.");
}

/** Deterministic offline provider: derives a plausible proposal from the card title. */
export function createMockProvider(): LLMProvider {
  return {
    name: "mock",
    model: "mock-decomposer-v1",
    async complete(_system: string, user: string) {
      const title = (user.match(/^Card title: (.*)$/m)?.[1] ?? "this work").trim();
      const short = title.length > 60 ? `${title.slice(0, 57)}...` : title;
      const lower = title.toLowerCase();
      const highSignals = ["deploy", "launch", "release", "security", "payment", "bug", "fix"];
      const lowSignals = ["nice to have", "someday", "explore", "research", "idea"];
      const priority = highSignals.some((s) => lower.includes(s))
        ? "HIGH"
        : lowSignals.some((s) => lower.includes(s))
          ? "LOW"
          : "MEDIUM";
      const existing = user.match(/^Existing subtasks[^:]*: (.*)$/m)?.[1] ?? "";
      const done = new Set(
        existing
          .split(";")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      );
      const candidates = [
        `Clarify what "done" means for ${short}`,
        `Break ${short} into a first shippable slice`,
        `Draft the approach and note the risks`,
        `Do the main work for ${short}`,
        `Review the result and tidy loose ends`,
        `Write down what changed for the team`,
      ].filter((c) => !done.has(c.toLowerCase()));
      const subtasks = (candidates.length >= 3 ? candidates : candidates.concat([
        `Re-check ${short} against the goal`,
        `Plan the follow-up for ${short}`,
        `Close out ${short}`,
      ])).slice(0, 4);
      return JSON.stringify({
        subtasks,
        suggested_priority: priority,
        rationale:
          priority === "HIGH"
            ? "This blocks later work, so it should be tackled first."
            : priority === "LOW"
              ? "Useful, but nothing else is waiting on it."
              : "Sizeable but not blocking; steady progress is enough.",
      });
    },
  };
}
