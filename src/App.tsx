import "./App.css";
import { useEffect, useState } from "react";
import { sampleSettings, sampleTodos } from "./domain/sampleData";
import type { RepeatRule, Todo } from "./domain/types";
import { createTodoFromForm, type TodoFormValues } from "./domain/todoForm";
import { listTodos, upsertTodo } from "./storage/todoRepository";

const navGroups = [
  {
    label: "任务",
    items: [
      ["全部待办", "12"],
      ["今日任务", "5"],
      ["即将到来", "4"],
      ["已逾期", "3"],
    ],
  },
  {
    label: "数据",
    items: [
      ["分类", ""],
      ["统计", ""],
      ["设置", ""],
    ],
  },
];

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
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

function TodoItem({ todo }: { todo: Todo }) {
  return (
    <article className={`todo-item ${todo.status === "done" ? "done" : ""}`}>
      <button className={`todo-check ${todo.status === "done" ? "checked" : ""}`} aria-label="切换完成状态" />
      <div className="todo-body">
        <div className="todo-title-row">
          <h3>{todo.title}</h3>
          <span className={`priority ${todo.priority}`}>{todo.priority === "high" ? "高" : todo.priority === "medium" ? "中" : "低"}</span>
        </div>
        <p>{todo.description}</p>
        <div className="todo-meta">
          <span>{formatTime(todo.dueAt)}</span>
          <span>{todo.location}</span>
          <span>{todo.category}</span>
          <span>{repeatLabel(todo.repeatRule)}</span>
        </div>
      </div>
      <div className="todo-actions">
        <button>编辑</button>
        <button>提醒</button>
      </div>
    </article>
  );
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(sampleTodos);
  const [dataMode, setDataMode] = useState("浏览器预览数据");
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<TodoFormValues>({
    title: "",
    description: "",
    location: "",
    date: "2026-06-26",
    time: "09:00",
    priority: "medium",
    category: "个人",
    reminderEnabled: true,
    reminderOffsetMinutes: 15,
    repeatType: "none",
  });

  useEffect(() => {
    async function loadLocalTodos() {
      if (!("__TAURI_INTERNALS__" in window)) {
        setDataMode("浏览器预览数据");
        return;
      }

      try {
        let localTodos = await listTodos();
        if (localTodos.length === 0) {
          await Promise.all(sampleTodos.map((todo) => upsertTodo(todo)));
          localTodos = await listTodos();
        }
        setTodos(localTodos);
        setDataMode("SQLite 本地数据");
      } catch (error) {
        console.error(error);
        setDataMode("SQLite 读取失败，显示预览数据");
      }
    }

    void loadLocalTodos();
  }, []);

  const todayTodos = todos.filter((todo) => todo.dueAt.startsWith("2026-06-26"));
  const futureTodos = todos.filter((todo) => !todo.dueAt.startsWith("2026-06-26"));
  const pendingCount = todos.filter((todo) => todo.status !== "done").length;
  const doneCount = todos.filter((todo) => todo.status === "done").length;

  function updateForm<K extends keyof TodoFormValues>(key: K, value: TodoFormValues[K]) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateTodo() {
    if (!formValues.title.trim() || !formValues.location.trim()) {
      setFormError("请填写任务标题和地点。");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const now = "2026-06-26T20:30:00+08:00";
      const todo = createTodoFromForm(formValues, {
        id: crypto.randomUUID(),
        now,
        timezoneOffset: "+08:00",
      });

      if ("__TAURI_INTERNALS__" in window) {
        await upsertTodo(todo);
        setTodos(await listTodos());
        setDataMode("SQLite 本地数据");
      } else {
        setTodos((current) => [...current, todo].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
        setDataMode("浏览器预览数据");
      }

      setComposerOpen(false);
      setFormValues((current) => ({
        ...current,
        title: "",
        description: "",
        location: "",
        time: "09:00",
        repeatType: "none",
      }));
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : "保存失败，请检查本地 SQLite 连接。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell" style={{ ["--accent" as string]: sampleSettings.themeColor }}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">✓</div>
          <div>
            <div className="brand-name">流云</div>
            <div className="brand-subtitle">本地待办</div>
          </div>
        </div>

        <nav>
          {navGroups.map((group) => (
            <section className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(([label, badge], index) => (
                <button className={`nav-item ${index === 0 && group.label === "任务" ? "active" : ""}`} key={label}>
                  <span>{label}</span>
                  {badge ? <span className="nav-badge">{badge}</span> : null}
                </button>
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>开机启动</span>
          <strong>{sampleSettings.launchOnStartup ? "已开启" : "已关闭"}</strong>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>全部待办</h1>
            <p>2026年6月26日 · 周五 · {dataMode}</p>
          </div>
          <div className="topbar-actions">
            <input placeholder="搜索待办、地点或分类" />
            <button className="primary" onClick={() => setComposerOpen(true)}>
              新建待办
            </button>
          </div>
        </header>

        <section className="content">
          <div className="todo-list">
            <div className="date-header">
              <span className="date-number">26</span>
              <div>
                <strong>今日</strong>
                <p>周五 · 6月</p>
              </div>
            </div>
            {todayTodos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}

            <div className="date-header muted">
              <span className="date-number">27</span>
              <div>
                <strong>明日</strong>
                <p>周六 · 6月</p>
              </div>
            </div>
            {futureTodos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}
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
                  <dd>自定义窗口</dd>
                </div>
                <div>
                  <dt>字体</dt>
                  <dd>内置中文字体</dd>
                </div>
                <div>
                  <dt>背景</dt>
                  <dd>支持 JPG / PNG / GIF</dd>
                </div>
                <div>
                  <dt>导入导出</dt>
                  <dd>JSON 本地文件</dd>
                </div>
              </dl>
            </section>
          </aside>
        </section>
      </main>

      {isComposerOpen ? (
        <div className="modal-backdrop" onMouseDown={() => setComposerOpen(false)}>
          <section className="todo-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h2>新建待办事项</h2>
              <button onClick={() => setComposerOpen(false)} aria-label="关闭新建待办弹窗">
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
              <button onClick={() => setComposerOpen(false)}>取消</button>
              <button className="save-button" onClick={handleCreateTodo} disabled={isSaving || !formValues.title.trim() || !formValues.location.trim()}>
                {isSaving ? "保存中" : "保存"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
