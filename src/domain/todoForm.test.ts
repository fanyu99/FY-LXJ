import { describe, expect, it } from "vitest";
import { createTodoFromForm, todoToFormValues, updateTodoFromForm } from "./todoForm";
import type { Todo } from "./types";

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

describe("todo edit form helpers", () => {
  const existingTodo: Todo = {
    id: "todo-1",
    title: "旧标题",
    description: "旧描述",
    location: "旧地点",
    dueAt: "2026-06-28T16:30:00+08:00",
    priority: "high",
    category: "工作",
    status: "done",
    reminderEnabled: true,
    reminderOffsetMinutes: 15,
    repeatRule: { type: "monthly" },
    nextReminderAt: "2026-06-28T16:15:00+08:00",
    lastRemindedAt: "2026-06-28T16:15:00+08:00",
    createdAt: "2026-06-20T10:00:00+08:00",
    updatedAt: "2026-06-28T16:20:00+08:00",
    completedAt: "2026-06-28T16:45:00+08:00",
  };

  it("converts an existing todo into editable form values", () => {
    expect(todoToFormValues(existingTodo)).toEqual({
      title: "旧标题",
      description: "旧描述",
      location: "旧地点",
      date: "2026-06-28",
      time: "16:30",
      priority: "high",
      category: "工作",
      reminderEnabled: true,
      reminderOffsetMinutes: 15,
      repeatType: "monthly",
    });
  });

  it("updates editable fields while preserving identity", () => {
    const updated = updateTodoFromForm(
      existingTodo,
      {
        title: "  新标题  ",
        description: "新描述",
        location: "新地点",
        date: "2026-06-30",
        time: "08:10",
        priority: "low",
        category: "学习",
        reminderEnabled: true,
        reminderOffsetMinutes: 30,
        repeatType: "daily",
      },
      {
        now: "2026-06-29T12:00:00+08:00",
        timezoneOffset: "+08:00",
      },
    );

    expect(updated).toMatchObject({
      id: "todo-1",
      title: "新标题",
      description: "新描述",
      location: "新地点",
      dueAt: "2026-06-30T08:10:00+08:00",
      priority: "low",
      category: "学习",
      status: "pending",
      reminderEnabled: true,
      reminderOffsetMinutes: 30,
      repeatRule: { type: "daily" },
      nextReminderAt: "2026-06-30T07:40:00+08:00",
      lastRemindedAt: null,
      createdAt: "2026-06-20T10:00:00+08:00",
      updatedAt: "2026-06-29T12:00:00+08:00",
      completedAt: null,
    });
  });

  it("keeps a completed todo done when the edited due time is still in the past", () => {
    const updated = updateTodoFromForm(
      existingTodo,
      {
        title: "旧事项补充",
        description: "已完成记录",
        location: "旧地点",
        date: "2026-06-28",
        time: "08:10",
        priority: "medium",
        category: "工作",
        reminderEnabled: true,
        reminderOffsetMinutes: 30,
        repeatType: "none",
      },
      {
        now: "2026-06-29T12:00:00+08:00",
        timezoneOffset: "+08:00",
      },
    );

    expect(updated).toMatchObject({
      status: "done",
      completedAt: "2026-06-28T16:45:00+08:00",
      nextReminderAt: "2026-06-28T07:40:00+08:00",
    });
  });
});
