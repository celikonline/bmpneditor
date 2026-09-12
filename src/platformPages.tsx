import { useEffect, useMemo, useState } from 'react'
import { Activity, Archive, Check, ChevronLeft, Clock3, Code2, Copy, FileJson, Filter, Globe2, Play, Plus, RefreshCw, Search, Server, Settings2, Trash2, UsersRound, Workflow, X } from 'lucide-react'
import { workflowApi, type EventHandlerRecord, type EventRecord, type ExecutionRecord, type QueueRecord, type ScheduleRecord, type TaskDefinitionRecord } from './workflowApi'

export type PlatformView = 'executions' | 'execution-detail' | 'run-workflow' | 'queue' | 'events' | 'task-definitions' | 'event-handlers' | 'schedulers' | 'schemas' | 'api' | 'integrations' | 'access' | 'agents' | 'human-tasks' | 'workers' | 'user-forms' | 'secrets' | 'webhooks' | 'ai-prompts' | 'environment' | 'applications' | 'groups' | 'users' | 'authentication'

type Navigation = (view: PlatformView) => void

export function PlatformPage({ view, onNavigate }: { view: PlatformView; onNavigate: Navigation }) {
  if (view === 'executions' || view === 'execution-detail') return <ExecutionsPage />
  if (view === 'run-workflow') return <RunWorkflowPage />
  if (view === 'queue') return <QueueMonitorPage />
  if (view === 'events') return <EventMonitorPage />
  if (view === 'task-definitions') return <TaskDefinitionsPage />
  if (view === 'event-handlers') return <EventHandlersPage />
  if (view === 'schedulers') return <SchedulersPage />
  if (view === 'schemas') return <SchemasPage />
  if (view === 'api') return <ApiReferencePage />
  if (view === 'integrations') return <IntegrationsPage />
  if (view in resourceConfig) return <ResourceRegistryPage view={view as ResourceView} />
  return <PlatformPlaceholder view={view} onNavigate={onNavigate} />
}

function PageFrame({ eyebrow, title, description, actions, children }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return <div className="platform-page"><header className="platform-page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="platform-page-actions">{actions}</div></header>{children}</div>
}

function Toolbar({ children }: { children: React.ReactNode }) { return <div className="platform-toolbar">{children}</div> }
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="platform-search"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }
function EmptyState({ icon: Icon = Workflow, title, detail }: { icon?: typeof Workflow; title: string; detail: string }) { return <div className="platform-empty"><Icon size={24} /><strong>{title}</strong><span>{detail}</span></div> }
function StatusPill({ value }: { value: string }) { return <em className={`platform-status ${value.toLowerCase().replaceAll('_', '-')}`}>{value.replaceAll('_', ' ')}</em> }
function formatTime(value?: string) { return value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—' }

function ExecutionsPage() {
  const [records, setRecords] = useState<ExecutionRecord[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [sqlMode, setSqlMode] = useState(false)
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM workflow_executions')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [workflowFilter, setWorkflowFilter] = useState('')
  const [correlationFilter, setCorrelationFilter] = useState('')
  const [executionNameFilter, setExecutionNameFilter] = useState('')
  const [startedAfter, setStartedAfter] = useState('')
  const [startedBefore, setStartedBefore] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMessage, setBulkMessage] = useState('')
  const [selected, setSelected] = useState<ExecutionRecord | null>(null)
  const refresh = () => { void workflowApi.listExecutions().then(setRecords) }
  useEffect(() => { refresh() }, [])
  const visible = useMemo(() => records.filter((record) => {
    const matchesText = `${record.executionId} ${record.workflowName} ${record.executionName ?? ''} ${record.correlationId ?? ''}`.toLowerCase().includes(query.toLowerCase())
    const matchesWorkflow = !workflowFilter || record.workflowName.toLowerCase().includes(workflowFilter.toLowerCase())
    const matchesCorrelation = !correlationFilter || (record.correlationId ?? '').toLowerCase().includes(correlationFilter.toLowerCase())
    const matchesExecutionName = !executionNameFilter || (record.executionName ?? '').toLowerCase().includes(executionNameFilter.toLowerCase())
    const sqlStatus = sqlQuery.match(/status\s*=\s*['"]?(running|paused|completed|terminated|failed|timed_out)['"]?/i)?.[1]?.toUpperCase()
    const sqlWorkflow = sqlQuery.match(/(?:workflow_name|workflow_id)\s*=\s*['"]([^'"]+)['"]/i)?.[1]
    const sqlCorrelation = sqlQuery.match(/correlation_id\s*=\s*['"]([^'"]+)['"]/i)?.[1]
    const matchesSql = !sqlMode || (!sqlStatus || record.status === sqlStatus) && (!sqlWorkflow || record.workflowName.toLowerCase() === sqlWorkflow.toLowerCase()) && (!sqlCorrelation || (record.correlationId ?? '').toLowerCase() === sqlCorrelation.toLowerCase())
    const startedAt = new Date(record.startedAt).getTime()
    const matchesAfter = !startedAfter || startedAt >= new Date(startedAfter).getTime()
    const matchesBefore = !startedBefore || startedAt <= new Date(`${startedBefore}T23:59:59`).getTime()
    return matchesText && matchesWorkflow && matchesCorrelation && matchesExecutionName && matchesSql && (status === 'ALL' || record.status === status) && matchesAfter && matchesBefore
  }), [correlationFilter, executionNameFilter, query, records, sqlMode, sqlQuery, startedAfter, startedBefore, status, workflowFilter])
  const toggleSelectionMode = () => {
    setSelectionMode((enabled) => {
      if (enabled) setSelectedIds([])
      return !enabled
    })
    setBulkMessage('')
  }
  const bulkOperate = (operation: 'pause' | 'resume' | 'retry' | 'restart-current' | 'restart-latest' | 'terminate') => {
    const eligible = records.filter((record) => {
      if (!selectedIds.includes(record.executionId)) return false
      if (operation === 'pause' || operation === 'terminate') return ['RUNNING', 'PAUSED'].includes(record.status)
      if (operation === 'resume') return record.status === 'PAUSED'
      return ['COMPLETED', 'FAILED', 'TERMINATED', 'TIMED_OUT'].includes(record.status)
    })
    if (eligible.length === 0) {
      setBulkMessage('No selected executions support this action.')
      return
    }
    setBulkBusy(true)
    setBulkMessage('')
    const action = operation === 'pause' ? workflowApi.pauseExecution : operation === 'resume' ? workflowApi.resumeExecution : operation === 'retry' ? workflowApi.retryExecution : operation === 'restart-current' ? workflowApi.restartExecution : operation === 'restart-latest' ? (executionId: string) => workflowApi.restartExecution(executionId, true) : workflowApi.terminateExecution
    void Promise.allSettled(eligible.map((record) => action(record.executionId))).then((results) => {
      const completed = results.filter((result) => result.status === 'fulfilled').length
      setBulkMessage(`${completed} of ${eligible.length} execution${eligible.length === 1 ? '' : 's'} updated.`)
      setSelectedIds([])
      refresh()
    }).finally(() => setBulkBusy(false))
  }
  if (selected) return <ExecutionDetail record={selected} onBack={() => { setSelected(null); refresh() }} />
  return <PageFrame eyebrow="EXECUTIONS / WORKFLOW" title="Workflow Executions" description="Search, inspect and operate workflow execution history." actions={<button className="outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>}>
    <Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search execution, workflow or correlation ID..." /><label className="platform-select"><Filter size={15} /><select aria-label="Execution status filter" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option>RUNNING</option><option>PAUSED</option><option>COMPLETED</option><option>TERMINATED</option><option>FAILED</option></select></label><button className={`outline-button compact-button ${advancedOpen ? 'active-filter' : ''}`} onClick={() => setAdvancedOpen((open) => !open)}><Settings2 size={14} /> Advanced filters</button><button className={`outline-button compact-button ${sqlMode ? 'active-filter' : ''}`} onClick={() => { setSqlMode((enabled) => !enabled); setSqlQuery('SELECT * FROM workflow_executions') }} aria-pressed={sqlMode}>SQL format</button><button className={`outline-button compact-button ${selectionMode ? 'active-filter' : ''}`} onClick={toggleSelectionMode} aria-pressed={selectionMode}>{selectionMode ? 'Done selecting' : 'Select executions'}</button>{selectionMode && selectedIds.length > 0 && <span className="toolbar-count execution-selection-count">{selectedIds.length} selected</span>}</Toolbar>
    {sqlMode && <div className="execution-sql-panel"><label>SQL query<textarea aria-label="SQL query" value={sqlQuery} onChange={(event) => setSqlQuery(event.target.value)} spellCheck={false} /></label><span>Supported filters: <code>status</code>, <code>workflow_name</code>, <code>workflow_id</code>, <code>correlation_id</code>.</span></div>}
    {advancedOpen && <div className="execution-filter-panel"><label>Workflow name<input aria-label="Workflow name filter" placeholder="api_polling_workflow" value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} /></label><label>Correlation ID<input aria-label="Correlation ID filter" placeholder="incident-123" value={correlationFilter} onChange={(event) => setCorrelationFilter(event.target.value)} /></label><label>Execution name<input aria-label="Execution name filter" placeholder="health-check-run" value={executionNameFilter} onChange={(event) => setExecutionNameFilter(event.target.value)} /></label><label>Started after<input aria-label="Started after" type="date" value={startedAfter} onChange={(event) => setStartedAfter(event.target.value)} /></label><label>Started before<input aria-label="Started before" type="date" value={startedBefore} onChange={(event) => setStartedBefore(event.target.value)} /></label><button className="outline-button compact-button" onClick={() => { setWorkflowFilter(''); setCorrelationFilter(''); setExecutionNameFilter(''); setStartedAfter(''); setStartedBefore(''); setStatus('ALL') }}>Clear filters</button></div>}
    {bulkMessage && <div className="platform-success">{bulkMessage}</div>}
    {selectionMode && selectedIds.length > 0 && <div className="execution-bulk-actions"><span>Bulk actions</span><button className="outline-button compact-button" onClick={() => bulkOperate('pause')} disabled={bulkBusy}>Pause</button><button className="outline-button compact-button" onClick={() => bulkOperate('resume')} disabled={bulkBusy}>Resume</button><button className="outline-button compact-button" onClick={() => bulkOperate('retry')} disabled={bulkBusy}>Retry</button><button className="outline-button compact-button" onClick={() => bulkOperate('restart-current')} disabled={bulkBusy}>Restart current</button><button className="outline-button compact-button" onClick={() => bulkOperate('restart-latest')} disabled={bulkBusy}>Restart latest</button><button className="danger-button compact-button" onClick={() => bulkOperate('terminate')} disabled={bulkBusy}>Terminate</button><button className="text-button" onClick={() => setSelectedIds([])} disabled={bulkBusy}>Clear selection</button></div>}
    <div className="platform-card"><div className="platform-card-head"><div><strong>Recent executions</strong><span>{visible.length} result{visible.length === 1 ? '' : 's'}</span></div><div className="platform-card-metrics"><span><b>{records.filter((item) => item.status === 'RUNNING').length}</b> running</span><span><b>{records.filter((item) => item.status === 'COMPLETED').length}</b> completed</span></div></div>{visible.length === 0 ? <EmptyState icon={Activity} title="No executions found" detail="Run a workflow from the builder to populate this list." /> : <div className="platform-table"><div className="platform-table-head"><span>Execution</span><span>Workflow</span><span>Status</span><span>Started</span><span>Tasks</span><span /></div>{visible.map((record) => { const isSelected = selectedIds.includes(record.executionId); return <button className={`platform-table-row ${isSelected ? 'execution-row-selected' : ''}`} key={record.executionId} onClick={() => selectionMode ? setSelectedIds((ids) => isSelected ? ids.filter((id) => id !== record.executionId) : [...ids, record.executionId]) : setSelected(record)}><span><i className={`execution-selection-indicator ${selectionMode ? 'visible' : ''} ${isSelected ? 'selected' : ''}`} aria-hidden="true" /><strong>{record.executionName || record.executionId}</strong><small>{record.executionId}</small></span><span>{record.workflowName}<small>Version {record.version}</small></span><span><StatusPill value={record.status} /></span><span>{formatTime(record.startedAt)}</span><span>{record.events.filter((event) => event.status === 'COMPLETED').length}/{record.events.length || '—'}</span><ChevronLeft className="rotate-180" size={15} /></button>})}</div>}</div>
  </PageFrame>
}

function RunWorkflowPage() {
  const [definitions, setDefinitions] = useState<Awaited<ReturnType<typeof workflowApi.listWorkflowDefinitions>>>([])
  const [workflowName, setWorkflowName] = useState('api_polling_workflow')
  const [version, setVersion] = useState('1')
  const [input, setInput] = useState('{\n  "jobId": "demo-job-001"\n}')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [strategy, setStrategy] = useState<'RETURN_EXISTING' | 'FAIL' | 'FAIL_ON_RUNNING'>('RETURN_EXISTING')
  const [correlationId, setCorrelationId] = useState('')
  const [executionName, setExecutionName] = useState('')
  const [result, setResult] = useState<ExecutionRecord | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void workflowApi.listWorkflowDefinitions().then((items) => { setDefinitions(items); if (items[0]) { setWorkflowName(items[0].name); setVersion(String(items[0].version)) } }) }, [])
  const selected = definitions.find((item) => item.name === workflowName)
  const run = () => {
    setError('')
    let parsed: unknown
    try { parsed = JSON.parse(input) } catch { setError('Input params must be valid JSON.'); return }
    const tasks = selected?.nodes?.filter((node) => ['studio', 'loop', 'switch'].includes(node.type)) ?? [{ id: 'run-task', type: 'studio' as const, position: { x: 0, y: 0 }, data: { label: 'run_workflow_task', ref: 'run_workflow_task_ref', kind: 'SIMPLE' as const } }]
    void workflowApi.startExecution({ workflowName, version: Number(version) || selected?.version || 1, idempotencyKey: idempotencyKey.trim() || `run-${workflowName}-${Date.now()}`, strategy, tasks, executionInput: parsed, correlationId: correlationId.trim() || undefined, executionName: executionName.trim() || undefined, onEvent: () => undefined }).then(setResult).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Workflow could not be started.'))
  }
  return <PageFrame eyebrow="EXECUTIONS / RUN WORKFLOW" title="Run Workflow" description="Start a version with controlled input, idempotency and correlation settings." actions={<button className="outline-button" onClick={() => { setInput('{}'); setResult(null); setError('') }}><RefreshCw size={15} /> Reset</button>}><div className="run-workflow-layout"><div className="platform-card"><div className="platform-card-head"><div><strong>Workflow request</strong><span>Select a definition and provide input parameters.</span></div><Play size={17} /></div><div className="run-workflow-form"><label>Workflow name<select className="native-select" value={workflowName} onChange={(event) => { setWorkflowName(event.target.value); const item = definitions.find((definition) => definition.name === event.target.value); if (item) setVersion(String(item.version)) }}>{definitions.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>Version<input type="number" min="1" value={version} onChange={(event) => setVersion(event.target.value)} /></label><label>Input params (JSON)<textarea className="execute-input" value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} /></label><div className="run-workflow-actions"><button className="primary-action" onClick={run}><Play size={14} fill="currentColor" /> Run workflow</button></div></div></div><div className="platform-card"><div className="platform-card-head"><div><strong>Execution options</strong><span>Idempotency prevents accidental duplicate starts.</span></div></div><div className="run-workflow-form"><label>Idempotency key<input value={idempotencyKey} placeholder="Generated automatically" onChange={(event) => setIdempotencyKey(event.target.value)} /></label><label>Idempotency strategy<select className="native-select" value={strategy} onChange={(event) => setStrategy(event.target.value as typeof strategy)}><option value="RETURN_EXISTING">Return existing</option><option value="FAIL">Fail on duplicate</option><option value="FAIL_ON_RUNNING">Fail on running</option></select></label><label>Correlation ID<input value={correlationId} placeholder="incident-123" onChange={(event) => setCorrelationId(event.target.value)} /></label><label>Execution name<input value={executionName} placeholder="health-check-run" onChange={(event) => setExecutionName(event.target.value)} /></label></div></div></div>{error && <div className="platform-error">{error}</div>}{result && <div className="platform-card run-result"><div><strong>Execution started</strong><span>{result.executionId} · {result.workflowName} · version {result.version}{result.executionName ? ` · ${result.executionName}` : ''}</span></div><StatusPill value={result.status} /></div>}<div className="platform-card"><div className="platform-card-head"><div><strong>Run history</strong><span>Use Workflow Executions for the full task timeline.</span></div><Clock3 size={17} /></div><div className="run-history-hint">Every run is stored in the local execution registry and can be inspected from the Executions screen.</div></div></PageFrame>
}

function ExecutionDetail({ record, onBack }: { record: ExecutionRecord; onBack: () => void }) {
  const [current, setCurrent] = useState(record)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'Tasks' | 'Diagram' | 'Timeline' | 'Summary' | 'Input/Output' | 'JSON'>('Tasks')
  const [selectedTask, setSelectedTask] = useState<ExecutionRecord['events'][number] | null>(null)
  const [signalOpen, setSignalOpen] = useState(false)
  const refresh = () => { void workflowApi.getExecution(current.executionId).then((next) => { if (next) setCurrent(next) }) }
  useEffect(() => {
    if (!['RUNNING', 'PAUSED'].includes(current.status)) return undefined
    const timer = globalThis.setInterval(refresh, 500)
    return () => globalThis.clearInterval(timer)
  }, [current.executionId, current.status])
  const operate = (operation: () => Promise<ExecutionRecord>) => {
    setBusy(true)
    setError('')
    void operation().then(setCurrent).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Execution operation failed.')).finally(() => setBusy(false))
  }
  const actions = <><button className="outline-button" onClick={refresh} disabled={busy}><RefreshCw size={15} /> Refresh</button>{current.status === 'RUNNING' && <button className="outline-button" onClick={() => operate(() => workflowApi.pauseExecution(current.executionId))} disabled={busy}>Pause</button>}{current.status === 'PAUSED' && <button className="primary-action" onClick={() => operate(() => workflowApi.resumeExecution(current.executionId))} disabled={busy}>Resume</button>}{['RUNNING', 'PAUSED'].includes(current.status) && <><button className="outline-button" onClick={() => setSignalOpen(true)} disabled={busy}>Send signal</button><button className="danger-button" onClick={() => operate(() => workflowApi.terminateExecution(current.executionId))} disabled={busy}>Terminate</button></>}{['COMPLETED', 'FAILED', 'TERMINATED', 'TIMED_OUT'].includes(current.status) && <><button className="outline-button" onClick={() => operate(() => workflowApi.retryExecution(current.executionId))} disabled={busy}>Retry</button><button className="outline-button" onClick={() => operate(() => workflowApi.restartExecution(current.executionId))} disabled={busy}>Restart current</button><button className="outline-button" onClick={() => operate(() => workflowApi.restartExecution(current.executionId, true))} disabled={busy}>Restart latest</button></>}<button className="outline-button" onClick={onBack}><ChevronLeft size={15} /> Back</button></>
  const completed = current.events.filter((event) => event.status === 'COMPLETED').length
  const tabs: Array<typeof tab> = ['Tasks', 'Diagram', 'Timeline', 'Summary', 'Input/Output', 'JSON']
  const output = { status: current.status, completedTasks: completed, taskCount: current.events.length, executionId: current.executionId }
  return <PageFrame eyebrow="EXECUTIONS / DETAIL" title={current.executionName || current.executionId} description={`${current.workflowName} · version ${current.version}`} actions={actions}>
    {error && <div className="platform-error">{error}</div>}
    <div className="execution-inspector-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === 'Tasks' && <div className="platform-card"><div className="platform-card-head"><div><strong>Task list</strong><span>{current.events.length} task executions · click a task for debugging details</span></div><Activity size={17} /></div>{current.events.length === 0 ? <EmptyState icon={Clock3} title="No task events yet" detail="This execution has not emitted task events." /> : <div className="execution-task-table">{current.events.map((event, index) => <button className="execution-task-row" key={`${event.taskReferenceName}-${index}`} onClick={() => setSelectedTask(event)}><span className="timeline-dot" /><div><strong>{event.taskReferenceName}</strong><small>{formatTime(event.at)}{event.workerId ? ` · ${event.workerId}` : ''}</small></div><StatusPill value={event.status} /><span className="task-reason">{event.reasonForIncompletion || ''}</span></button>)}</div>}</div>}
    {tab === 'Diagram' && <div className="platform-card"><div className="platform-card-head"><div><strong>Execution diagram</strong><span>Executed path is colored by runtime status.</span></div><Workflow size={17} /></div><div className="execution-diagram"><div className="execution-diagram-node start">Start</div>{current.events.map((event, index) => <div className="execution-diagram-step" key={`${event.taskReferenceName}-${index}`}><span className={`execution-diagram-edge ${event.status.toLowerCase()}`} /><div className={`execution-diagram-node ${event.status.toLowerCase()}`}><strong>{event.taskReferenceName}</strong><StatusPill value={event.status} /></div></div>)}<div className="execution-diagram-node end">End</div></div></div>}
    {tab === 'Timeline' && <div className="platform-card"><div className="platform-card-head"><div><strong>Timeline</strong><span>Chronological task state changes.</span></div><Clock3 size={17} /></div><div className="execution-task-table">{current.events.map((event, index) => <button className="execution-task-row" key={`${event.taskReferenceName}-${index}`} onClick={() => setSelectedTask(event)}><span className="timeline-dot" /><div><strong>{event.taskReferenceName}</strong><small>{formatTime(event.at)}</small></div><StatusPill value={event.status} /><span className="task-reason">{event.reasonForIncompletion || 'Task state recorded by the execution engine.'}</span></button>)}</div></div>}
    {tab === 'Summary' && <div className="detail-grid"><div className="platform-card"><div className="platform-card-head"><div><strong>Execution summary</strong><span>{current.executionId}</span></div><StatusPill value={current.status} /></div><div className="metric-grid"><div><span>Started</span><strong>{formatTime(current.startedAt)}</strong></div><div><span>Completed</span><strong>{formatTime(current.completedAt)}</strong></div><div><span>Trace ID</span><strong>{current.traceId || '—'}</strong></div><div><span>Correlation ID</span><strong>{current.correlationId || '—'}</strong></div><div><span>Priority</span><strong>{current.priority ?? 0}</strong></div><div><span>Reason for incompletion</span><strong>{current.status === 'COMPLETED' ? '—' : 'Execution is still in progress or was stopped.'}</strong></div><div><span>Definition snapshot</span><strong>{current.workflowName} · v{current.version}</strong></div></div></div><div className="platform-card"><div className="platform-card-head"><div><strong>Workflow output</strong><span>Execution result summary</span></div><Code2 size={17} /></div><pre className="platform-code">{JSON.stringify(output, null, 2)}</pre></div></div>}
    {tab === 'Input/Output' && <div className="detail-grid"><div className="platform-card"><div className="platform-card-head"><div><strong>Workflow input</strong><span>Payload supplied at start</span></div><Code2 size={17} /></div><pre className="platform-code">{JSON.stringify(current.input, null, 2)}</pre></div><div className="platform-card"><div className="platform-card-head"><div><strong>Workflow output</strong><span>Current execution projection</span></div><Code2 size={17} /></div><pre className="platform-code">{JSON.stringify(output, null, 2)}</pre></div></div>}
    {tab === 'JSON' && <div className="platform-card"><div className="platform-card-head"><div><strong>Execution JSON</strong><span>Raw execution record and task statuses</span></div><Code2 size={17} /></div><pre className="platform-code execution-json">{JSON.stringify(current, null, 2)}</pre></div>}
    {selectedTask && <TaskExecutionModal executionId={current.executionId} event={selectedTask} onClose={() => setSelectedTask(null)} onUpdated={(next) => { setCurrent(next); setSelectedTask(next.events.find((item) => item.taskReferenceName === selectedTask.taskReferenceName) ?? null) }} />}
    {signalOpen && <SignalModal onCancel={() => setSignalOpen(false)} onSend={(name, payload) => { setSignalOpen(false); operate(() => workflowApi.signalExecution(current.executionId, name, payload)) }} />}
  </PageFrame>
}

function SignalModal({ onCancel, onSend }: { onCancel: () => void; onSend: (name: string, payload: unknown) => void }) {
  const [name, setName] = useState('external_signal')
  const [payload, setPayload] = useState('{}')
  const [error, setError] = useState('')
  const send = () => { try { onSend(name, JSON.parse(payload)) } catch { setError('Signal payload must be valid JSON.') } }
  return <div className="modal-backdrop"><section className="platform-modal signal-modal"><div className="modal-head"><div><span className="eyebrow">EXECUTION SIGNAL</span><h2>Send signal</h2><p>Resume a waiting execution with an external signal payload.</p></div><button onClick={onCancel}><X size={17} /></button></div><div className="modal-fields"><label>Signal name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Payload (JSON)<textarea value={payload} onChange={(event) => setPayload(event.target.value)} spellCheck={false} /></label></div>{error && <div className="platform-error">{error}</div>}<div className="modal-actions"><button className="outline-button" onClick={onCancel}>Cancel</button><button className="primary-action" onClick={send}><Play size={14} /> Send signal</button></div></section></div>
}

function TaskExecutionModal({ executionId, event, onClose, onUpdated }: { executionId: string; event: ExecutionRecord['events'][number]; onClose: () => void; onUpdated: (record: ExecutionRecord) => void }) {
  const [status, setStatus] = useState(event.status)
  const [reason, setReason] = useState(event.reasonForIncompletion ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = { taskReferenceName: event.taskReferenceName, workerId: event.workerId ?? 'studio-mock-worker' }
  const output = { status: event.status, completedAt: event.at }
  const updateStatus = () => { setBusy(true); setError(''); void workflowApi.updateTaskStatus(executionId, event.taskReferenceName, status, reason.trim() || undefined).then(onUpdated).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Task status could not be updated.')).finally(() => setBusy(false)) }
  return <div className="modal-backdrop"><section className="platform-modal task-execution-modal"><div className="modal-head"><div><span className="eyebrow">TASK EXECUTION</span><h2>{event.taskReferenceName}</h2><p>Inspect input/output, logs and update the task state.</p></div><button onClick={onClose}><X size={17} /></button></div><div className="task-execution-summary"><StatusPill value={event.status} /><span>Task ID: {event.taskExecutionId ?? '—'}</span><span>Retry count: {event.retryCount ?? 0}</span><span>Worker: {event.workerId ?? 'studio-mock-worker'}</span><span>{formatTime(event.at)}</span></div><div className="task-execution-detail-grid"><div><strong>Input</strong><pre className="platform-code">{JSON.stringify(input, null, 2)}</pre></div><div><strong>Output</strong><pre className="platform-code">{JSON.stringify(output, null, 2)}</pre></div></div><div className="task-status-editor"><label>Status<select className="native-select" value={status} onChange={(change) => setStatus(change.target.value as typeof status)}>{['SCHEDULED', 'IN_PROGRESS', 'SKIPPED', 'TIMED_OUT', 'CANCELED', 'FAILED', 'FAILED_WITH_TERMINAL_ERROR', 'COMPLETED_WITH_ERRORS', 'COMPLETED'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Reason for incompletion<textarea value={reason} placeholder="Optional operator reason" onChange={(change) => setReason(change.target.value)} /></label></div>{error && <div className="platform-error">{error}</div>}<div className="task-reason-panel"><strong>Current reason</strong><span>{event.reasonForIncompletion || 'No reason for incompletion.'}</span></div><div className="task-log-panel"><strong>Logs</strong><pre>{`[${event.at}] task ${event.taskReferenceName} reported ${event.status}`}</pre></div><div className="modal-actions"><button className="outline-button" onClick={onClose}>Close</button><button className="primary-action" disabled={busy} onClick={updateStatus}><Check size={14} /> {busy ? 'Updating…' : 'Update task status'}</button></div></section></div>
}

function QueueMonitorPage() {
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [query, setQuery] = useState('')
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null)
  const [workers, setWorkers] = useState<Awaited<ReturnType<typeof workflowApi.listQueueWorkers>>>([])
  const [refreshSeconds, setRefreshSeconds] = useState('0')
  const refresh = () => { void workflowApi.listQueues().then(setQueues) }
  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (!selectedQueue) { setWorkers([]); return undefined }
    void workflowApi.listQueueWorkers(selectedQueue).then(setWorkers)
    return undefined
  }, [selectedQueue])
  useEffect(() => {
    const seconds = Number(refreshSeconds)
    if (!seconds) return undefined
    const timer = globalThis.setInterval(refresh, seconds * 1000)
    return () => globalThis.clearInterval(timer)
  }, [refreshSeconds])
  const visible = queues.filter((queue) => `${queue.queue} ${queue.taskType}`.toLowerCase().includes(query.toLowerCase()))
  const selected = queues.find((queue) => queue.queue === selectedQueue)
  const inProgress = queues.reduce((sum, queue) => sum + queue.inProgress, 0)
  const unprocessed = queues.reduce((sum, queue) => sum + queue.unprocessed, 0)
  return <PageFrame eyebrow="EXECUTIONS / QUEUE MONITOR" title="Queue Monitor" description="Inspect worker queues, throughput and pending work." actions={<button className="outline-button" onClick={refresh}><RefreshCw size={15} /> Refresh</button>}>
    <div className="metric-cards"><MetricCard icon={Activity} label="In progress" value={inProgress} tone="blue" /><MetricCard icon={Clock3} label="Unprocessed" value={unprocessed} tone="amber" /><MetricCard icon={Server} label="Active queues" value={queues.length} tone="green" /></div>
    <Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search queues..." /><label className="platform-select"><RefreshCw size={14} /><span>Auto refresh</span><select aria-label="Auto refresh" value={refreshSeconds} onChange={(event) => setRefreshSeconds(event.target.value)}><option value="0">Off</option><option value="5">5 sec</option><option value="15">15 sec</option><option value="30">30 sec</option></select></label><span className="toolbar-count">{visible.length} queues · select a row for workers</span></Toolbar>
    <div className="platform-card"><div className="platform-card-head"><div><strong>Polling queues</strong><span>Queue size and worker polling activity from the latest refresh.</span></div><Filter size={17} /></div><div className="platform-table"><div className="platform-table-head"><span>Queue</span><span>Task type</span><span>In progress</span><span>Unprocessed</span><span>Rate limit</span><span>Updated</span></div>{visible.map((queue) => <button className={`platform-table-row queue-row ${selectedQueue === queue.queue ? 'selected' : ''}`} key={queue.queue} onClick={() => setSelectedQueue(queue.queue)}><span><strong>{queue.queue}</strong><small>{selectedQueue === queue.queue ? 'Selected · showing workers below' : 'Select to inspect workers'}</small></span><span>{queue.taskType}</span><span>{queue.inProgress}</span><span className={queue.unprocessed ? 'warning-text' : ''}>{queue.unprocessed}</span><span>{queue.rateLimit}/min</span><span>{queue.updatedAt}</span></button>)}</div></div>
    {selected && <div className="platform-card queue-worker-card"><div className="platform-card-head"><div><strong>Workers polling {selected.queue}</strong><span>{workers.length ? `${workers.length} worker${workers.length === 1 ? '' : 's'} reported` : 'No polling workers reported for this queue.'}</span></div><button className="outline-button compact-button" onClick={() => void workflowApi.listQueueWorkers(selected.queue).then(setWorkers)}><RefreshCw size={13} /> Refresh workers</button></div>{workers.length ? <div className="queue-worker-table"><div className="queue-worker-head"><span>Worker</span><span>Domain</span><span>Last poll</span><span>Status</span></div>{workers.map((worker) => <div className="queue-worker-row" key={worker.workerId}><span><strong>{worker.workerId}</strong></span><span>{worker.domain}</span><span>{worker.lastPollAt}</span><span><StatusPill value={worker.status} /></span></div>)}</div> : <EmptyState icon={Server} title="No polling workers" detail="There are no active worker heartbeats for this queue." />}</div>}
  </PageFrame>
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: number; tone: string }) { return <div className={`metric-card ${tone}`}><Icon size={18} /><span>{label}</span><strong>{value}</strong></div> }

function EventMonitorPage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<EventRecord | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  useEffect(() => { void workflowApi.listEvents().then(setEvents) }, [])
  const visible = events.filter((event) => `${event.event} ${event.source} ${event.id} ${event.status}`.toLowerCase().includes(query.toLowerCase()))
  const replay = () => { if (!selected) return; void workflowApi.replayEvent(selected).then((record) => { setSelected(null); setActionMessage(`Event replay started: ${record.executionId}`) }).catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Event replay failed.')) }
  return <PageFrame eyebrow="EXECUTIONS / EVENT MONITOR" title="Event Monitor" description="Track incoming events and inspect their processing status." actions={<button className="outline-button" onClick={() => void workflowApi.listEvents().then(setEvents)}><RefreshCw size={15} /> Refresh</button>}><Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search event name, source or ID..." /></Toolbar>{actionMessage && <div className="platform-success">{actionMessage}</div>}<div className="platform-card"><div className="platform-table"><div className="platform-table-head"><span>Event</span><span>Source</span><span>Status</span><span>Received</span><span>ID</span><span /></div>{visible.map((event) => <button className="platform-table-row" key={event.id} onClick={() => setSelected(event)}><span><strong>{event.event}</strong></span><span>{event.source}</span><span><StatusPill value={event.status} /></span><span>{event.receivedAt}</span><span>{event.id}</span><ChevronLeft className="rotate-180" size={15} /></button>)}</div></div>{selected && <div className="modal-backdrop"><section className="platform-modal"><div className="modal-head"><div><span className="eyebrow">EVENT DETAIL</span><h2>{selected.event}</h2><p>{selected.id} · {selected.source}</p></div><button onClick={() => setSelected(null)}><X size={17} /></button></div><div className="modal-event-meta"><StatusPill value={selected.status} /><span>Received {selected.receivedAt}</span></div><pre className="platform-code">{JSON.stringify(selected.payload, null, 2)}</pre><div className="modal-actions"><button className="outline-button" onClick={() => setSelected(null)}>Close</button><button className="primary-action" onClick={replay}><Play size={14} /> Replay event</button></div></section></div>}</PageFrame>
}

function TaskDefinitionsPage() {
  const [items, setItems] = useState<TaskDefinitionRecord[]>([])
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const emptyDraft: TaskDefinitionDraft = { name: '', description: '', owner: 'platform', timeoutSeconds: '60', retryCount: '3', retryLogic: 'FIXED', retryDelaySeconds: '0', maxRetryDelaySeconds: '0', backoffJitterMs: '0', totalTimeoutSeconds: '0', responseTimeoutSeconds: '0', pollTimeoutSeconds: '0' }
  const [draft, setDraft] = useState<TaskDefinitionDraft>(emptyDraft)
  const refresh = () => { void workflowApi.listTaskDefinitions().then(setItems) }
  useEffect(() => { refresh() }, [])
  const visible = items.filter((item) => `${item.name} ${item.description} ${item.owner}`.toLowerCase().includes(query.toLowerCase()))
  const save = () => { if (!draft.name.trim()) return; void workflowApi.saveTaskDefinition({ name: draft.name.trim(), description: draft.description, owner: draft.owner, timeoutSeconds: Number(draft.timeoutSeconds) || 60, retryCount: Number(draft.retryCount) || 0, retryLogic: draft.retryLogic, retryDelaySeconds: Number(draft.retryDelaySeconds) || 0, maxRetryDelaySeconds: Number(draft.maxRetryDelaySeconds) || 0, backoffJitterMs: Number(draft.backoffJitterMs) || 0, totalTimeoutSeconds: Number(draft.totalTimeoutSeconds) || 0, responseTimeoutSeconds: Number(draft.responseTimeoutSeconds) || 0, pollTimeoutSeconds: Number(draft.pollTimeoutSeconds) || 0, updatedAt: new Date().toISOString(), status: 'ACTIVE' }).then(() => { setFormOpen(false); setDraft(emptyDraft); refresh() }) }
  const remove = (name: string) => { if (!window.confirm(`Delete task definition "${name}"?`)) return; void workflowApi.deleteTaskDefinition(name).then(refresh) }
  return <PageFrame eyebrow="DEFINITIONS / TASK" title="Task Definitions" description="Manage worker task contracts, retry policy and execution timeouts." actions={<button className="primary-action" onClick={() => setFormOpen(true)}><Plus size={15} /> New task definition</button>}><Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search task definitions..." /><span className="toolbar-count">{visible.length} definitions</span></Toolbar><div className="platform-card"><div className="platform-table"><div className="platform-table-head"><span>Task definition</span><span>Owner</span><span>Timeout</span><span>Retries</span><span>Status</span><span>Updated</span></div>{visible.map((item) => <div className="platform-table-row static" key={item.name}><span><strong>{item.name}</strong><small>{item.description}</small></span><span>{item.owner}</span><span>{item.timeoutSeconds}s</span><span>{item.retryCount} · {item.retryLogic ?? 'FIXED'}</span><span><StatusPill value={item.status} /></span><span className="row-inline-actions"><span>{item.updatedAt}</span><button className="icon-button" aria-label={`Delete task definition ${item.name}`} onClick={() => remove(item.name)}><Trash2 size={14} /></button></span></div>)}</div></div>{formOpen && <TaskDefinitionModal draft={draft} setDraft={setDraft} onCancel={() => setFormOpen(false)} onSave={save} />}</PageFrame>
}

type TaskDefinitionDraft = { name: string; description: string; owner: string; timeoutSeconds: string; retryCount: string; retryLogic: 'FIXED' | 'EXPONENTIAL_BACKOFF' | 'LINEAR_BACKOFF'; retryDelaySeconds: string; maxRetryDelaySeconds: string; backoffJitterMs: string; totalTimeoutSeconds: string; responseTimeoutSeconds: string; pollTimeoutSeconds: string }

function TaskDefinitionModal({ draft, setDraft, onCancel, onSave }: { draft: TaskDefinitionDraft; setDraft: (draft: TaskDefinitionDraft) => void; onCancel: () => void; onSave: () => void }) { return <div className="modal-backdrop"><section className="platform-modal"><div className="modal-head"><div><span className="eyebrow">TASK DEFINITIONS</span><h2>New task definition</h2><p>Register the contract used by worker tasks.</p></div><button onClick={onCancel}><X size={17} /></button></div><div className="modal-fields"><label>Name<input value={draft.name} placeholder="send_email" onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Description<input value={draft.description} placeholder="Sends a transactional email" onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><div className="compact-fields"><label>Owner<input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></label><label>Timeout (sec)<input type="number" value={draft.timeoutSeconds} onChange={(event) => setDraft({ ...draft, timeoutSeconds: event.target.value })} /></label><label>Retry count<input type="number" value={draft.retryCount} onChange={(event) => setDraft({ ...draft, retryCount: event.target.value })} /></label></div><div className="compact-fields"><label>Retry logic<select className="native-select" value={draft.retryLogic} onChange={(event) => setDraft({ ...draft, retryLogic: event.target.value as TaskDefinitionDraft['retryLogic'] })}><option value="FIXED">Fixed</option><option value="EXPONENTIAL_BACKOFF">Exponential backoff</option><option value="LINEAR_BACKOFF">Linear backoff</option></select></label><label>Retry delay (sec)<input type="number" value={draft.retryDelaySeconds} onChange={(event) => setDraft({ ...draft, retryDelaySeconds: event.target.value })} /></label><label>Max retry delay<input type="number" value={draft.maxRetryDelaySeconds} onChange={(event) => setDraft({ ...draft, maxRetryDelaySeconds: event.target.value })} /></label></div><div className="compact-fields"><label>Backoff jitter (ms)<input type="number" value={draft.backoffJitterMs} onChange={(event) => setDraft({ ...draft, backoffJitterMs: event.target.value })} /></label><label>Total timeout (sec)<input type="number" value={draft.totalTimeoutSeconds} onChange={(event) => setDraft({ ...draft, totalTimeoutSeconds: event.target.value })} /></label><label>Response timeout (sec)<input type="number" value={draft.responseTimeoutSeconds} onChange={(event) => setDraft({ ...draft, responseTimeoutSeconds: event.target.value })} /></label></div><label>Poll timeout (sec)<input type="number" value={draft.pollTimeoutSeconds} onChange={(event) => setDraft({ ...draft, pollTimeoutSeconds: event.target.value })} /></label></div><div className="modal-actions"><button className="outline-button" onClick={onCancel}>Cancel</button><button className="primary-action" onClick={onSave}><Check size={14} /> Save definition</button></div></section></div> }

function EventHandlersPage() {
  const [items, setItems] = useState<EventHandlerRecord[]>([])
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', event: '', action: 'START_WORKFLOW', workflowName: 'api_polling_workflow' })
  const refresh = () => { void workflowApi.listEventHandlers().then(setItems) }
  useEffect(() => { refresh() }, [])
  const save = () => { if (!draft.name.trim() || !draft.event.trim()) return; void workflowApi.saveEventHandler({ ...draft, name: draft.name.trim(), event: draft.event.trim(), active: true, updatedAt: new Date().toISOString() }).then(() => { setFormOpen(false); refresh() }) }
  const visible = items.filter((item) => `${item.name} ${item.event} ${item.action} ${item.workflowName}`.toLowerCase().includes(query.toLowerCase()))
  const toggle = (item: EventHandlerRecord) => { void workflowApi.saveEventHandler({ ...item, active: !item.active, updatedAt: new Date().toISOString() }).then(refresh) }
  const remove = (name: string) => { if (!window.confirm(`Delete event handler "${name}"?`)) return; void workflowApi.deleteEventHandler(name).then(refresh) }
  return <PageFrame eyebrow="DEFINITIONS / EVENT HANDLER" title="Event Handlers" description="Route incoming events to workflows and platform actions." actions={<button className="primary-action" onClick={() => setFormOpen(true)}><Plus size={15} /> New event handler</button>}><Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search event handlers..." /><span className="toolbar-count">{visible.length} handlers</span></Toolbar><div className="platform-card"><div className="platform-table"><div className="platform-table-head"><span>Handler</span><span>Event</span><span>Action</span><span>Workflow</span><span>Status</span><span>Updated</span></div>{visible.map((item) => <div className="platform-table-row static" key={item.name}><span><strong>{item.name}</strong></span><span>{item.event}</span><span>{item.action}</span><span>{item.workflowName}</span><button className="inline-status-button" onClick={() => toggle(item)}><StatusPill value={item.active ? 'ACTIVE' : 'PAUSED'} /></button><span className="row-inline-actions"><span>{item.updatedAt}</span><button className="icon-button" aria-label={`Delete event handler ${item.name}`} onClick={() => remove(item.name)}><Trash2 size={14} /></button></span></div>)}</div></div>{formOpen && <div className="modal-backdrop"><section className="platform-modal"><div className="modal-head"><div><span className="eyebrow">EVENT HANDLERS</span><h2>New event handler</h2></div><button onClick={() => setFormOpen(false)}><X size={17} /></button></div><div className="modal-fields"><label>Name<input value={draft.name} placeholder="order_completed" onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Event name<input value={draft.event} placeholder="order.completed" onChange={(event) => setDraft({ ...draft, event: event.target.value })} /></label><div className="compact-fields"><label>Action<select className="native-select" value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })}><option>START_WORKFLOW</option><option>PUBLISH_EVENT</option><option>UPDATE_SECRET</option></select></label><label>Workflow<input value={draft.workflowName} onChange={(event) => setDraft({ ...draft, workflowName: event.target.value })} /></label></div></div><div className="modal-actions"><button className="outline-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-action" onClick={save}><Check size={14} /> Save handler</button></div></section></div>}</PageFrame>
}

function SchedulersPage() {
  const [items, setItems] = useState<ScheduleRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [draft, setDraft] = useState({ name: '', workflowName: 'api_polling_workflow', cronExpression: '0 */5 * * * *', timezone: 'UTC', catchUp: false, overlapPolicy: 'SKIP' as ScheduleRecord['overlapPolicy'], startTime: '', endTime: '' })
  const refresh = () => { void workflowApi.listSchedules().then(setItems) }
  useEffect(() => { refresh() }, [])
  const save = () => { if (!draft.name.trim() || !draft.cronExpression.trim()) return; void workflowApi.saveSchedule({ ...draft, name: draft.name.trim(), active: true, nextRun: 'Calculating…', updatedAt: new Date().toISOString() }).then(() => { setFormOpen(false); refresh() }) }
  const toggle = (item: ScheduleRecord) => { void workflowApi.saveSchedule({ ...item, active: !item.active, nextRun: item.active ? 'Paused' : 'Calculating…', updatedAt: new Date().toISOString() }).then(refresh) }
  const visible = items.filter((item) => `${item.name} ${item.workflowName} ${item.cronExpression} ${item.timezone}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? item.active : !item.active)))
  const remove = (name: string) => { if (!window.confirm(`Delete schedule "${name}"?`)) return; void workflowApi.deleteSchedule(name).then(refresh) }
  const runNow = (item: ScheduleRecord) => { void workflowApi.runSchedule(item.name).then((record) => setActionMessage(`Schedule run started: ${record.executionId}`)).catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Schedule run failed.')) }
  const clone = (item: ScheduleRecord) => { const requested = window.prompt('New schedule name', `${item.name}_copy`); const cloneName = requested?.trim(); if (!cloneName) return; void workflowApi.cloneSchedule(item.name, cloneName).then(() => { setActionMessage(`Schedule cloned: ${cloneName}`); refresh() }).catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Schedule clone failed.')) }
  return <PageFrame eyebrow="DEFINITIONS / SCHEDULER" title="Scheduler Definitions" description="Create and operate cron-based workflow schedules." actions={<button className="primary-action" onClick={() => setFormOpen(true)}><Plus size={15} /> New schedule</button>}><Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search schedules..." /><label className="platform-select"><Filter size={14} /><select aria-label="Schedule status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">All schedules</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></select></label><span className="toolbar-count">{visible.length} schedules</span></Toolbar>{actionMessage && <div className="platform-success">{actionMessage}</div>}<div className="platform-card"><div className="platform-table"><div className="platform-table-head"><span>Schedule</span><span>Workflow</span><span>Cron</span><span>Timezone</span><span>Status</span><span>Next run</span><span /></div>{visible.map((item) => <div className="platform-table-row static" key={item.name}><span><strong>{item.name}</strong><small>{item.catchUp ? 'Catch-up enabled' : 'No catch-up'} · overlap {item.overlapPolicy}</small></span><span>{item.workflowName}</span><span><code>{item.cronExpression}</code></span><span>{item.timezone}</span><button className="inline-status-button" onClick={() => toggle(item)}><StatusPill value={item.active ? 'ACTIVE' : 'PAUSED'} /></button><span className="row-inline-actions"><span>{item.nextRun}</span><button className="icon-button" aria-label={`Run schedule ${item.name}`} onClick={() => runNow(item)}><Play size={14} /></button><button className="icon-button" aria-label={`Clone schedule ${item.name}`} onClick={() => clone(item)}><Copy size={14} /></button><button className="icon-button" aria-label={`Delete schedule ${item.name}`} onClick={() => remove(item.name)}><Trash2 size={14} /></button></span></div>)}</div></div>{formOpen && <div className="modal-backdrop"><section className="platform-modal"><div className="modal-head"><div><span className="eyebrow">SCHEDULER</span><h2>New schedule</h2></div><button onClick={() => setFormOpen(false)}><X size={17} /></button></div><div className="modal-fields"><label>Name<input value={draft.name} placeholder="nightly_cleanup" onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Workflow<input value={draft.workflowName} onChange={(event) => setDraft({ ...draft, workflowName: event.target.value })} /></label><div className="compact-fields"><label>Cron expression<input value={draft.cronExpression} onChange={(event) => setDraft({ ...draft, cronExpression: event.target.value })} /></label><label>Timezone<input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /></label></div><div className="compact-fields"><label>Start time<input type="datetime-local" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label><label>End time<input type="datetime-local" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label></div><label className="form-toggle"><input type="checkbox" checked={draft.catchUp} onChange={(event) => setDraft({ ...draft, catchUp: event.target.checked })} /><span>Catch up missed runs</span></label><label>Overlap policy<select className="native-select" value={draft.overlapPolicy} onChange={(event) => setDraft({ ...draft, overlapPolicy: event.target.value as ScheduleRecord['overlapPolicy'] })}><option value="SKIP">Skip if already running</option><option value="ALLOW">Allow overlap</option></select></label>{draft.timezone === 'UTC' && <span className="field-hint">Timezone preview: UTC has no daylight-saving transition.</span>}</div><div className="modal-actions"><button className="outline-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-action" onClick={save}><Check size={14} /> Save schedule</button></div></section></div>}</PageFrame>
}

type SchemaRecord = { name: string; version: number; format: string; status: 'ACTIVE' | 'DRAFT'; fields: number; source: string }
const defaultSchemaText = '{\n  "type": "object",\n  "properties": {\n    "jobId": { "type": "string" }\n  }\n}'
const defaultSchemas: SchemaRecord[] = [{ name: 'workflow_input_v1', version: 1, format: 'JSON', status: 'ACTIVE', fields: 4, source: defaultSchemaText }, { name: 'worker_output_v1', version: 2, format: 'JSON', status: 'ACTIVE', fields: 8, source: '{\n  "type": "object",\n  "properties": {}\n}' }]

function SchemasPage() {
  const [schemas, setSchemas] = useState<SchemaRecord[]>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('orkes-schema-registry') ?? 'null') as unknown
      return Array.isArray(stored) ? stored as SchemaRecord[] : defaultSchemas
    } catch { return defaultSchemas }
  })
  const [selectedName, setSelectedName] = useState('workflow_input_v1')
  const selected = schemas.find((schema) => schema.name === selectedName) ?? schemas[0] ?? defaultSchemas[0]
  const [schemaText, setSchemaText] = useState(selected.source)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { window.localStorage.setItem('orkes-schema-registry', JSON.stringify(schemas)) }, [schemas])
  const visible = schemas.filter((schema) => schema.name.toLowerCase().includes(query.toLowerCase()))
  const selectSchema = (schema: SchemaRecord) => { setSelectedName(schema.name); setSchemaText(schema.source); setMessage('') }
  const updateSource = (source: string) => { setSchemaText(source); setMessage(''); setSchemas((current) => current.map((item) => item.name === selected.name ? { ...item, source, status: 'DRAFT' } : item)) }
  const validate = () => {
    try {
      const parsed = JSON.parse(schemaText) as { type?: string; properties?: Record<string, unknown> }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Root schema must be an object.')
      const fields = parsed.properties && typeof parsed.properties === 'object' ? Object.keys(parsed.properties).length : 0
      setSchemas((current) => current.map((item) => item.name === selected.name ? { ...item, source: schemaText, status: 'ACTIVE', fields } : item))
      setMessage(`Schema validated successfully · ${fields} properties.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Schema JSON is invalid.') }
  }
  const addSchema = () => { const name = `new_schema_${schemas.length + 1}`; const next: SchemaRecord = { name, version: 1, format: 'JSON', status: 'DRAFT', fields: 0, source: '{\n  "type": "object",\n  "properties": {}\n}' }; setSchemas((current) => [...current, next]); selectSchema(next); setMessage('New schema draft created.') }
  const publish = () => setSchemas((current) => current.map((item) => item.name === selected.name ? { ...item, version: item.version + 1, status: 'ACTIVE' } : item))
  return <PageFrame eyebrow="DEFINITIONS / SCHEMAS" title="Schemas" description="Version and validate JSON schemas used by workflows and worker tasks." actions={<button className="primary-action" onClick={addSchema}><Plus size={15} /> New schema</button>}><div className="schema-layout"><div className="platform-card schema-list"><Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search schemas..." /></Toolbar>{visible.map((schema) => <button className={`schema-list-item ${selected.name === schema.name ? 'active' : ''}`} key={schema.name} onClick={() => selectSchema(schema)}><FileJson size={16} /><span><strong>{schema.name}</strong><small>v{schema.version} · {schema.fields} fields</small></span><StatusPill value={schema.status} /></button>)}</div><div className="platform-card schema-editor"><div className="platform-card-head"><div><strong>{selected.name}</strong><span>Version {selected.version} · {selected.format}</span></div><button className="outline-button compact-button" onClick={validate}><Check size={14} /> Validate</button></div><textarea className="schema-code-editor" value={schemaText} onChange={(event) => updateSource(event.target.value)} spellCheck={false} />{message && <div className={`schema-message ${message.includes('successfully') ? 'success' : 'error'}`}>{message}</div>}<div className="schema-editor-footer"><span>JSON Schema draft 2020-12</span><button className="primary-action" onClick={publish}><Archive size={14} /> Publish version</button></div></div></div></PageFrame>
}

function _LegacySchemasPage() {
  const [schemas, setSchemas] = useState([{ name: 'workflow_input_v1', version: 1, format: 'JSON', status: 'ACTIVE', fields: 4 }, { name: 'worker_output_v1', version: 2, format: 'JSON', status: 'ACTIVE', fields: 8 }])
  const [selected, setSelected] = useState(schemas[0])
  const [schemaText, setSchemaText] = useState('{\n  "type": "object",\n  "properties": {\n    "jobId": { "type": "string" }\n  }\n}')
  const [query, setQuery] = useState('')
  const visible = schemas.filter((schema) => schema.name.toLowerCase().includes(query.toLowerCase()))
  return <PageFrame eyebrow="DEFINITIONS / SCHEMAS" title="Schemas" description="Version and validate JSON schemas used by workflows and worker tasks." actions={<button className="primary-action" onClick={() => { const name = `new_schema_${schemas.length + 1}`; const next = { name, version: 1, format: 'JSON', status: 'DRAFT', fields: 0 }; setSchemas([...schemas, next]); setSelected(next) }}><Plus size={15} /> New schema</button>}><div className="schema-layout"><div className="platform-card schema-list"><Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search schemas..." /></Toolbar>{visible.map((schema) => <button className={`schema-list-item ${selected.name === schema.name ? 'active' : ''}`} key={schema.name} onClick={() => setSelected(schema)}><FileJson size={16} /><span><strong>{schema.name}</strong><small>v{schema.version} · {schema.fields} fields</small></span><StatusPill value={schema.status} /></button>)}</div><div className="platform-card schema-editor"><div className="platform-card-head"><div><strong>{selected.name}</strong><span>Version {selected.version} · {selected.format}</span></div><button className="outline-button compact-button" onClick={() => { try { JSON.parse(schemaText); setSchemas(schemas.map((item) => item.name === selected.name ? { ...item, status: 'ACTIVE', fields: Math.max(1, Object.keys(JSON.parse(schemaText).properties ?? {}).length) } : item)) } catch { /* editor keeps invalid JSON visible for correction */ } }}><Check size={14} /> Validate</button></div><textarea className="schema-code-editor" value={schemaText} onChange={(event) => setSchemaText(event.target.value)} spellCheck={false} /><div className="schema-editor-footer"><span>JSON Schema draft 2020-12</span><button className="primary-action" onClick={() => setSchemas(schemas.map((item) => item.name === selected.name ? { ...item, version: item.version + 1 } : item))}><Archive size={14} /> Publish version</button></div></div></div></PageFrame>
}

function ApiReferencePage() {
  const endpoints = [{ group: 'Workflow', method: 'GET', path: '/api/workflow/{name}', desc: 'Get a workflow definition.' }, { group: 'Workflow', method: 'POST', path: '/api/workflow', desc: 'Create or update a workflow definition.' }, { group: 'Execution', method: 'POST', path: '/api/workflow/{name}/execute', desc: 'Start a workflow execution.' }, { group: 'Execution', method: 'GET', path: '/api/workflow/{name}/{id}', desc: 'Get execution details.' }, { group: 'Task', method: 'GET', path: '/api/tasks/queue/{taskType}', desc: 'Inspect a task queue.' }, { group: 'Event', method: 'POST', path: '/api/event', desc: 'Publish an event.' }]
  const [query, setQuery] = useState('')
  const visible = endpoints.filter((endpoint) => `${endpoint.group} ${endpoint.method} ${endpoint.path} ${endpoint.desc}`.toLowerCase().includes(query.toLowerCase()))
  return <PageFrame eyebrow="API DOCS" title="API Reference" description="Explore the Conductor-compatible APIs exposed by this workspace." actions={<button className="outline-button" onClick={() => navigator.clipboard?.writeText('http://localhost:8080/api')}><Copy size={15} /> Copy base URL</button>}><Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search API operations..." /></Toolbar><div className="api-reference-list">{visible.map((endpoint) => <div className="api-operation" key={`${endpoint.method}-${endpoint.path}`}><div className={`api-method ${endpoint.method.toLowerCase()}`}>{endpoint.method}</div><div><strong>{endpoint.path}</strong><span>{endpoint.group} · {endpoint.desc}</span></div><button className="icon-button" aria-label={`Copy ${endpoint.path}`} onClick={() => navigator.clipboard?.writeText(endpoint.path)}><Copy size={15} /></button><ChevronLeft className="rotate-180" size={15} /></div>)}</div></PageFrame>
}

type IntegrationRecord = { name: string; type: string; category: 'HTTP' | 'EVENT' | 'AI MODEL' | 'DATABASE'; endpoint: string; owner: string; status: 'ACTIVE' | 'PAUSED' }
const integrationStorageKey = 'orkes-integrations-v1'
const defaultIntegrations: IntegrationRecord[] = [
  { name: 'payments_api', type: 'HTTP', category: 'HTTP', endpoint: 'https://payments.example.local', owner: 'platform', status: 'ACTIVE' },
  { name: 'workflow_events', type: 'Kafka', category: 'EVENT', endpoint: 'orders.events', owner: 'platform', status: 'ACTIVE' },
]

function IntegrationsPage() {
  const [items, setItems] = useState<IntegrationRecord[]>(() => {
    if (typeof window === 'undefined') return defaultIntegrations
    try {
      const stored = JSON.parse(window.localStorage.getItem(integrationStorageKey) ?? 'null') as unknown
      return Array.isArray(stored) ? stored as IntegrationRecord[] : defaultIntegrations
    } catch { return defaultIntegrations }
  })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', type: 'HTTP', category: 'HTTP' as IntegrationRecord['category'], endpoint: '', owner: 'platform' })
  useEffect(() => { window.localStorage.setItem(integrationStorageKey, JSON.stringify(items)) }, [items])
  const visible = useMemo(() => items.filter((item) => `${item.name} ${item.type} ${item.category} ${item.endpoint} ${item.owner}`.toLowerCase().includes(query.toLowerCase()) && (category === 'ALL' || item.category === category)), [category, items, query])
  const save = () => {
    if (!draft.name.trim() || !draft.endpoint.trim()) return
    const record: IntegrationRecord = { ...draft, name: draft.name.trim(), endpoint: draft.endpoint.trim(), status: 'ACTIVE' }
    setItems((current) => [...current.filter((item) => item.name !== record.name), record])
    setDraft({ name: '', type: 'HTTP', category: 'HTTP', endpoint: '', owner: 'platform' })
    setFormOpen(false)
  }
  const toggle = (name: string) => setItems((current) => current.map((item) => item.name === name ? { ...item, status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : item))
  const remove = (name: string) => { if (window.confirm(`Delete integration "${name}"?`)) setItems((current) => current.filter((item) => item.name !== name)) }
  return <PageFrame eyebrow="INTEGRATIONS" title="Connections and Resources" description="Register the external systems used by HTTP, event, AI and database tasks." actions={<button className="primary-action" onClick={() => setFormOpen(true)}><Plus size={15} /> New connection</button>}>
    <div className="metric-cards"><MetricCard icon={Globe2} label="Connected resources" value={items.length} tone="blue" /><MetricCard icon={Activity} label="Active connections" value={items.filter((item) => item.status === 'ACTIVE').length} tone="green" /><MetricCard icon={Settings2} label="Categories" value={new Set(items.map((item) => item.category)).size} tone="amber" /></div>
    <Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search connections and resources..." /><label className="platform-select"><Filter size={15} /><select aria-label="Integration category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option><option value="HTTP">HTTP</option><option value="EVENT">Event</option><option value="AI MODEL">AI model</option><option value="DATABASE">Database</option></select></label><span className="toolbar-count">{visible.length} connections</span></Toolbar>
    <div className="platform-card"><div className="platform-card-head"><div><strong>Configured connections</strong><span>These resources can be selected from task-specific connection fields.</span></div><Server size={17} /></div><div className="platform-table"><div className="platform-table-head"><span>Connection</span><span>Type</span><span>Endpoint</span><span>Owner</span><span>Status</span><span>Actions</span></div>{visible.length === 0 ? <EmptyState icon={Globe2} title="No connections found" detail="Create a connection or adjust your search." /> : visible.map((item) => <div className="platform-table-row static" key={item.name}><span><strong>{item.name}</strong><small>{item.category} resource</small></span><span>{item.type}</span><span>{item.endpoint}</span><span>{item.owner}</span><button className="inline-status-button" onClick={() => toggle(item.name)}><StatusPill value={item.status} /></button><span className="row-inline-actions"><button className="icon-button" aria-label={`Delete integration ${item.name}`} onClick={() => remove(item.name)}><Trash2 size={14} /></button></span></div>)}</div></div>
    {formOpen && <div className="modal-backdrop"><section className="platform-modal"><div className="modal-head"><div><span className="eyebrow">INTEGRATIONS</span><h2>New connection</h2><p>Save a reusable resource for workflow tasks.</p></div><button onClick={() => setFormOpen(false)}><X size={17} /></button></div><div className="modal-fields"><label>Name<input aria-label="Connection name" value={draft.name} placeholder="crm_api" onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><div className="compact-fields"><label>Type<select className="native-select" aria-label="Connection type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>HTTP</option><option>Kafka</option><option>OpenAI</option><option>PostgreSQL</option></select></label><label>Category<select className="native-select" aria-label="Connection category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as IntegrationRecord['category'] })}><option>HTTP</option><option>EVENT</option><option>AI MODEL</option><option>DATABASE</option></select></label></div><label>Endpoint or resource<input aria-label="Connection endpoint" value={draft.endpoint} placeholder="https://api.example.local" onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })} /></label><label>Owner<input aria-label="Connection owner" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></label></div><div className="modal-actions"><button className="outline-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-action" onClick={save}><Check size={14} /> Save connection</button></div></section></div>}
  </PageFrame>
}

type ResourceView = Exclude<PlatformView, 'executions' | 'execution-detail' | 'run-workflow' | 'queue' | 'events' | 'task-definitions' | 'event-handlers' | 'schedulers' | 'schemas' | 'api' | 'integrations' | 'access'>
type ResourceConfig = { eyebrow: string; title: string; description: string; noun: string; icon: typeof Activity; seeds: Array<{ name: string; detail: string; owner: string; status: 'ACTIVE' | 'PAUSED' }> }
const resourceConfig: Partial<Record<ResourceView, ResourceConfig>> = {
  agents: { eyebrow: 'EXECUTIONS / AGENTS', title: 'Agent Executions', description: 'Inspect agent runs, handoffs and current orchestration state.', noun: 'agent', icon: Activity, seeds: [{ name: 'news_research_agent', detail: 'Search and summarize external sources', owner: 'platform', status: 'ACTIVE' }] },
  'human-tasks': { eyebrow: 'EXECUTIONS / HUMAN TASKS', title: 'Human Tasks', description: 'Review tasks waiting for human interaction and approvals.', noun: 'human task', icon: UsersRound, seeds: [{ name: 'approval-queue', detail: 'Awaiting operations approval', owner: 'operations', status: 'PAUSED' }] },
  workers: { eyebrow: 'EXECUTIONS / WORKERS', title: 'Workers', description: 'Monitor registered workers and their heartbeat status.', noun: 'worker', icon: Server, seeds: [{ name: 'worker-api-01', detail: 'HTTP task worker · last poll just now', owner: 'platform', status: 'ACTIVE' }] },
  'user-forms': { eyebrow: 'DEFINITIONS / USER FORMS', title: 'User Forms', description: 'Manage forms used by Human Task workflows.', noun: 'user form', icon: FileJson, seeds: [{ name: 'payment_approval_form', detail: 'Payment approval fields', owner: 'finance', status: 'ACTIVE' }] },
  secrets: { eyebrow: 'DEFINITIONS / SECRETS', title: 'Secrets', description: 'Manage masked secret bindings available to workflows.', noun: 'secret', icon: Settings2, seeds: [{ name: 'HTTP_API_TOKEN', detail: 'Masked runtime secret', owner: 'platform', status: 'ACTIVE' }] },
  webhooks: { eyebrow: 'DEFINITIONS / WEBHOOKS', title: 'Webhooks', description: 'Configure inbound callbacks for event-driven workflows.', noun: 'webhook', icon: Globe2, seeds: [{ name: 'job-status-callback', detail: 'POST /hooks/job-status', owner: 'platform', status: 'ACTIVE' }] },
  'ai-prompts': { eyebrow: 'DEFINITIONS / AI PROMPTS', title: 'AI Prompts', description: 'Version and review reusable prompts for AI tasks.', noun: 'AI prompt', icon: Code2, seeds: [{ name: 'summarize_news_v1', detail: 'Summarize source articles with citations', owner: 'platform', status: 'ACTIVE' }] },
  environment: { eyebrow: 'DEFINITIONS / ENVIRONMENT', title: 'Environment Variables', description: 'Manage runtime values referenced by workflow expressions.', noun: 'environment variable', icon: Settings2, seeds: [{ name: 'API_BASE_URL', detail: 'https://api.example.local', owner: 'platform', status: 'ACTIVE' }] },
  applications: { eyebrow: 'ACCESS CONTROL / APPLICATIONS', title: 'Applications', description: 'Manage service accounts and application credentials.', noun: 'application', icon: UsersRound, seeds: [{ name: 'workflow-studio', detail: 'Editor service account', owner: 'platform', status: 'ACTIVE' }] },
  groups: { eyebrow: 'ACCESS CONTROL / GROUPS', title: 'Groups', description: 'Organize workspace users and their permissions.', noun: 'group', icon: UsersRound, seeds: [{ name: 'workflow-operators', detail: 'Can run and inspect workflows', owner: 'platform', status: 'ACTIVE' }] },
  users: { eyebrow: 'ACCESS CONTROL / USERS', title: 'Users', description: 'Review workspace identities and access status.', noun: 'user', icon: UsersRound, seeds: [{ name: 'celikonline@gmail.com', detail: 'Workspace owner', owner: 'platform', status: 'ACTIVE' }] },
  authentication: { eyebrow: 'APIS / AUTHENTICATION', title: 'Authentication', description: 'Review API authentication methods and access tokens.', noun: 'auth method', icon: Settings2, seeds: [{ name: 'Bearer token', detail: 'API request authentication', owner: 'platform', status: 'ACTIVE' }] },
}

function ResourceRegistryPage({ view }: { view: ResourceView }) {
  const config = resourceConfig[view]
  const storageKey = `orkes-resource-registry-${view}`
  const [items, setItems] = useState(() => {
    if (!config || typeof window === 'undefined') return config?.seeds ?? []
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as unknown
      return Array.isArray(stored) ? stored as typeof config.seeds : config.seeds
    } catch { return config.seeds }
  })
  const [query, setQuery] = useState('')
  const [agentRunOpen, setAgentRunOpen] = useState(false)
  const [agentRunName, setAgentRunName] = useState('')
  const [agentModel, setAgentModel] = useState('')
  const [agentPrompt, setAgentPrompt] = useState('')
  const [agentMessage, setAgentMessage] = useState('')
  useEffect(() => { if (config) window.localStorage.setItem(storageKey, JSON.stringify(items)) }, [config, items, storageKey])
  if (!config) return null
  const visible = items.filter((item) => `${item.name} ${item.detail} ${item.owner} ${item.status}`.toLowerCase().includes(query.toLowerCase()))
  const add = () => setItems((current) => [...current, { name: `new_${view.replaceAll('-', '_')}_${current.length + 1}`, detail: `New ${config.noun} ready for configuration`, owner: 'platform', status: 'PAUSED' }])
  const toggle = (name: string) => setItems((current) => current.map((item) => item.name === name ? { ...item, status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : item))
  const remove = (name: string) => { if (window.confirm(`Delete ${config.noun} "${name}"?`)) setItems((current) => current.filter((item) => item.name !== name)) }
  const runAgent = () => {
    if (view !== 'agents' || !agentRunName || !agentPrompt.trim()) return
    void workflowApi.triggerWorkflow(agentRunName, { prompt: agentPrompt.trim(), model: agentModel.trim() || undefined }, 'agent').then((record) => { setAgentMessage(`Agent execution started: ${record.executionId}`); setAgentRunOpen(false) })
  }
  const Icon = config.icon
  return <PageFrame eyebrow={config.eyebrow} title={config.title} description={config.description} actions={<button className="primary-action" onClick={add}><Plus size={15} /> New {config.noun}</button>}><Toolbar><SearchBox value={query} onChange={setQuery} placeholder={`Search ${config.title.toLowerCase()}...`} /><span className="toolbar-count">{visible.length} items</span></Toolbar>{agentMessage && view === 'agents' && <div className="platform-success">{agentMessage}</div>}<div className="platform-card"><div className="platform-table"><div className="platform-table-head"><span>Name</span><span>Details</span><span>Owner</span><span>Status</span><span>Updated</span><span>Actions</span></div>{visible.length === 0 ? <EmptyState icon={Icon} title={`No ${config.title.toLowerCase()} found`} detail="Create a resource or adjust your search." /> : visible.map((item) => <div className="platform-table-row static" key={item.name}><span><strong>{item.name}</strong><small>{item.detail}</small></span><span>{item.detail}</span><span>{item.owner}</span><button className="inline-status-button" onClick={() => toggle(item.name)}><StatusPill value={item.status} /></button><span>Just now</span><span className="row-inline-actions">{view === 'agents' && <button className="icon-button" aria-label={`Run agent ${item.name}`} onClick={() => { setAgentRunName(item.name); setAgentPrompt(''); setAgentMessage(''); setAgentRunOpen(true) }}><Play size={14} /></button>}<button className="icon-button" aria-label={`Delete ${config.noun} ${item.name}`} onClick={() => remove(item.name)}><Trash2 size={14} /></button></span></div>)}</div></div>{agentRunOpen && view === 'agents' && <div className="modal-backdrop"><section className="platform-modal"><div className="modal-head"><div><span className="eyebrow">AGENT EXECUTION</span><h2>Run agent</h2><p>{agentRunName} · start a prompt-driven execution.</p></div><button onClick={() => setAgentRunOpen(false)}><X size={17} /></button></div><div className="modal-fields"><label>Model override (optional)<input aria-label="Agent model" value={agentModel} placeholder="Use the deployed agent model" onChange={(event) => setAgentModel(event.target.value)} /></label><label>Prompt<textarea aria-label="Agent prompt" value={agentPrompt} placeholder="What should this agent do?" onChange={(event) => setAgentPrompt(event.target.value)} /></label></div><div className="modal-actions"><button className="outline-button" onClick={() => setAgentRunOpen(false)}>Cancel</button><button className="primary-action" onClick={runAgent} disabled={!agentPrompt.trim()}><Play size={14} /> Run agent</button></div></section></div>}</PageFrame>
}

function PlatformPlaceholder({ view, onNavigate }: { view: PlatformView; onNavigate: Navigation }) {
  const title = view === 'integrations' ? 'Integrations' : 'Access Control'
  const Icon = view === 'integrations' ? Globe2 : UsersRound
  return <PageFrame eyebrow={view === 'integrations' ? 'INTEGRATIONS' : 'ACCESS CONTROL'} title={title} description={view === 'integrations' ? 'Manage connected applications and service resources.' : 'Manage applications, groups and user permissions.'}><div className="placeholder-grid"><div className="platform-card placeholder-card"><Icon size={24} /><strong>{view === 'integrations' ? 'Connections and resources' : 'Applications and groups'}</strong><span>This local workspace provides the navigation surface and state model for the platform module.</span><button className="outline-button" onClick={() => onNavigate(view === 'integrations' ? 'api' : 'task-definitions')}>{view === 'integrations' ? 'View API resources' : 'Review task access'} <ChevronLeft className="rotate-180" size={14} /></button></div><div className="platform-card placeholder-card"><Settings2 size={24} /><strong>Workspace settings</strong><span>Configure environment-level settings when a connected Conductor backend is available.</span></div></div></PageFrame>
}
