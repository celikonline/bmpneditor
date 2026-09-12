import { useMemo, useState } from 'react'
import { Bot, Grid2X2, Search, Settings2, UsersRound, X, Zap } from 'lucide-react'
import type { TaskCatalogItem } from '../taskCatalog'

type AddTaskMenuProps = {
  tasks: TaskCatalogItem[]
  onAdd: (task: TaskCatalogItem) => void
  onMore: () => void
}

/**
 * Local, dependency-light equivalent of ui-next's QuickAddMenu.
 * The official component is coupled to MUI, XState and the plugin registry;
 * this keeps the same task order and operation callback in the current app.
 */
export function QuickAddMenu({ tasks, onAdd, onMore }: AddTaskMenuProps) {
  const quickTypes = [
    'SIMPLE', 'HTTP', 'HTTP_POLL', 'GRPC', 'EVENT', 'SWITCH',
    'FORK_JOIN', 'DO_WHILE', 'SET_VARIABLE', 'WAIT', 'SUB_WORKFLOW',
    'START_WORKFLOW', 'TERMINATE', 'INLINE',
  ]
  const aiTypes = ['LLM_CHAT_COMPLETE', 'LLM_GENERATE_EMBEDDINGS', 'LLM_SEARCH_EMBEDDINGS', 'LLM_INDEX_DOCUMENT', 'LLM_SEARCH_INDEX', 'AGENT', 'GET_AGENT_CARD', 'CANCEL_AGENT', 'LIST_MCP_TOOLS', 'CALL_MCP_TOOL', 'GENERATE_IMAGE']
  const byKind = new Map(tasks.map((task) => [task.kind, task]))
  const fallback = tasks.filter((task) => task.group === 'Quick Add')
  const coreItems = quickTypes.map((kind) => byKind.get(kind as TaskCatalogItem['kind'])).filter(Boolean) as TaskCatalogItem[]
  const aiItems = aiTypes.map((kind) => byKind.get(kind as TaskCatalogItem['kind'])).filter(Boolean) as TaskCatalogItem[]
  const visibleCore = coreItems.length ? coreItems : fallback.slice(0, 14)

  return <div className="quick-add-menu" role="dialog" aria-label="Quick add task">
    <div className="quick-add-search"><Search size={17} /><input aria-label="Search tasks" placeholder="Search tasks..." onChange={(event) => {
      const value = event.target.value.toLowerCase()
      const buttons = event.currentTarget.closest('.quick-add-menu')?.querySelectorAll<HTMLButtonElement>('.quick-add-item')
      buttons?.forEach((button) => { button.hidden = !button.textContent?.toLowerCase().includes(value) })
    }} /></div>
    <div className="quick-add-heading"><strong>QUICK ADD</strong><button onClick={onMore}>More tasks <span>→</span></button></div>
    <div className="quick-add-grid">
      {visibleCore.map((task) => <QuickAddItem task={task} onAdd={onAdd} key={`${task.name}-${task.kind}`} />)}
    </div>
    <div className="quick-add-heading agentic"><strong>AGENTIC ORCHESTRATION</strong></div>
    <div className="quick-add-grid agentic-grid">
      {aiItems.map((task) => <QuickAddItem task={task} onAdd={onAdd} key={`${task.name}-${task.kind}`} />)}
    </div>
  </div>
}

function QuickAddItem({ task, onAdd }: { task: TaskCatalogItem; onAdd: (task: TaskCatalogItem) => void }) {
  const Icon = task.icon
  return <button className="quick-add-item" title={task.desc} onClick={() => onAdd(task)}><Icon size={22} /><span>{task.name.replace(' Task', '')}</span></button>
}

type DrawerProps = {
  query: string
  setQuery: (value: string) => void
  tasks: TaskCatalogItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onClose: () => void
  onAdd: (task: TaskCatalogItem) => void
}

/** Equivalent of ui-next's AddTaskSidebar with All/System/AI/Worker/Connected tabs. */
export function AddTaskDrawer({ query, setQuery, tasks, loading, error, onRetry, onClose, onAdd }: DrawerProps) {
  const [category, setCategory] = useState('All')
  const categories = [
    ['All', Grid2X2], ['System', Settings2], ['AI', Bot], ['Worker Tasks', Zap], ['Connected Apps', UsersRound],
  ] as const
  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tasks.filter((task) => {
      const matchesCategory = category === 'All' || task.group === category
      const matchesQuery = !normalizedQuery || `${task.name} ${task.desc} ${task.kind}`.toLowerCase().includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [category, query, tasks])

  return <aside className="right-panel add-drawer" aria-label="Add Task">
    <div className="panel-heading"><div><h2>Add Task</h2><span>{loading ? 'Loading catalog…' : error ? 'Catalog unavailable' : `${visibleTasks.length} results`}</span></div><button aria-label="Close add task" onClick={onClose}><X size={17} /></button></div>
    <div className="task-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks..." disabled={loading} /><span>{loading ? '…' : visibleTasks.length} results</span></div>
    <div className="category-tabs">{categories.map(([label, Icon]) => <button key={label} className={category === label ? 'active' : ''} onClick={() => setCategory(label)} disabled={loading}><Icon size={17} /><span>{label}</span></button>)}</div>
    {loading ? <div className="catalog-loading"><span className="loading-bar" /><span className="loading-bar short" /><span className="loading-bar" /></div> : error ? <div className="catalog-error"><strong>Task catalog unavailable</strong><span>{error}</span><button className="outline-button" onClick={onRetry}>Retry</button></div> : <div className="catalog-list">{visibleTasks.map((task) => { const Icon = task.icon; return <button className="catalog-item" key={`${task.name}-${task.kind}`} onClick={() => onAdd(task)}><span className="catalog-icon"><Icon size={18} /></span><span><strong>{task.name}</strong><small>{task.desc}</small></span></button> })}{visibleTasks.length === 0 && <div className="quick-empty">No matching tasks.</div>}</div>}
  </aside>
}
