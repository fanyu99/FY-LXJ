import { describe, expect, it } from "vitest";
import { createTodoFromForm } from "./todoForm";

describe("createTodoFromForm", () => {
  it("creates a pending todo with location, reminder, and repeat rule", () => {
    const todo = createTodoFromForm(
      {
        title: "购买生日蛋糕",
        description: "选择低糖款，顺路买蜡烛。",
        location: "万象城",
        date: "2026-06-28",
        time: "16:30",
        priority: "medium",
        category: "个人",
        reminderEnabled: true,
        reminderOffsetMinutes: 30,
        repeatType: "weekly",
      },
      {
        id: "fixed-id",
        now: "2026-06-26T20:30:00+08:00",
        timezoneOffset: "+08:00",
      },
    );

    expect(todo).toEqual({
      id: "fixed-id",
      title: "购买生日蛋糕",
      description: "选择低糖款，顺路买蜡烛。",
      location: "万象城",
      dueAt: "2026-06-28T16:30:00+08:00",
      priority: "medium",
      category: "个人",
      status: "pending",
      reminderEnabled: true,
      reminderOffsetMinutes: 30,
      repeatRule: { type: "weekly" },
      nextReminderAt: "2026-06-28T16:00:00+08:00",
      lastRemindedAt: null,
      createdAt: "2026-06-26T20:30:00+08:00",
      updatedAt: "2026-06-26T20:30:00+08:00",
      completedAt: null,
    });
  });

  it("trims optional text fields and disables next reminder when reminder is off", () => {
    const todo = createTodoFromForm(
      {
        title: "  整理桌面  ",
        description: "  ",
        location: "  书房  ",
        date: "2026-06-29",
        time: "",
        priority: "low",
        category: "个人",
        reminderEnabled: false,
        reminderOffsetMinutes: 0,
        repeatType: "none",
      },
      {
        id: "fixed-id-2",
        now: "2026-06-26T20:30:00+08:00",
        timezoneOffset: "+08:00",
      },
    );

    expect(todo.title).toBe("整理桌面");
    expect(todo.description).toBe("");
    expect(todo.location).toBe("书房");
    expect(todo.dueAt).toBe("2026-06-29T09:00:00+08:00");
    expect(todo.nextReminderAt).toBeNull();
  });
});
