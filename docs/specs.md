# Product Specification: Mini Kanban Board (HW2 MVP)

**Version:** 1.0  
**Date:** 2026-09-09  
**Status:** Approved for Implementation  
**Course Context:** AI Dev Tools Zoomcamp 2026 — Homework 2 (Full-Stack AI-Assisted App)  

---

## 1. Project Overview & Goal

### Core Problem
Developers and project managers often create vague, high-level task cards (e.g., "Implement User Auth" or "Refactor API") that are difficult to estimate, prioritize, and execute without breaking them down into actionable steps.

### Solution
The **Mini Kanban Board** is a lightweight, responsive full-stack task management application. It allows users to manage cards across columns and features an **AI-powered Decompose Agent** that analyzes large, ambiguous cards, breaks them down into 3–5 concrete subtasks, and suggests priority levels via a Human-in-the-Loop preview workflow before committing any changes to the database.

### Primary Objectives
* **Spec-Driven Architecture:** Maintain a strict OpenAPI contract (`openapi.yaml`) between the React frontend and FastAPI backend.
* **Database Agnostic:** Built with SQLAlchemy ORM over SQLite, ensuring seamless migration to PostgreSQL for future deployment modules.
* **Reliable AI Integration:** Use Groq API (`openai/gpt-oss-20b`) with a Propose → Preview Modal → Accept pattern to prevent malformed LLM outputs from corrupting database state.

---

## 2. MVP Scope Boundaries

### In Scope (v1)
1. **Board Hierarchy (No Auth):**
   * Multi-board support accessible via URL slug / ID (`/boards/{board_id}`).
   * Default board (`default`) seeded automatically on startup if no boards exist.
2. **Column Structure:**
   * Seeded columns per board: `To Do` (position 0), `In Progress` (position 1), `Done` (position 2).
   * Fixed column list in v1 (no dynamic column creation or renaming endpoints).
3. **Card Management (CRUD):**
   * Create card under a specific column with `title`, `description`, `priority` (`LOW`, `MEDIUM`, `HIGH`).
   * Read card details including checklist of subtasks.
   * Update card `title`, `description`, `priority`, or move card between columns (`column_id`).
   * Delete card (cascade deletes subtasks).
   * Manual position/order management within columns.
4. **Subtasks & Checklist:**
   * Add, toggle completion (`is_completed`), edit, and delete individual subtasks manually.
5. **AI Feature (Subtask Decomposition & Priority Suggestion):**
   * Endpoint `POST /api/cards/{id}/ai-decompose`.
   * Sends card `title` and `description` to Groq LLM (`LLM_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-20b`).
   * Returns structured JSON draft containing 3–5 proposed subtask title strings and an optional recommended priority.
   * **Human-in-the-Loop Preview Modal:** Frontend displays proposed subtasks in an interactive modal. The user can edit, remove, or accept suggestions before making a database write call (`POST /api/cards/{card_id}/subtasks/batch`).
6. **Technical Stack:**
   * **Backend:** Python 3.11+, FastAPI, `uv` package manager, SQLAlchemy ORM, Pydantic v2, Pytest.
   * **Database:** SQLite (`sqlite:///./kanban.db`).
   * **Frontend:** React + TypeScript (Vite), Tailwind CSS / Shadcn UI components, isolated API client layer.

### Out of Scope (v1 Non-Goals)
* User authentication, authorization, or multi-tenant user roles (deferred to future iterations).
* Full Column CRUD (adding, renaming, or deleting columns dynamically).
* Drag-and-Drop library integration (card movement via dropdown/button triggers in v1).
* WebSockets or real-time multi-user syncing (standard REST HTTP endpoints suffice for HW2).
* Direct automatic AI commits to DB without user preview/approval.

---

## 3. Data Model & Database Schema

The database uses SQLAlchemy ORM models structured for database-agnostic portability (Postgres-ready).

```
 ┌──────────────┐       1:N       ┌──────────────┐
 │    Board     ├────────────────>│    Column    │
 └──────────────┘                 └──────┬───────┘
                                         │ 1:N
                                         ▼
 ┌──────────────┐       1:N       ┌──────────────┐
 │   Subtask    │<────────────────┤     Card     │
 └──────────────┘                 └──────────────┘
```

### Tables Specification

#### 1. `boards`
* `id` (String, Primary Key) — UUID or slug (e.g. "default", "project-a").
* `title` (String, Not Null) — Board display name.
* `created_at` (DateTime, Default: UTC Now).

#### 2. `columns`
* `id` (Integer, Primary Key, Autoincrement).
* `board_id` (String, Foreign Key -> `boards.id`, On Delete CASCADE, Index).
* `title` (String, Not Null) — Column name (`To Do`, `In Progress`, `Done`).
* `position` (Integer, Not Null) — Column sequence order (0, 1, 2).
* `created_at` (DateTime, Default: UTC Now).

#### 3. `cards`
* `id` (Integer, Primary Key, Autoincrement).
* `column_id` (Integer, Foreign Key -> `columns.id`, On Delete CASCADE, Index).
* `title` (String(255), Not Null).
* `description` (Text, Nullable).
* `priority` (Enum/String: `'LOW'`, `'MEDIUM'`, `'HIGH'`, Default: `'MEDIUM'`).
* `position` (Integer, Not Null, Default: 0) — Order within column.
* `created_at` (DateTime, Default: UTC Now).
* `updated_at` (DateTime, Default: UTC Now, On Update: UTC Now).

#### 4. `subtasks`
* `id` (Integer, Primary Key, Autoincrement).
* `card_id` (Integer, Foreign Key -> `cards.id`, On Delete CASCADE, Index).
* `title` (String(255), Not Null).
* `is_completed` (Boolean, Default: False).
* `position` (Integer, Not Null, Default: 0).
* `created_at` (DateTime, Default: UTC Now).

---

## 4. API Contract & Endpoint Overview

All API endpoints are defined in `openapi.yaml`. Key endpoints include:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/boards` | List all boards |
| `GET` | `/api/boards/{id}` | Get board details with nested columns, cards, and subtasks |
| `POST` | `/api/boards` | Create a new board (auto-seeds default columns) |
| `GET` | `/api/boards/{id}/columns` | List columns for a board |
| `POST` | `/api/columns/{column_id}/cards` | Create a new card in a column |
| `GET` | `/api/cards/{id}` | Get card details including subtasks |
| `PATCH` | `/api/cards/{id}` | Update card fields (`title`, `description`, `priority`, `column_id`, `position`) |
| `DELETE` | `/api/cards/{id}` | Delete a card and its subtasks |
| `POST` | `/api/cards/{id}/subtasks` | Add a manual subtask |
| `POST` | `/api/cards/{id}/subtasks/batch` | Batch insert subtasks (used after AI preview approval) |
| `PATCH` | `/api/subtasks/{id}` | Toggle `is_completed` or edit subtask title |
| `DELETE` | `/api/subtasks/{id}` | Delete a subtask |
| `POST` | `/api/cards/{id}/ai-decompose` | Request AI decomposition & priority draft (returns JSON preview) |

---

## 5. AI Feature Specification (Decompose & Prioritize)

### Endpoint: `POST /api/cards/{id}/ai-decompose`

#### Pipeline Workflow:
1. **Client Action:** User clicks **"AI Split & Prioritize"** on a Card details modal.
2. **Backend Processing:**
   - Retrieves `title` and `description` of Card `{id}` from SQLite.
   - Formulates a system prompt forcing structured JSON output from Groq API (`openai/gpt-oss-20b`).
   - Timeout: 8 seconds maximum.
3. **Structured Response:**
   ```json
   {
     "card_id": 12,
     "suggested_priority": "HIGH",
     "proposed_subtasks": [
       {"title": "Set up OAuth2 provider configuration"},
       {"title": "Implement JWT token generation & refresh endpoint"},
       {"title": "Add auth middleware to protected routes"}
     ]
   }
   ```
4. **Human-in-the-Loop Preview (Frontend):**
   - Frontend displays modal preview with checkboxes and editable text fields for each subtask.
   - User can uncheck, edit, or add subtasks, and accept or reject suggested priority.
5. **Commit Phase:**
   - Clicking **"Apply Suggestions"** calls `POST /api/cards/{id}/subtasks/batch` and `PATCH /api/cards/{id}` to persist changes.
6. **Graceful Degradation:**
   - If Groq API fails or times out, UI displays a clear toast notification: *"AI Service unavailable. You can still add subtasks manually."* No database mutation occurs.

---

## 6. Verifiable Acceptance Criteria (ACs)

### AC-01: Board & Seeded Columns Initial State
* **Given** a clean database installation,
* **When** the application starts up or a new board is created,
* **Then** a board exists with exactly three columns (`To Do`, `In Progress`, `Done`) in correct position order (0, 1, 2).

### AC-02: Card CRUD Operations
* **Given** an existing column,
* **When** a user submits a card creation form with a title,
* **Then** a new card row is created in SQLite, assigned to that `column_id`, and displayed in the frontend column view.

### AC-03: Moving Cards Between Columns
* **Given** a card in column `To Do`,
* **When** the user changes the column selector to `In Progress`,
* **Then** a `PATCH /api/cards/{id}` request is sent with `column_id`, the card moves visually to `In Progress`, and refreshing the browser preserves the new column location.

### AC-04: AI Subtask Generation Preview
* **Given** a card titled *"Implement User Authentication"*,
* **When** the user clicks **"AI Split & Prioritize"**,
* **Then** an API call is made to `POST /api/cards/{id}/ai-decompose`, a loading spinner is shown, and within 8 seconds a preview modal pops up displaying 3–5 actionable subtasks without modifying the database yet.

### AC-05: AI Preview Approval & Database Persistence
* **Given** the AI Preview modal is open with 3 proposed subtasks,
* **When** the user clicks **"Apply Suggestions"**,
* **Then** the batch create endpoint persists the 3 subtasks to SQLite, the subtasks checklist updates on the card, and closing/reopening the card shows the saved subtasks.

### AC-06: Manual Subtask Toggle
* **Given** a card with 3 subtasks,
* **When** the user clicks the checkbox on the first subtask,
* **Then** `PATCH /api/subtasks/{id}` sets `is_completed: true`, and the card header reflects completion progress (e.g. `1/3 completed`).

### AC-07: Error Handling & Resilience
* **Given** invalid input (e.g. empty card title) or an offline AI provider,
* **When** the user attempts the operation,
* **Then** the UI displays an explicit error message, prevents broken requests, and retains existing database state.

---

## 7. Development Constraints & Toolchain

* **Package Management:** `uv` (`uv sync`, `uv add`, `uv run pytest`).
* **Environment Setup:** `AGENTS.md` and `_docs/process.md` present in root.
* **Testing:** Pytest unit and integration test suite covering API endpoints (`uv run pytest`).
* **OpenAPI Contract:** `openapi.yaml` maintained as the authoritative API contract.
* **Portability:** Standard SQL types and SQLAlchemy ORM conventions to ensure direct compatibility with PostgreSQL when migrating in Module 3.
