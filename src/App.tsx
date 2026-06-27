import "./App.css";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { sampleSettings, sampleTodos } from "./domain/sampleData";
import type { AppSettings, RepeatRule, Todo } from "./domain/types";
import { createTodoFromForm, todoToFormValues, updateTodoFromForm, type TodoFormValues } from "./domain/todoForm";
import { deleteTodo, listTodos, markTodoReminderSeen, reopenTodo, upsertTodo } from "./storage/todoRepository";
import {
  completeTodoFromReminder,
  deserializeReminder,
  findDueReminders,
  getReminderSeenKey,
  snoozeTodo,
  serializeReminder,
} from "./domain/reminders";
import { dispatchFirstDueReminder } from "./domain/reminderDispatch";
import { normalizeAppSettings } from "./domain/appSettings";
import { isEmbeddedBackgroundImage, toCssBackgroundImage, toCssBackgroundPosition, toCssBackgroundSize } from "./domain/background";
import { applySettingsDraftPatch, hasSettingsDraftChanges, resetSettingsDraft } from "./domain/settingsDraft";
import { loadBrowserSettings, saveBrowserSettings } from "./domain/settingsStorage";
import { getTimezoneOffsetLabel, nowLocalIso, todayLocalDateKey } from "./domain/time";
import { REMINDER_WINDOW_OPTIONS } from "./domain/reminderWindow";

type TaskView = "all" | "today" | "upcoming" | "overdue";
const todosChangedEvent = "todos-changed";

const taskNavItems: [TaskView, string][] = [
  ["all", "全部待办"],
  ["today", "今日任务"],
  ["upcoming", "即将到来"],
  ["overdue", "已逾期"],
];

const defaultAppSettings: AppSettings = {
  ...sampleSettings,
  launchOnStartup: true,
};

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function repeatLabel(rule: RepeatRule): string {
  if (rule.type === "daily") return "每天";
  if (rule.type === "weekly") return "每周";
  if (rule.type === "monthly") return "每月";
  return "不重复";
}

function formatTodayLabel(): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function priorityLabel(priority: Todo["priority"]): string {
  if (priority === "high") return "高";
  if (priority === "medium") return "中";
  return "低";
}

function getTodoDate(todo: Todo): string {
  return todo.dueAt.slice(0, 10);
}

function getTaskViewTitle(view: TaskView): string {
  if (view === "today") return "今日任务";
  if (view === "upcoming") return "即将到来";
  if (view === "overdue") return "已逾期";
  return "全部待办";
}

function filterTodosByView(todos: Todo[], view: TaskView): Todo[] {
  const today = todayLocalDateKey();

  if (view === "today") {
    return todos.filter((todo) => getTodoDate(todo) === today);
  }

  if (view === "upcoming") {
    const nowMs = new Date(nowLocalIso()).getTime();
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    return todos
      .filter((todo) => {
        const dueMs = new Date(todo.dueAt).getTime();
        return dueMs > nowMs && dueMs <= nowMs + twelveHoursMs;
      })
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  if (view === "overdue") {
    const now = nowLocalIso();
    return todos.filter((todo) => todo.status !== "done" && todo.dueAt < now);
  }

  return todos;
}

function matchesSearch(todo: Todo, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const fields = [todo.title, todo.description, todo.location, todo.category, repeatLabel(todo.repeatRule)];
  return fields.some((field) => field.toLowerCase().includes(normalized));
}

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function backgroundImageFor(path: string | null): string {
  return toCssBackgroundImage(path, isTauri() ? convertFileSrc : undefined);
}

async function notifyTodosChanged() {
  if (isTauri()) {
    await emit(todosChangedEvent);
  }
}

function getReminderParam(): Todo | null {
  const reminder = new URLSearchParams(window.location.search).get("reminder");
  if (!reminder) {
    return null;
  }

  try {
    return deserializeReminder(reminder);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function createReminderWindow(label: string, reminder: Todo): Promise<WebviewWindow> {
  return new Promise((resolve, reject) => {
    const reminderWindow = new WebviewWindow(label, {
      url: `index.html?reminder=${serializeReminder(reminder)}`,
      title: "待办提醒",
      decorations: true,
      alwaysOnTop: true,
      transparent: false,
      skipTaskbar: true,
      width: REMINDER_WINDOW_OPTIONS.width,
      height: REMINDER_WINDOW_OPTIONS.height,
      focus: true,
      center: true,
    });

    void reminderWindow.once<null>("tauri://created", () => resolve(reminderWindow));
    void reminderWindow.once<unknown>("tauri://error", (event) => reject(new Error(errorMessage(event.payload))));
  });
}

function ReminderView({ reminder }: { reminder: Todo }) {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    void invoke<unknown>("get_app_settings")
      .then((loaded) => setSettings(normalizeAppSettings(loaded, defaultAppSettings)))
      .catch((error) => {
        console.error(error);
      });
  }, []);

  const style = {
    ["--accent" as string]: settings.themeColor,
    ["--font-size" as string]: `${settings.fontSize}px`,
    ["--bg-opacity" as string]: settings.backgroundOpacity,
    ["--bg-position" as string]: toCssBackgroundPosition(settings.backgroundPositionX, settings.backgroundPositionY),
    ["--bg-size" as string]: toCssBackgroundSize(settings.backgroundScale),
    backgroundImage: backgroundImageFor(settings.backgroundImagePath),
  };

  async function runReminderAction(action: () => Promise<void>) {
    setActionError("");
    setIsActing(true);

    try {
      await action();
      await closeReminderWindow();
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "提醒操作失败，请检查本地权限或 SQLite。");
    } finally {
      setIsActing(false);
    }
  }

  async function closeReminderWindow() {
    if (isTauri()) {
      await getCurrentWindow().close();
    }
  }

  return (
    <div className={`reminder-shell font-${settings.fontFamily}`} style={style}>
      <div className="reminder-backdrop" />
      <section className="reminder-card">
        <div className="reminder-header">
          <span className="reminder-chip">系统后台提醒</span>
          <button className="ghost-button" disabled={isActing} onClick={() => void closeReminderWindow()}>
            收起
          </button>
        </div>
        <div className="reminder-title">
          <h1>{reminder.title}</h1>
          <span className={`priority ${reminder.priority}`}>{priorityLabel(reminder.priority)}</span>
        </div>
        <p className="reminder-description">{reminder.description}</p>
        <div className="reminder-meta">
          <span>{formatDueDate(reminder.dueAt)}</span>
          <span>{reminder.location}</span>
          <span>{reminder.category}</span>
          <span>{repeatLabel(reminder.repeatRule)}</span>
        </div>
        <div className="reminder-actions">
          <button
            disabled={isActing}
            onClick={() =>
              void runReminderAction(async () => {
                const now = nowLocalIso();
                const completed = completeTodoFromReminder(reminder, now);
                if (isTauri()) {
                  await upsertTodo(completed);
                  await notifyTodosChanged();
                }
              })
            }
          >
            标记完成
          </button>
          <button
            disabled={isActing}
            onClick={() =>
              void runReminderAction(async () => {
                const now = nowLocalIso();
                const snoozed = snoozeTodo(reminder, now, settings.snoozeMinutes);
                if (isTauri()) {
                  await upsertTodo(snoozed);
                  await notifyTodosChanged();
                }
              })
            }
          >
            {settings.snoozeMinutes}分钟后提醒
          </button>
          <button
            disabled={isActing}
            onClick={() =>
              void runReminderAction(async () => {
                const now = nowLocalIso();
                if (isTauri()) {
                  await markTodoReminderSeen(reminder.id, getReminderSeenKey(reminder, now), now);
                  await notifyTodosChanged();
                }
              })
            }
          >
            忽略
          </button>
        </div>
        {actionError ? <p className="reminder-error">{actionError}</p> : null}
      </section>
    </div>
  );
}

function TodoItem({
  todo,
  onToggleDone,
  onDelete,
  onEdit,
}: {
  todo: Todo;
  onToggleDone: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
}) {
  return (
    <article className={`todo-item ${todo.status === "done" ? "done" : ""}`}>
      <button
        className={`todo-check ${todo.status === "done" ? "checked" : ""}`}
        aria-label={todo.status === "done" ? "恢复未完成" : "标记完成"}
        onClick={() => onToggleDone(todo)}
      />
      <div className="todo-body">
        <div className="todo-title-row">
          <h3>{todo.title}</h3>
          <span className={`priority ${todo.priority}`}>{priorityLabel(todo.priority)}</span>
        </div>
        <p>{todo.description}</p>
        <div className="todo-meta">
          <span>{formatDueDate(todo.dueAt)}</span>
          <span>{todo.location}</span>
          <span>{todo.category}</span>
          <span>{repeatLabel(todo.repeatRule)}</span>
        </div>
      </div>
      <div className="todo-actions">
        <button onClick={() => onEdit(todo)}>编辑</button>
        <button className="danger-action" onClick={() => onDelete(todo)}>
          删除
        </button>
      </div>
    </article>
  );
}

function SettingsPanel({
  settings,
  onPreview,
  onCancel,
  onSave,
}: {
  settings: AppSettings;
  onPreview: (settings: AppSettings) => void;
  onCancel: () => void;
  onSave: (settings: AppSettings) => void;
}) {
  const [draft, setDraft] = useState<AppSettings>(() => resetSettingsDraft(settings));
  const [isReadingBackground, setReadingBackground] = useState(false);
  const hasChanges = hasSettingsDraftChanges(settings, draft);
  const backgroundSummary = draft.backgroundImagePath
    ? isEmbeddedBackgroundImage(draft.backgroundImagePath)
      ? "当前背景：网页选择的图片或 GIF"
      : `当前背景：${draft.backgroundImagePath}`
    : "当前背景：未设置";
  const backgroundPreviewStyle = {
    ["--accent" as string]: draft.themeColor,
    ["--font-size" as string]: `${draft.fontSize}px`,
    ["--bg-opacity" as string]: draft.backgroundOpacity,
    ["--bg-position" as string]: toCssBackgroundPosition(draft.backgroundPositionX, draft.backgroundPositionY),
    ["--bg-size" as string]: toCssBackgroundSize(draft.backgroundScale),
    backgroundImage: backgroundImageFor(draft.backgroundImagePath),
  };

  const backgroundOverlayStyle = {
    opacity: draft.backgroundOpacity,
  };

  // When persisted settings change (e.g. loaded from backend), reset draft
  useEffect(() => {
    setDraft(resetSettingsDraft(settings));
  }, [settings]);

  // Helper: capture value synchronously to avoid React 19 synthetic event nullification
  function patch(update: Partial<AppSettings>) {
    setDraft((current) => {
      const nextDraft = applySettingsDraftPatch(current, update);
      onPreview(nextDraft);
      return nextDraft;
    });
  }

  function cancelChanges() {
    const savedSettings = resetSettingsDraft(settings);
    setDraft(savedSettings);
    onPreview(savedSettings);
    onCancel();
  }

  function saveChanges() {
    void onSave(resetSettingsDraft(draft));
  }

  function chooseBrowserBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    setReadingBackground(true);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setReadingBackground(false);
      if (typeof reader.result === "string") {
        patch({ backgroundImagePath: reader.result, backgroundPositionX: 50, backgroundPositionY: 50, backgroundScale: 120 });
      }
    });
    reader.addEventListener("error", () => {
      setReadingBackground(false);
    });
    reader.readAsDataURL(file);
  }

  async function chooseDesktopBackground() {
    setReadingBackground(true);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "图片或 GIF",
            extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
          },
        ],
      });

      if (typeof selected === "string") {
        patch({ backgroundImagePath: selected, backgroundPositionX: 50, backgroundPositionY: 50, backgroundScale: 120 });
      }
    } finally {
      setReadingBackground(false);
    }
  }

  function clearBackground() {
    patch({ backgroundImagePath: null, backgroundPositionX: 50, backgroundPositionY: 50, backgroundScale: 120 });
  }

  return (
    <section className="panel">
      <h2>本地设置</h2>
      <div className="settings-grid">
        <label>
          <span>字体</span>
          <select value={draft.fontFamily} onChange={(event) => {
            const value = event.currentTarget.value as AppSettings["fontFamily"];
            patch({ fontFamily: value });
          }}>
            <option value="lxgw-wenkai">内置中文字体</option>
            <option value="system">系统字体</option>
          </select>
        </label>
        <label>
          <span>字号</span>
          <input type="number" min="12" max="24" value={draft.fontSize} onChange={(event) => {
            const value = Number(event.currentTarget.value);
            patch({ fontSize: value });
          }} />
        </label>
        {isTauri() ? (
          <div className="settings-inline-actions">
            <button type="button" onClick={() => void chooseDesktopBackground()} disabled={isReadingBackground}>
              选择本地图片/GIF
            </button>
          </div>
        ) : (
          <label>
            <span>选择本地图片/GIF</span>
            <input type="file" accept="image/*,.gif" onChange={chooseBrowserBackground} />
          </label>
        )}
        <div className="settings-note">{isReadingBackground ? "正在读取背景图..." : backgroundSummary}</div>
        <div className="settings-inline-actions">
          <button type="button" onClick={clearBackground} disabled={!draft.backgroundImagePath}>
            清除背景
          </button>
        </div>
        {draft.backgroundImagePath ? (
          <div className="background-crop">
            <div className="background-crop-preview" style={backgroundPreviewStyle}>
              <div className="background-crop-overlay" style={backgroundOverlayStyle} />
              <div className="background-crop-marker">预览效果</div>
            </div>
            <label>
              <span>背景横向位置</span>
              <input type="range" min="0" max="100" value={draft.backgroundPositionX} onChange={(event) => {
                const value = Number(event.currentTarget.value);
                patch({ backgroundPositionX: value });
              }} />
            </label>
            <label>
              <span>背景纵向位置</span>
              <input type="range" min="0" max="100" value={draft.backgroundPositionY} onChange={(event) => {
                const value = Number(event.currentTarget.value);
                patch({ backgroundPositionY: value });
              }} />
            </label>
            <label>
              <span>背景缩放</span>
              <input type="range" min="50" max="300" value={draft.backgroundScale} onChange={(event) => {
                const value = Number(event.currentTarget.value);
                patch({ backgroundScale: value });
              }} />
            </label>
          </div>
        ) : null}
        <label>
          <span>背景透明度</span>
          <input type="range" min="0.2" max="1" step="0.05" value={draft.backgroundOpacity} onChange={(event) => {
            const value = Number(event.currentTarget.value);
            patch({ backgroundOpacity: value });
          }} />
        </label>
        <label>
          <span>提醒轮询(秒)</span>
          <input type="number" min="10" max="300" value={draft.reminderRecheckSeconds} onChange={(event) => {
            const value = Number(event.currentTarget.value);
            patch({ reminderRecheckSeconds: value });
          }} />
        </label>
        <label>
          <span>稍后提醒(分钟)</span>
          <input type="number" min="1" max="240" value={draft.snoozeMinutes} onChange={(event) => {
            const value = Number(event.currentTarget.value);
            patch({ snoozeMinutes: value });
          }} />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={draft.launchOnStartup} onChange={(event) => {
            const checked = event.currentTarget.checked;
            patch({ launchOnStartup: checked });
          }} />
          <span>电脑启动时自动运行</span>
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={draft.closeToTray} onChange={(event) => {
            const checked = event.currentTarget.checked;
            patch({ closeToTray: checked });
          }} />
          <span>关闭窗口后后台运行</span>
        </label>
      </div>
      <div className="settings-actions">
        <button type="button" onClick={cancelChanges} disabled={!hasChanges}>取消更改</button>
        <button type="button" className="primary" onClick={saveChanges} disabled={!hasChanges || isReadingBackground}>
          保存设置
        </button>
      </div>
    </section>
  );
}

function App() {
  const reminder = useMemo(() => getReminderParam(), []);
  if (reminder) {
    return <ReminderView reminder={reminder} />;
  }

  const [todos, setTodos] = useState<Todo[]>(sampleTodos);
  const [dataMode, setDataMode] = useState("浏览器预览数据");
  const [activeView, setActiveView] = useState<TaskView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [liveSettings, setLiveSettings] = useState<AppSettings>(defaultAppSettings);
  const [formValues, setFormValues] = useState<TodoFormValues>({
    title: "",
    description: "",
    location: "",
    date: todayLocalDateKey(),
    time: "09:00",
    priority: "medium",
    category: "个人",
    reminderEnabled: true,
    reminderOffsetMinutes: 15,
    repeatType: "none",
  });

  useEffect(() => {
    async function loadLocalState() {
      if (!isTauri()) {
        const browserSettings = loadBrowserSettings(window.localStorage, defaultAppSettings);
        setSettings(browserSettings);
        setLiveSettings(browserSettings);
        setDataMode("浏览器预览数据");
        return;
      }

      try {
        const [loadedSettings, localTodos] = await Promise.all([
          invoke<unknown>("get_app_settings").then((loaded) => normalizeAppSettings(loaded, defaultAppSettings)).catch(() => defaultAppSettings),
          listTodos(),
        ]);
        if (localTodos.length === 0) {
          await Promise.all(sampleTodos.map((todo) => upsertTodo(todo)));
          setTodos(await listTodos());
        } else {
          setTodos(localTodos);
        }
        setSettings(loadedSettings);
        setLiveSettings(loadedSettings);
        setDataMode("SQLite 本地数据");
      } catch (error) {
        console.error(error);
        setDataMode("SQLite 读取失败，显示预览数据");
      }
    }

    void loadLocalState();
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    void listen(todosChangedEvent, () => {
      void refreshLocalTodos();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    const intervalMs = Math.max(10, settings.reminderRecheckSeconds) * 1000;
    const interval = window.setInterval(async () => {
      try {
        const localTodos = await listTodos();
        setTodos(localTodos);
        const now = nowLocalIso();
        const due = findDueReminders(localTodos, now);
        await dispatchFirstDueReminder(due, now, {
          getExistingReminderWindow: (label) => WebviewWindow.getByLabel(label),
          createReminderWindow,
          markReminderSeen: markTodoReminderSeen,
        });
      } catch (error) {
        console.error(error);
        setActionError(`提醒弹窗创建失败：${errorMessage(error)}`);
      }
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [settings.reminderRecheckSeconds]);

  const pendingCount = todos.filter((todo) => todo.status !== "done").length;
  const doneCount = todos.filter((todo) => todo.status === "done").length;
  const allCount = todos.length;
  const today = todayLocalDateKey();
  const todayCount = todos.filter((todo) => getTodoDate(todo) === today).length;
  const upcomingCount = todos.filter((todo) => {
    const dueMs = new Date(todo.dueAt).getTime();
    const nowMs = new Date(nowLocalIso()).getTime();
    return dueMs > nowMs && dueMs <= nowMs + 12 * 60 * 60 * 1000;
  }).length;
  const overdueCount = todos.filter((todo) => todo.status !== "done" && todo.dueAt < nowLocalIso()).length;
  const visibleTodos = filterTodosByView(todos, activeView).filter((todo) => matchesSearch(todo, searchQuery));
  const pageTitle = getTaskViewTitle(activeView);
  const pageDescription =
    activeView === "all"
      ? "显示全部本地待办"
      : activeView === "today"
        ? "只显示今天到期的任务"
        : activeView === "upcoming"
          ? "显示12小时之内即将到期的任务"
          : "只显示已过期但未完成的任务";
  const searchActive = searchQuery.trim().length > 0;

  function updateForm<K extends keyof TodoFormValues>(key: K, value: TodoFormValues[K]) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setFormValues({
      title: "",
      description: "",
      location: "",
      date: todayLocalDateKey(),
      time: "09:00",
      priority: "medium",
      category: "个人",
      reminderEnabled: true,
      reminderOffsetMinutes: 15,
      repeatType: "none",
    });
  }

  function openCreateComposer() {
    setEditingTodo(null);
    setFormError("");
    resetForm();
    setComposerOpen(true);
  }

  function openEditComposer(todo: Todo) {
    setEditingTodo(todo);
    setFormError("");
    setFormValues(todoToFormValues(todo));
    setComposerOpen(true);
  }

  function handleQuitApp() {
    if (!window.confirm("确定退出流云吗？未保存的待办可能丢失。")) {
      return;
    }
    if (isTauri()) {
      void getCurrentWindow().close();
    } else {
      window.close();
    }
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditingTodo(null);
    setFormError("");
  }

  async function refreshLocalTodos() {
    if (isTauri()) {
      const localTodos = await listTodos();
      setTodos(localTodos);
      setDataMode("SQLite 本地数据");
      return;
    }

    setTodos((current) => [...current]);
    setDataMode("浏览器预览数据");
  }

  async function handleToggleDone(todo: Todo) {
    setActionError("");

    try {
      if (isTauri()) {
        const now = nowLocalIso();
        if (todo.status === "done") {
          await reopenTodo(todo.id, now);
        } else {
          await upsertTodo(completeTodoFromReminder(todo, now));
        }
        await refreshLocalTodos();
        return;
      }

      const now = nowLocalIso();
      setTodos((current) =>
        current.map((item) =>
          item.id === todo.id
            ? {
                ...item,
                ...(item.status === "done"
                  ? { status: "pending" as const, completedAt: null, updatedAt: now }
                  : completeTodoFromReminder(item, now)),
              }
            : item,
        ),
      );
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "切换完成状态失败，请检查本地 SQLite。");
    }
  }

  async function handleDeleteTodo(todo: Todo) {
    if (!window.confirm(`确定删除“${todo.title}”吗？`)) {
      return;
    }

    setActionError("");

    try {
      if (isTauri()) {
        await deleteTodo(todo.id);
        await refreshLocalTodos();
        return;
      }

      setTodos((current) => current.filter((item) => item.id !== todo.id));
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "删除失败，请检查本地 SQLite。");
    }
  }

  async function handleCreateTodo() {
    if (!formValues.title.trim() || !formValues.location.trim()) {
      setFormError("请填写任务标题和地点。");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const todo = editingTodo
        ? updateTodoFromForm(editingTodo, formValues, {
            now: nowLocalIso(),
            timezoneOffset: getTimezoneOffsetLabel(),
          })
        : createTodoFromForm(formValues, {
            id: crypto.randomUUID(),
            now: nowLocalIso(),
            timezoneOffset: getTimezoneOffsetLabel(),
          });

      if (isTauri()) {
        await upsertTodo(todo);
        await refreshLocalTodos();
        setDataMode("SQLite 本地数据");
      } else {
        setTodos((current) => {
          const withoutEdited = current.filter((item) => item.id !== todo.id);
          return [...withoutEdited, todo].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
        });
        setDataMode("浏览器预览数据");
      }

      closeComposer();
      resetForm();
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : "保存失败，请检查本地 SQLite 连接。");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings(nextSettings: AppSettings) {
    try {
      const normalizedDraft = normalizeAppSettings(nextSettings, settings);
      if (!isTauri()) {
        saveBrowserSettings(window.localStorage, normalizedDraft);
        setSettings(normalizedDraft);
        setLiveSettings(normalizedDraft);
        setSettingsNotice("设置已保存到网页本地存储。刷新页面后仍会保留。");
        setActionError("");
        return;
      }

      const saved = await invoke<AppSettings>("save_app_settings", { settings: normalizedDraft });
      const normalizedSaved = normalizeAppSettings(saved, defaultAppSettings);
      setSettings(normalizedSaved);
      setLiveSettings(normalizedSaved);
      setSettingsNotice("设置已保存。");
      setActionError("");
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "设置保存失败。");
    }
  }

  const appStyle = {
    ["--accent" as string]: liveSettings.themeColor,
    ["--font-size" as string]: `${liveSettings.fontSize}px`,
    ["--bg-opacity" as string]: liveSettings.backgroundOpacity,
    ["--bg-position" as string]: toCssBackgroundPosition(liveSettings.backgroundPositionX, liveSettings.backgroundPositionY),
    ["--bg-size" as string]: toCssBackgroundSize(liveSettings.backgroundScale),
    backgroundImage: backgroundImageFor(liveSettings.backgroundImagePath),
  };

  return (
    <div className={`app-shell font-${liveSettings.fontFamily} ${liveSettings.backgroundImagePath ? "has-background" : ""}`} style={appStyle}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">✓</div>
          <div>
            <div className="brand-name">流云</div>
            <div className="brand-subtitle">本地待办</div>
          </div>
        </div>

        <nav>
          <section className="nav-group">
            <div className="nav-label">任务</div>
            {taskNavItems.map(([value, label]) => {
              const badge =
                value === "all"
                  ? allCount
                  : value === "today"
                    ? todayCount
                    : value === "upcoming"
                      ? upcomingCount
                      : overdueCount;
              return (
                <button
                  className={`nav-item ${activeView === value ? "active" : ""}`}
                  key={value}
                  onClick={() => setActiveView(value)}
                >
                  <span>{label}</span>
                  <span className="nav-badge">{badge}</span>
                </button>
              );
            })}
          </section>
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-signature">Megumi (●'◡'●)~</span>
          <button className="quit-button" onClick={handleQuitApp}>
            退出程序
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{pageTitle}</h1>
            <p>{formatTodayLabel()} · {pageDescription} · {dataMode}</p>
          </div>
          <div className="topbar-actions">
            <button
              className="ghost"
              onClick={() => {
                setSettingsOpen((current) => !current);
              }}
            >
              设置
            </button>
            <input
              placeholder="搜索待办、地点或分类"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
            />
            <button className="primary" onClick={openCreateComposer}>
              新建待办
            </button>
          </div>
        </header>
        {actionError ? <div className="action-error">{actionError}</div> : null}
        {settingsNotice ? <div className="search-chip">{settingsNotice}</div> : null}
        {searchActive ? <div className="search-chip">搜索中：{searchQuery}</div> : null}

        <section className="content">
          <div className="todo-list">
            {visibleTodos.length > 0 ? (
              visibleTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggleDone={handleToggleDone}
                  onDelete={handleDeleteTodo}
                  onEdit={openEditComposer}
                />
              ))
            ) : (
              <div className="empty-state">
                <strong>当前页面没有待办</strong>
                <p>可以切换左侧页面，或者新建一条任务。</p>
              </div>
            )}
          </div>

          <aside className="inspector">
            <section className="panel">
              <h2>今日概览</h2>
              <div className="stats">
                <div>
                  <strong>{pendingCount}</strong>
                  <span>未完成</span>
                </div>
                <div>
                  <strong>{doneCount}</strong>
                  <span>已完成</span>
                </div>
              </div>
            </section>

            <section className="panel">
              <h2>提醒设置</h2>
              <dl>
                <div>
                  <dt>提醒弹窗</dt>
                  <dd>{liveSettings.closeToTray ? "后台常驻" : "关闭即退出"}</dd>
                </div>
                <div>
                  <dt>字体</dt>
                  <dd>{liveSettings.fontFamily === "lxgw-wenkai" ? "内置中文字体" : "系统字体"}</dd>
                </div>
                <div>
                  <dt>背景</dt>
                  <dd>支持 JPG / PNG / GIF</dd>
                </div>
                <div>
                  <dt>透明度</dt>
                  <dd>{Math.round(liveSettings.backgroundOpacity * 100)}%</dd>
                </div>
              </dl>
            </section>

            {isSettingsOpen ? (
              <SettingsPanel
                settings={settings}
                onPreview={(nextSettings) => {
                  setLiveSettings(nextSettings);
                  setSettingsNotice("存在未保存的设置更改。");
                }}
                onCancel={() => setSettingsNotice("已取消当前未保存更改。")}
                onSave={(nextSettings) => void handleSaveSettings(nextSettings)}
              />
            ) : null}
          </aside>
        </section>
      </main>

      {isComposerOpen ? (
        <div className="modal-backdrop" onMouseDown={closeComposer}>
          <section className="todo-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h2>{editingTodo ? "编辑待办事项" : "新建待办事项"}</h2>
              <button onClick={closeComposer} aria-label="关闭待办弹窗">
                ×
              </button>
            </header>

            <div className="form-grid">
              <label className="field span-2">
                <span>任务标题</span>
                <input value={formValues.title} onChange={(event) => updateForm("title", event.currentTarget.value)} placeholder="输入任务标题" />
              </label>

              <label className="field span-2">
                <span>任务描述</span>
                <textarea value={formValues.description} onChange={(event) => updateForm("description", event.currentTarget.value)} placeholder="添加详细描述" />
              </label>

              <label className="field">
                <span>地点</span>
                <input value={formValues.location} onChange={(event) => updateForm("location", event.currentTarget.value)} placeholder="例如：会议室 A" />
              </label>

              <label className="field">
                <span>分类</span>
                <select value={formValues.category} onChange={(event) => updateForm("category", event.currentTarget.value)}>
                  <option>个人</option>
                  <option>工作</option>
                  <option>学习</option>
                </select>
              </label>

              <label className="field">
                <span>日期</span>
                <input type="date" value={formValues.date} onChange={(event) => updateForm("date", event.currentTarget.value)} />
              </label>

              <label className="field">
                <span>时间</span>
                <input type="time" value={formValues.time} onChange={(event) => updateForm("time", event.currentTarget.value)} />
              </label>

              <label className="field">
                <span>优先级</span>
                <select value={formValues.priority} onChange={(event) => updateForm("priority", event.currentTarget.value as TodoFormValues["priority"])}>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>

              <label className="field">
                <span>重复</span>
                <select value={formValues.repeatType} onChange={(event) => updateForm("repeatType", event.currentTarget.value as TodoFormValues["repeatType"])}>
                  <option value="none">不重复</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </label>

              <label className="field checkbox-field">
                <input type="checkbox" checked={formValues.reminderEnabled} onChange={(event) => updateForm("reminderEnabled", event.currentTarget.checked)} />
                <span>启用提醒</span>
              </label>

              <label className="field">
                <span>提前提醒</span>
                <select
                  value={formValues.reminderOffsetMinutes}
                  onChange={(event) => updateForm("reminderOffsetMinutes", Number(event.currentTarget.value))}
                  disabled={!formValues.reminderEnabled}
                >
                  <option value={0}>准时</option>
                  <option value={5}>提前 5 分钟</option>
                  <option value={15}>提前 15 分钟</option>
                  <option value={30}>提前 30 分钟</option>
                  <option value={60}>提前 1 小时</option>
                </select>
              </label>
            </div>

            <footer className="modal-footer">
              {formError ? <p className="form-error">{formError}</p> : null}
              <button onClick={closeComposer}>取消</button>
              <button className="save-button" onClick={handleCreateTodo} disabled={isSaving || !formValues.title.trim() || !formValues.location.trim()}>
                {isSaving ? "保存中" : editingTodo ? "保存修改" : "保存"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
