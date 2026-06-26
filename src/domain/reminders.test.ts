import { describe, expect, it } from "vitest";
import { findDueReminders, snoozeTodo } from "./reminders";
import type { Todo } from "./types";

const baseTodo: Todo = {
  id: "todo-1",
  title: "周四迭代评审会议",
  description: "准备演示版本",
  location: "会议室 A",
  dueAt: "2026-06-26T14:00:00+08:00",
  priority: "high",
  category: "工作",
  status: "pending",
  reminderEnabled: true,
  reminderOffsetMinutes: 0,
  repeatRule: { type: "none" },
  nextReminderAt: "2026-06-26T14:00:00+08:00",
  lastRemindedAt: null,
  createdAt: "2026-06-26T09:00:00+08:00",
  updatedAt: "2026-06-26T09:00:00+08:00",
  completedAt: null,
};

describe("findDueReminders", () => {
  it("returns pending reminders due at or before now", () => {
    const due = findDueReminders([baseTodo], "2026-06-26T14:00:00+08:00");

    expect(due).toEqual([baseTodo]);
  });

  it("does not return done, disabled, future, or already-reminded todos", () => {
    const todos: Todo[] = [
      { ...baseTodo, id: "done", status: "done" },
      { ...baseTodo, id: "disabled", reminderEnabled: false },
      { ...baseTodo, id: "future", nextReminderAt: "2026-06-26T15:00:00+08:00" },
      { ...baseTodo, id: "already", lastRemindedAt: "2026-06-26T14:00:00+08:00" },
    ];

    const due = findDueReminders(todos, "2026-06-26T14:00:00+08:00");

    expect(due).toEqual([]);
  });
});

describe("snoozeTodo", () => {
  it("moves the next reminder ten minutes after now", () => {
    const snoozed = snoozeTodo(baseTodo, "2026-06-26T14:00:00+08:00", 10);

    expect(snoozed.nextReminderAt).toBe("2026-06-26T14:10:00+08:00");
    expect(snoozed.updatedAt).toBe("2026-06-26T14:00:00+08:00");
  });
});
