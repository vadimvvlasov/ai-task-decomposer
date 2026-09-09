# AI Task Decomposer

Create a Kanban board application. 

# Mini Kanban Board — v1 Specification



**Status:** Locked for v1 · **Target:** 3-day MVP · **Audience:** AI coding agent



This document is the single source of truth for v1. If something is not described here, it is out of scope. Where this document says MUST, the behaviour is an acceptance criterion. Where it says SHOULD, the agent may choose an equivalent implementation but must not change the observable contract.



---



## 1. Product summary



A single-tenant Kanban board application. A user creates boards; each board has three fixed columns; cards live in columns and can be edited and moved between them. One AI-powered feature decomposes a large, vaguely-worded card into concrete subtasks and suggests a priority — as a **proposal the user reviews before anything is written to the database**.



There are no user accounts. Anyone with access to the app sees all boards.



### 1.1 Primary user journey



1. User lands on the board list, creates a board named "Launch MVP".

2. The board opens with three empty columns: To Do, In Progress, Done.

3. User adds a card titled "Set up deployment pipeline" with a short description.

4. User clicks **Break into subtasks** on the card. A modal appears showing 3–6 proposed subtasks and a suggested priority, plus a one-line rationale.

5. User deletes one proposed subtask, edits the wording of another, and clicks **Accept**. Only now are rows written.

6. User checks off subtasks as they go, and moves the card To Do → In Progress → Done.



---



## 2. Explicit non-goals (out of scope for v1)



These are deliberately excluded. The agent MUST NOT implement them, and MUST NOT add schema, endpoints, or UI in anticipation of them.



| # | Excluded | Rationale |

|---|---|---|

| 1 | User accounts, login, JWT, sessions, password hashing | No multi-tenancy in v1; would consume ~1 of 3 days |

| 2 | Column create / rename / delete / reorder | Columns are seeded per board and immutable in v1 |

| 3 | Drag-and-drop card movement | Move buttons ship first; DnD is a stretch goal (§9.1) |

| 4 | Real-time sync, WebSockets, multi-client updates | Single-client assumption; refresh is acceptable |

| 5 | Card attachments, images, file uploads | — |

| 6 | Comments, activity log, audit history | — |

| 7 | Labels / tags / custom fields | `priority` is the only card metadata |

| 8 | Due dates, reminders, notifications, email | — |

| 9 | Search, filtering, sorting beyond column position | Board sizes in v1 are small |

| 10 | Card archiving, soft delete, trash / undo | Deletes are hard deletes |

| 11 | Nested subtasks (subtasks of subtasks) | Exactly one level of nesting |

| 12 | Moving subtasks between cards, or promoting a subtask to a card | — |

| 13 | AI features beyond decomposition (summarisation, chat, auto-move, board-wide re-ranking) | Exactly one AI feature, done well |

| 14 | Persisting AI proposals in the database (`ai_suggestions` staging table) | Proposals are ephemeral; see §6.5 |

| 15 | Streaming LLM responses to the UI | Single request/response |

| 16 | Rate limiting, quotas, cost tracking, API keys per user | — |

| 17 | Pagination on any endpoint | — |

| 18 | Deployment, Docker Compose for Postgres, CI/CD | Schema must be *portable*, not *deployed* to Postgres |

| 19 | Dark mode, i18n, mobile-responsive layout | Desktop-width only |

| 20 | Optimistic concurrency / conflict resolution (ETags, version columns) | Last write wins |



### 2.1 What a "mini" board can skip that a real one cannot



Recorded so the scope decisions are defensible in review, not accidental:



- **WIP limits per column.** Core to real Kanban practice; pure decoration without a team.

- **Swimlanes.** A second axis of grouping; doubles the ordering logic for no demo value.

- **Fractional / gapped position indices.** Real boards use gapped or fractional ordering to avoid rewriting rows on every move. v1 renumbers sequentially inside a transaction (§4.6) — correct and simple, `O(n)` per move on boards of tens of cards.

- **Card-level permissions and assignees.** Both presuppose users.

- **Undo.** Expected in any real tool; here, deletion is confirmed via a dialog instead.



---



## 3. Architecture



```

React (Vite) SPA ──HTTP/JSON──▶ FastAPI ──SQLAlchemy ORM──▶ SQLite (dev)

│ Postgres (portable)

└──▶ LLM provider (groq | mock)

```



- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.x (declarative, typed), Pydantic v2, Alembic, `uvicorn`.

- **Frontend:** React 18 + Vite + TypeScript. Plain `fetch`, no state-management library. Styling minimal and self-authored or a single lightweight CSS approach — no component library required.

- **Database:** SQLite file at `./kanban.db` in dev. Schema MUST be Postgres-portable (§4.1).

- **Layout:**



```

backend/

app/

main.py # FastAPI app, CORS, router mounting

db.py # engine, SessionLocal, get_db dependency, FK pragma

models.py # SQLAlchemy ORM models

schemas.py # Pydantic request/response models

routers/

boards.py

cards.py

subtasks.py

ai.py

services/

ordering.py # position normalisation

llm/

base.py # LLMProvider protocol

groq_provider.py

mock_provider.py

decompose.py # prompt, parse, validate, retry

alembic/

tests/

.env.example

frontend/

src/

api/client.ts

components/

pages/

_docs/

specs.md

```



---



## 4. Data model



Four tables: `boards`, `columns`, `cards`, `subtasks`.



### 4.1 Portability rules (MUST)



The schema must run unchanged on SQLite and PostgreSQL. Therefore:



1. **Primary keys are UUID strings**, `String(36)`, generated in Python via `uuid.uuid4()`. Do not use autoincrement integers (sequence semantics differ) or a native `UUID` column type (Postgres-only).

2. **No native enums.** Use `String(N)` plus an explicit `CheckConstraint`. Native `ENUM` requires a Postgres type and painful migrations.

3. **Timestamps** use `DateTime(timezone=True)` with `server_default=func.now()`. Never store naive datetimes or SQLite date strings.

4. **No SQLite-specific types or pragmas in the model layer** (`JSON` is permitted but unused in v1).

5. **Foreign keys are declared with `ondelete="CASCADE"`** *and* an ORM-level `cascade="all, delete-orphan"` relationship. SQLite ignores FK actions unless pragma is on, so the ORM cascade is the load-bearing one; the DDL cascade is for Postgres.

6. **SQLite FK enforcement MUST be enabled** via a `connect` event listener issuing `PRAGMA foreign_keys=ON`.

7. **Alembic manages schema.** No `Base.metadata.create_all()` in application startup. The initial migration must be generated and committed.

8. No database-generated positions, triggers, or stored procedures.



### 4.2 `boards`



| Column | Type | Constraints |

|---|---|---|

| `id` | String(36) | PK |

| `name` | String(120) | NOT NULL, non-empty after strip |

| `created_at` | DateTime(tz) | NOT NULL, server default now |



### 4.3 `columns`



| Column | Type | Constraints |

|---|---|---|

| `id` | String(36) | PK |

| `board_id` | String(36) | FK → `boards.id` ON DELETE CASCADE, NOT NULL, indexed |

| `name` | String(60) | NOT NULL |

| `position` | Integer | NOT NULL, 0-based |



Seeded on board creation, in this order: `To Do` (0), `In Progress` (1), `Done` (2). Exactly three per board in v1, created in the same transaction as the board.



### 4.4 `cards`



| Column | Type | Constraints |

|---|---|---|

| `id` | String(36) | PK |

| `column_id` | String(36) | FK → `columns.id` ON DELETE CASCADE, NOT NULL, indexed |

| `title` | String(200) | NOT NULL, non-empty after strip |

| `description` | Text | NULLABLE |

| `priority` | String(6) | NOT NULL, default `"MEDIUM"`, CHECK IN (`LOW`,`MEDIUM`,`HIGH`) |

| `position` | Integer | NOT NULL, 0-based within its column |

| `created_at` | DateTime(tz) | NOT NULL, server default now |

| `updated_at` | DateTime(tz) | NOT NULL, server default now, `onupdate=now()` |



### 4.5 `subtasks`



| Column | Type | Constraints |

|---|---|---|

| `id` | String(36) | PK |

| `card_id` | String(36) | FK → `cards.id` ON DELETE CASCADE, NOT NULL, indexed |

| `title` | String(200) | NOT NULL, non-empty after strip |

| `is_done` | Boolean | NOT NULL, default `False` |

| `position` | Integer | NOT NULL, 0-based within its card |

| `created_at` | DateTime(tz) | NOT NULL, server default now |

| `origin` | String(6) | NOT NULL, default `"USER"`, CHECK IN (`USER`,`AI`) |



`origin` is the one piece of AI provenance kept in v1. It costs one column, lets the UI badge AI-generated subtasks, and gives the demo something concrete to point at.



### 4.6 Ordering semantics (MUST)



- `position` is a **contiguous 0-based integer sequence** within its parent (cards within a column; subtasks within a card). There are never gaps or duplicates after a completed request.

- Creating a card appends it: `position = count(cards in column)`.

- Moving or deleting triggers **renumbering inside a single transaction**: remove from source list, insert at target index, then rewrite `position` for all affected rows in both source and target columns.

- `target_position` on move is **clamped** to `[0, len(target_column_cards)]`. An out-of-range value is not an error.

- No unique constraint on `(column_id, position)` — it would fire mid-renumber. Correctness is enforced by the service layer and asserted in tests.



---



## 5. HTTP API



Base path `/api`. All request and response bodies are JSON. All IDs are UUID strings.



### 5.1 Conventions



- `200` on successful read/update, `201` on create, `204` on delete.

- `404` when a path ID does not exist.

- `422` for validation failures (FastAPI default shape).

- Errors from application logic use: `{"detail": {"code": "MACHINE_CODE", "message": "human readable"}}`.

- CORS allows the Vite dev origin (`http://localhost:5173`) via env var.



### 5.2 Endpoints



| Method | Path | Purpose |

|---|---|---|

| `GET` | `/api/health` | Liveness. Returns `{"status":"ok","llm_provider":"groq"}` |

| `GET` | `/api/boards` | List boards (id, name, created_at, card_count) |

| `POST` | `/api/boards` | Create board + seed 3 columns |

| `GET` | `/api/boards/{board_id}` | Full board tree: columns → cards → subtasks |

| `PATCH` | `/api/boards/{board_id}` | Rename board |

| `DELETE` | `/api/boards/{board_id}` | Delete board and all descendants |

| `POST` | `/api/columns/{column_id}/cards` | Create card (appended to end) |

| `PATCH` | `/api/cards/{card_id}` | Update `title`, `description`, `priority` |

| `DELETE` | `/api/cards/{card_id}` | Delete card and its subtasks |

| `POST` | `/api/cards/{card_id}/move` | Move card within/between columns |

| `POST` | `/api/cards/{card_id}/ai/decompose` | **Read-only.** Return AI proposal |

| `POST` | `/api/cards/{card_id}/subtasks` | Bulk-create subtasks (accepts a proposal) |

| `PATCH` | `/api/subtasks/{subtask_id}` | Update `title` or `is_done` |

| `DELETE` | `/api/subtasks/{subtask_id}` | Delete subtask |



### 5.3 Key payloads



**`GET /api/boards/{board_id}`** →



```json

{

"id": "b1f2...",

"name": "Launch MVP",

"created_at": "2026-09-09T10:00:00Z",

"columns": [

{

"id": "c1...", "name": "To Do", "position": 0,

"cards": [

{

"id": "k1...", "column_id": "c1...",

"title": "Set up deployment pipeline",

"description": "CI, staging, prod",

"priority": "HIGH", "position": 0,

"created_at": "2026-09-09T10:01:00Z",

"updated_at": "2026-09-09T10:01:00Z",

"subtasks": [

{ "id": "s1...", "title": "Choose CI provider", "is_done": false, "position": 0, "origin": "AI" }

]

}

]

}

]

}

```



**`POST /api/cards/{card_id}/move`** →



```json

{ "target_column_id": "c2...", "target_position": 0 }

```



Returns `200` with the updated board tree (simplest correct client refresh). `target_column_id` MUST belong to the same board as the card; otherwise `409` with code `CROSS_BOARD_MOVE`.



**`POST /api/cards/{card_id}/subtasks`** →



```json

{

"subtasks": [ { "title": "Choose CI provider" }, { "title": "Write deploy script" } ],

"origin": "AI",

"priority": "HIGH"

}

```



Appends subtasks after any existing ones, in array order. `origin` defaults to `"USER"`. `priority` is optional; when present it updates the parent card. Empty `subtasks` array → `422`. Maximum 20 per request.



---



## 6. The AI feature, end to end



### 6.1 Configuration



`.env.example` MUST contain:



```

LLM_PROVIDER=groq # groq | mock

GROQ_API_KEY=

GROQ_MODEL=openai/gpt-oss-20b

LLM_TIMEOUT_SECONDS=20

LLM_MAX_RETRIES=1

CORS_ORIGINS=http://localhost:5173

DATABASE_URL=sqlite:///./kanban.db

```



Provider selection happens once at startup behind an `LLMProvider` protocol with a single method: `complete(system: str, user: str) -> str`. `groq_provider` calls the Groq chat completions API; `mock_provider` returns a deterministic canned JSON payload derived from the card title. No provider-specific code leaks outside `services/llm/`.



### 6.2 Request flow



1. `POST /api/cards/{card_id}/ai/decompose`, empty body.

2. Backend loads the card; `404` if missing.

3. If `card.title.strip()` is empty → `422`.

4. Build the prompt from `title`, `description`, and the names of existing subtasks (so a re-run doesn't duplicate work).

5. Call the provider with `LLM_TIMEOUT_SECONDS`.

6. Parse and validate (§6.3). On validation failure, retry up to `LLM_MAX_RETRIES` with a repair instruction appended.

7. Return the proposal. **No database write occurs on this endpoint, ever.**



### 6.3 Output contract



The model is instructed to return JSON only, no prose, no code fences. The backend strips fences defensively before parsing, then validates with a Pydantic model:



```json

{

"subtasks": ["Choose CI provider", "Write deploy script", "Add staging environment"],

"suggested_priority": "HIGH",

"rationale": "Deployment work blocks every later release step."

}

```



Validation rules:

- `subtasks`: 3–6 items, each a non-empty string ≤ 120 characters after strip, duplicates removed case-insensitively.

- `suggested_priority`: exactly one of `LOW`, `MEDIUM`, `HIGH`.

- `rationale`: non-empty string ≤ 240 characters.



The endpoint response wraps this:



```json

{

"card_id": "k1...",

"proposal": { "subtasks": [...], "suggested_priority": "HIGH", "rationale": "..." },

"model": "openai/gpt-oss-20b",

"provider": "groq"

}

```



### 6.4 Failure handling (MUST)



| Condition | Status | `code` |

|---|---|---|

| `LLM_PROVIDER=groq` and `GROQ_API_KEY` empty | `503` | `LLM_NOT_CONFIGURED` |

| Provider timeout or network error | `504` | `LLM_UNAVAILABLE` |

| Provider non-2xx | `502` | `LLM_UPSTREAM_ERROR` |

| Output fails validation after retries | `502` | `LLM_INVALID_OUTPUT` |



Every one of these MUST surface in the UI as a dismissable inline error inside the modal, naming what went wrong. The card is left untouched. A failed decompose must never leave the board in a partial state — trivially guaranteed, since the endpoint does not write.



### 6.5 Why proposals are not persisted



An `ai_suggestions` table would add a fifth table, a status state machine (`pending`/`accepted`/`rejected`), and two more endpoints, to support an audit trail nobody in v1 reads. The proposal lives in React state between the decompose call and the accept call. Cost of losing it: the user clicks the button again. Recorded here so the omission reads as a decision.



### 6.6 Accepting a proposal



The modal is fully editable before commit: the user may edit any subtask's text, remove rows, and change the suggested priority. **Accept** issues a single `POST /api/cards/{card_id}/subtasks` with `origin: "AI"` and the (possibly edited) priority. **Cancel** closes the modal and discards everything.



---



## 7. Frontend



### 7.1 Screens



1. **Board list** (`/`) — cards-in-a-grid list of boards with card counts, a create form, and delete with confirmation.

2. **Board view** (`/boards/:boardId`) — three columns side by side, each a vertical stack of cards, each column with an "Add card" affordance.

3. **Card detail modal** — title, description, priority selector, subtask checklist with add/edit/delete, and the **Break into subtasks** button.

4. **AI proposal modal** — loading state, editable proposal list, rationale text, suggested-priority selector, Accept / Cancel, inline error area.



### 7.2 Behaviour



- Data fetching is refetch-on-mutation: after any successful write, re-`GET` the board tree and re-render. No optimistic updates, no cache layer. This is a deliberate simplification and is why `move` returns the whole tree.

- Move controls in v1 are **◀ / ▶ buttons** on each card, disabled at the ends, plus ▲ / ▼ for position within a column.

- Every destructive action (delete board, card, subtask) requires a confirm dialog.

- The decompose button shows a spinner and is disabled while in flight.

- AI-origin subtasks render with a small "AI" badge.



---



## 8. Acceptance criteria



Each is independently verifiable. The agent should treat these as the definition of done.



**Boards**

1. Creating a board with name "Launch MVP" returns `201` and a board whose `columns` array has exactly three entries named `To Do`, `In Progress`, `Done` with positions 0, 1, 2.

2. Creating a board with an empty or whitespace-only name returns `422` and creates nothing.

3. `GET /api/boards` lists every created board with an accurate `card_count`.

4. Deleting a board removes its columns, cards, and subtasks; a subsequent `GET` of that board returns `404` and no orphan rows remain in any table.



**Cards**

5. Creating three cards in an empty column yields positions 0, 1, 2 in creation order.

6. Deleting the middle of three cards leaves the remaining two at positions 0 and 1.

7. `PATCH` on a card updates only the supplied fields and bumps `updated_at`.

8. Creating a card without an explicit priority stores `MEDIUM`.

9. `PATCH` with `priority: "URGENT"` returns `422` and does not modify the row.



**Moving**

10. Moving a card to another column with `target_position: 0` places it first there, and both source and target columns are left with contiguous 0-based positions.

11. Moving a card with `target_position: 999` clamps it to last position without error.

12. Moving a card into a column belonging to a different board returns `409` with code `CROSS_BOARD_MOVE` and changes nothing.



**Subtasks**

13. Bulk-creating three subtasks on a card with two existing subtasks appends them at positions 2, 3, 4.

14. Toggling `is_done` persists across a reload.

15. Deleting a card deletes its subtasks.

16. A bulk-create request with an empty `subtasks` array returns `422`.



**AI feature**

17. With `LLM_PROVIDER=mock`, `POST /api/cards/{id}/ai/decompose` returns `200` with 3–6 subtasks, a valid `suggested_priority`, and a rationale.

18. A decompose call writes nothing: row counts in `cards` and `subtasks` are identical before and after.

19. With `LLM_PROVIDER=groq` and no API key set, the endpoint returns `503` / `LLM_NOT_CONFIGURED`, and the UI shows an inline error rather than a blank modal.

20. Given a stubbed provider returning malformed JSON on every attempt, the endpoint returns `502` / `LLM_INVALID_OUTPUT` after exhausting `LLM_MAX_RETRIES`.

21. Given a stubbed provider returning JSON wrapped in ```` ```json ```` fences, parsing succeeds.

22. Given a stubbed provider returning 8 subtasks, validation rejects the payload (bounds are enforced, not silently truncated).

23. Accepting a proposal after editing one subtask's text persists the **edited** text, not the original.

24. Subtasks created via accept have `origin = "AI"`; subtasks added manually have `origin = "USER"`.



**Portability**

25. `alembic upgrade head` succeeds against a fresh SQLite file and creates all four tables.

26. No model uses a native `Enum` type, autoincrement integer PK, or dialect-specific column type; every status-like column is `String` + `CheckConstraint`.

27. With `PRAGMA foreign_keys=ON` active, inserting a card with a non-existent `column_id` raises an integrity error.



**End to end**

28. From a clean database, a user can create a board, add a card, run decompose in mock mode, accept the proposal, tick a subtask, and move the card to Done — with no page-level errors and all state surviving a browser refresh.



---



## 9. Three-day plan



**Day 1 — Spec and backend core.** Finalise this document. Scaffold FastAPI, models, Alembic initial migration, board/column/card CRUD, ordering service with unit tests for AC 5–12.



**Day 2 — AI feature and frontend skeleton.** LLM provider abstraction, mock provider, decompose endpoint with validation and retry, tests for AC 17–24. React board view rendering the tree, card create/edit/delete.



**Day 3 — Wire-up and polish.** Proposal modal, accept flow, move buttons, confirm dialogs, error surfaces, end-to-end pass of AC 28, README with setup steps, demo recording.



### 9.1 Stretch goals (only if Day 3 finishes early)



1. Drag-and-drop card movement — reuses `POST /api/cards/{id}/move` unchanged, so this is purely frontend work.

2. Subtask reordering.

3. A `progress` indicator on the card face (`2/5 done`).



---



## 10. Testing



- `pytest` with a function-scoped in-memory SQLite fixture and FastAPI `TestClient`.

- LLM tests use a stub provider injected via dependency override — **no test may make a network call**.

- Minimum coverage: every acceptance criterion in §8 that describes an API behaviour has a corresponding test.



---



## 11. Open questions



None blocking. Two decisions were made by default and may be overruled without disturbing the schema or the API: move buttons instead of drag-and-drop in v1 (§7.2), and the presence of a `mock` LLM provider (§6.1).


Centralize every backend call in one services layer, and create a mock
implementation of it so the whole app runs without a real backend.

Add tests.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3bb627e1-d63d-4a27-9952-08ad3aa8d2aa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
