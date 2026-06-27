import Database from "@tauri-apps/plugin-sql";
import type { Priority, RepeatRule, Todo, TodoStatus } from "../domain/types";

export const TODO_TABLE_MIGRATION = `
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  due_at TEXT NOT NULL,
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  reminder_enabled INTEGER NOT NULL,
  reminder_offset_minutes INTEGER NOT NULL,
  repeat_rule TEXT NOT NULL,
  next_reminder_at TEXT,
  last_reminded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
`;

export interface TodoRow {
  id: string;
  title: string;
  description: string;
  location: string;
  due_at: string;
  priority: Priority;
  category: string;
  status: TodoStatus;
  reminder_enabled: number;
  reminder_offset_minutes: number;
  repeat_rule: string;
  next_reminder_at: string | null;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

let databasePromise: Promise<Database> | null = null;

export const TODO_UPSERT_SQL = `INSERT INTO todos (
  id, title, description, location, due_at, priority, category, status,
  reminder_enabled, reminder_offset_minutes, repeat_rule, next_reminder_at,
  last_reminded_at, created_at, updated_at, completed_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  location = excluded.location,
  due_at = excluded.due_at,
  priority = excluded.priority,
  category = excluded.category,
  status = excluded.status,
  reminder_enabled = excluded.reminder_enabled,
  reminder_offset_minutes = excluded.reminder_offset_minutes,
  repeat_rule = excluded.repeat_rule,
  next_reminder_at = excluded.next_reminder_at,
  last_reminded_at = excluded.last_reminded_at,
  updated_at = excluded.updated_at,
  completed_at = excluded.completed_at`;

export const TODO_MARK_DONE_SQL = `UPDATE todos
SET status = 'done', completed_at = $1, updated_at = $2
WHERE id = $3`;

export const TODO_REOPEN_SQL = `UPDATE todos
SET status = 'pending', completed_at = NULL, updated_at = $1
WHERE id = $2`;

export const TODO_DELETE_SQL = "DELETE FROM todos WHERE id = $1";
export const TODO_MARK_REMINDER_SEEN_SQL = `UPDATE todos
SET last_reminded_at = $1, updated_at = $2
WHERE id = $3`;

export function mapTodoRow(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    dueAt: row.due_at,
    priority: row.priority,
    category: row.category,
    status: row.status,
    reminderEnabled: row.reminder_enabled === 1,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    repeatRule: JSON.parse(row.repeat_rule) as RepeatRule,
    nextReminderAt: row.next_reminder_at,
    lastRemindedAt: row.last_reminded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load("sqlite:liuyun.db").then(async (db) => {
      await db.execute(TODO_TABLE_MIGRATION);
      return db;
    });
  }
  return databasePromise;
}

export async function listTodos(): Promise<Todo[]> {
  const db = await getDatabase();
  const rows = await db.select<TodoRow[]>("SELECT * FROM todos ORDER BY due_at ASC");
  return rows.map(mapTodoRow);
}

export async function upsertTodo(todo: Todo): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    TODO_UPSERT_SQL,
    [
      todo.id,
      todo.title,
      todo.description,
      todo.location,
      todo.dueAt,
      todo.priority,
      todo.category,
      todo.status,
      todo.reminderEnabled ? 1 : 0,
      todo.reminderOffsetMinutes,
      JSON.stringify(todo.repeatRule),
      todo.nextReminderAt,
      todo.lastRemindedAt,
      todo.createdAt,
      todo.updatedAt,
      todo.completedAt,
    ],
  );
}

export async function markTodoDone(id: string, now: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(TODO_MARK_DONE_SQL, [now, now, id]);
}

export async function reopenTodo(id: string, now: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(TODO_REOPEN_SQL, [now, id]);
}

export async function deleteTodo(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(TODO_DELETE_SQL, [id]);
}

export async function markTodoReminderSeen(id: string, remindedAt: string, now: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(TODO_MARK_REMINDER_SEEN_SQL, [remindedAt, now, id]);
}
