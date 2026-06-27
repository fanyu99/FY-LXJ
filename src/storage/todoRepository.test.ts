import { describe, expect, it } from "vitest";
import { mapTodoRow, TODO_DELETE_SQL, TODO_MARK_DONE_SQL, TODO_MARK_REMINDER_SEEN_SQL, TODO_REOPEN_SQL, TODO_UPSERT_SQL, TODO_TABLE_MIGRATION } from "./todoRepository";

describe("TODO_TABLE_MIGRATION", () => {
  it("creates a local-only todos table with reminder and repeat fields", () => {
    expect(TODO_TABLE_MIGRATION).toContain("CREATE TABLE IF NOT EXISTS todos");
    expect(TODO_TABLE_MIGRATION).toContain("location TEXT NOT NULL");
    expect(TODO_TABLE_MIGRATION).toContain("repeat_rule TEXT NOT NULL");
    expect(TODO_TABLE_MIGRATION).toContain("next_reminder_at TEXT");
  });
});

describe("mapTodoRow", () => {
  it("maps a SQLite row into the Todo domain type", () => {
    const todo = mapTodoRow({
      id: "todo-1",
      title: "家人聚餐",
      description: "预订晚上 6 点临江餐厅座位，4 人。",
      location: "临江餐厅",
      due_at: "2026-06-27T18:00:00+08:00",
      priority: "medium",
      category: "个人",
      status: "pending",
      reminder_enabled: 1,
      reminder_offset_minutes: 30,
      repeat_rule: '{"type":"none"}',
      next_reminder_at: "2026-06-27T17:30:00+08:00",
      last_reminded_at: null,
      created_at: "2026-06-25T18:00:00+08:00",
      updated_at: "2026-06-25T18:00:00+08:00",
      completed_at: null,
    });

    expect(todo).toEqual({
      id: "todo-1",
      title: "家人聚餐",
      description: "预订晚上 6 点临江餐厅座位，4 人。",
      location: "临江餐厅",
      dueAt: "2026-06-27T18:00:00+08:00",
      priority: "medium",
      category: "个人",
      status: "pending",
      reminderEnabled: true,
      reminderOffsetMinutes: 30,
      repeatRule: { type: "none" },
      nextReminderAt: "2026-06-27T17:30:00+08:00",
      lastRemindedAt: null,
      createdAt: "2026-06-25T18:00:00+08:00",
      updatedAt: "2026-06-25T18:00:00+08:00",
      completedAt: null,
    });
  });
});

describe("TODO_UPSERT_SQL", () => {
  it("uses sqlite-compatible numbered placeholders", () => {
    expect(TODO_UPSERT_SQL).toContain("VALUES ($1, $2, $3");
    expect(TODO_UPSERT_SQL).not.toContain("VALUES (?,");
  });
});

describe("todo mutation SQL", () => {
  it("uses sqlite-compatible placeholders for completion and deletion", () => {
    expect(TODO_MARK_DONE_SQL).toContain("WHERE id = $3");
    expect(TODO_REOPEN_SQL).toContain("WHERE id = $2");
    expect(TODO_DELETE_SQL).toBe("DELETE FROM todos WHERE id = $1");
    expect(TODO_MARK_REMINDER_SEEN_SQL).toContain("last_reminded_at = $1");
  });
});
