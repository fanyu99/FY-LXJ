import "./App.css";
import { sampleSettings, sampleTodos } from "./domain/sampleData";
import type { RepeatRule, Todo } from "./domain/types";

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
  const pendingCount = sampleTodos.filter((todo) => todo.status !== "done").length;
  const doneCount = sampleTodos.filter((todo) => todo.status === "done").length;

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
            <p>2026年6月26日 · 周五</p>
          </div>
          <div className="topbar-actions">
            <input placeholder="搜索待办、地点或分类" />
            <button className="primary">新建待办</button>
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
            {sampleTodos.slice(0, 2).map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))}

            <div className="date-header muted">
              <span className="date-number">27</span>
              <div>
                <strong>明日</strong>
                <p>周六 · 6月</p>
              </div>
            </div>
            <TodoItem todo={sampleTodos[2]} />
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
    </div>
  );
}

export default App;
