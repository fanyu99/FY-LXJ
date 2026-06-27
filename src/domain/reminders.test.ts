import { describe, expect, it } from "vitest";
import { completeTodoFromReminder, deserializeReminder, findDueReminders, getReminderSeenKey, serializeReminder, snoozeTodo } from "./reminders";
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

describe("getReminderSeenKey", () => {
  it("uses nextReminderAt as the de-duplication key", () => {
    expect(getReminderSeenKey(baseTodo, "2026-06-26T14:00:12+08:00")).toBe("2026-06-26T14:00:00+08:00");
  });

  it("falls back to now when nextReminderAt is absent", () => {
    expect(getReminderSeenKey({ ...baseTodo, nextReminderAt: null }, "2026-06-26T14:00:12+08:00")).toBe(
      "2026-06-26T14:00:12+08:00",
    );
  });
});

describe("snoozeTodo", () => {
  it("moves the next reminder ten minutes after now", () => {
    const snoozed = snoozeTodo(baseTodo, "2026-06-26T14:00:00+08:00", 10);

    expect(snoozed.dueAt).toBe("2026-06-26T14:10:00+08:00");
    expect(snoozed.nextReminderAt).toBe("2026-06-26T14:10:00+08:00");
    expect(snoozed.updatedAt).toBe("2026-06-26T14:00:00+08:00");
  });

  it("clears the last reminder key so snoozed reminders can fire again", () => {
    const snoozed = snoozeTodo(
      {
        ...baseTodo,
        lastRemindedAt: "2026-06-26T14:00:00+08:00",
      },
      "2026-06-26T14:00:00+08:00",
      10,
    );

    expect(snoozed.lastRemindedAt).toBeNull();
    expect(findDueReminders([snoozed], "2026-06-26T14:10:00+08:00")).toEqual([snoozed]);
  });
});

describe("completeTodoFromReminder", () => {
  it("marks non-repeating todos as done", () => {
    expect(completeTodoFromReminder(baseTodo, "2026-06-26T14:05:00+08:00")).toMatchObject({
      status: "done",
      completedAt: "2026-06-26T14:05:00+08:00",
      updatedAt: "2026-06-26T14:05:00+08:00",
    });
  });

  it("moves repeating todos to the next occurrence and reminder time", () => {
    const completed = completeTodoFromReminder(
      {
        ...baseTodo,
        repeatRule: { type: "daily" },
        reminderOffsetMinutes: 15,
      },
      "2026-06-26T14:05:00+08:00",
    );

    expect(completed).toMatchObject({
      status: "pending",
      dueAt: "2026-06-27T14:00:00+08:00",
      nextReminderAt: "2026-06-27T13:45:00+08:00",
      lastRemindedAt: null,
      completedAt: null,
      updatedAt: "2026-06-26T14:05:00+08:00",
    });
  });
});

describe("reminder serialization", () => {
  it("round-trips reminder payloads for the reminder window", () => {
    const encoded = serializeReminder(baseTodo);
    expect(deserializeReminder(encoded)).toEqual(baseTodo);
  });
});
