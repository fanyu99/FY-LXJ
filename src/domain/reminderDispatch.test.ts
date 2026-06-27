import { describe, expect, it } from "vitest";
import { dispatchFirstDueReminder } from "./reminderDispatch";
import type { Todo } from "./types";

const baseTodo: Todo = {
  id: "todo-1",
  title: "提醒测试",
  description: "验证弹窗成功后再写已提醒",
  location: "本机",
  dueAt: "2026-06-27T15:00:00+08:00",
  priority: "medium",
  category: "测试",
  status: "pending",
  reminderEnabled: true,
  reminderOffsetMinutes: 0,
  repeatRule: { type: "none" },
  nextReminderAt: "2026-06-27T15:00:00+08:00",
  lastRemindedAt: null,
  createdAt: "2026-06-27T14:50:00+08:00",
  updatedAt: "2026-06-27T14:50:00+08:00",
  completedAt: null,
};

describe("dispatchFirstDueReminder", () => {
  it("marks a reminder as seen only after the popup is created", async () => {
    const calls: string[] = [];

    const result = await dispatchFirstDueReminder([baseTodo], "2026-06-27T15:00:00+08:00", {
      getExistingReminderWindow: async () => null,
      createReminderWindow: async () => {
        calls.push("create");
      },
      markReminderSeen: async () => {
        calls.push("mark");
      },
    });

    expect(result).toBe("created");
    expect(calls).toEqual(["create", "mark"]);
  });

  it("does not mark a reminder as seen when popup creation fails", async () => {
    const calls: string[] = [];

    await expect(
      dispatchFirstDueReminder([baseTodo], "2026-06-27T15:00:00+08:00", {
        getExistingReminderWindow: async () => null,
        createReminderWindow: async () => {
          calls.push("create");
          throw new Error("permission denied");
        },
        markReminderSeen: async () => {
          calls.push("mark");
        },
      }),
    ).rejects.toThrow("permission denied");

    expect(calls).toEqual(["create"]);
  });
});
