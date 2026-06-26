export type Priority = "high" | "medium" | "low";

export type TodoStatus = "pending" | "done" | "overdue";

export type RepeatRule =
  | { type: "none" }
  | { type: "daily" }
  | { type: "weekly" }
  | { type: "monthly" };

export interface Todo {
  id: string;
  title: string;
  description: string;
  location: string;
  dueAt: string;
  priority: Priority;
  category: string;
  status: TodoStatus;
  reminderEnabled: boolean;
  reminderOffsetMinutes: number;
  repeatRule: RepeatRule;
  nextReminderAt: string | null;
  lastRemindedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AppSettings {
  launchOnStartup: boolean;
  fontFamily: "lxgw-wenkai" | "system";
  fontSize: number;
  themeColor: string;
  backgroundImagePath: string | null;
  backgroundOpacity: number;
}
