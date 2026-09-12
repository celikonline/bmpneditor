import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  Download,
  FileJson,
  Globe2,
  Layers3,
  LayoutDashboard,
  Maximize2,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  UsersRound,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import { buildWorkflowJson, validateWorkflow, useWorkflowStore, type StudioNode, type TaskConfig, type TaskKind, type WorkflowParameter, type WorkflowSettings, type WorkflowVersionSnapshot } from './workflowStore'
import { bpmnToWorkflow, conductorJsonToGraph, toConductorDefinition, workflowToBpmn, type ImportReview } from './adapters'
import { workflowApi, type ExecutionRecord, type RealtimeExecutionEvent, type TaskExecutionStatus, type WorkflowDefinitionRecord } from './workflowApi'
import { can, type Role } from './security'
import { taskCatalog, type TaskCatalogItem } from './taskCatalog'
import { generateNestedTask, generateTaskNode } from './conductor/taskGenerator'
import { getTaskFormDefinition } from './conductor/taskFormRegistry'
import { TaskFormFields as PortedTaskFormFields, TaskPolicyFields } from './conductor/taskForms'
import { useEditorState } from './conductor/editorState'
import { appendNestedTask, removeNestedTask, type NestedTaskTarget } from './conductor/nestedOperations'
import { AddTaskDrawer as PortedAddTaskDrawer, QuickAddMenu as PortedQuickAddMenu } from './conductor/richAddTaskMenu'
import { nodeTypes } from './conductor/canvasNodes'
import { PlatformPage, type PlatformView } from './platformPages'
const MonacoEditor = lazy(() => import('@monaco-editor/react'))

const initialNodes: StudioNode[] = [
  { id: 'start', type: 'start', position: { x: 210, y: 24 }, data: { label: 'Start', ref: 'start', kind: 'SIMPLE' } },
  { id: 'submit-job', type: 'studio', position: { x: 138, y: 115 }, data: { label: 'submit_job', ref: 'submit_job_ref', kind: 'HTTP', detail: 'POST  ${workflow.input.jobSubmitUrl}', config: { method: 'POST', url: '${workflow.input.jobSubmitUrl}', headers: '{\n  "content-type": "application/json"\n}', body: '{\n  "jobId": "${workflow.input.jobId}"\n}', inputParameters: '{\n  "jobId": "${workflow.input.jobId}"\n}', retryCount: 3, timeoutSeconds: 60 } } },
  { id: 'poll-loop', type: 'loop', position: { x: 92, y: 250 }, data: { label: 'poll_job_status', ref: 'poll_job_status_ref', kind: 'DO_WHILE' } },
  { id: 'wait', type: 'studio', position: { x: 42, y: 298 }, data: { label: 'wait_between_polls', ref: 'wait_between_polls_ref', kind: 'WAIT', detail: 'Duration: 30s' } },
  { id: 'check-status', type: 'studio', position: { x: 42, y: 390 }, data: { label: 'check_status', ref: 'check_status_ref', kind: 'HTTP', detail: 'GET  ${workflow.input.jobStatusUrl}/${submit_job_ref.output.response.body.jobId}', config: { method: 'GET', url: '${workflow.input.jobStatusUrl}/${submit_job_ref.output.response.body.jobId}', inputParameters: '{\n  "jobId": "${submit_job_ref.output.response.body.jobId}"\n}', retryCount: 2, timeoutSeconds: 30 } } },
  { id: 'route-status', type: 'switch', position: { x: 132, y: 535 }, data: { label: 'route_on_status', ref: 'route_on_status_ref', kind: 'SWITCH', config: { expression: '$.check_status_ref.output.response.body.status', cases: ['defaultCase', 'failed', 'completed'], decisionCases: { defaultCase: [], failed: [], completed: [] }, defaultCase: [] } } },
  { id: 'timeout', type: 'studio', position: { x: -55, y: 680 }, data: { label: 'handle_timeout', ref: 'handle_timeout_ref', kind: 'TERMINATE', detail: 'TERMINATE' } },
  { id: 'failure', type: 'studio', position: { x: 112, y: 680 }, data: { label: 'handle_failure', ref: 'handle_failure_ref', kind: 'HTTP', detail: 'POST  ${workflow.input.failureCallbackUrl}' } },
  { id: 'success', type: 'studio', position: { x: 282, y: 680 }, data: { label: 'handle_success', ref: 'handle_success_ref', kind: 'HTTP', detail: 'POST  ${workflow.input.successCallbackUrl}' } },
  { id: 'join', type: 'join', position: { x: 158, y: 805 }, data: { label: 'Marks end of switch route_on_status', ref: 'join', kind: 'SIMPLE' } },
  { id: 'end', type: 'end', position: { x: 210, y: 890 }, data: { label: 'End', ref: 'end', kind: 'SIMPLE' } },
]

const edge = (id: string, source: string, target: string, label?: string): Edge => ({
  id, source, target, label, type: label ? 'smoothstep' : 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#9aa7b5', width: 14, height: 14 },
  style: { stroke: '#9aa7b5', strokeWidth: 1.15 },
  labelStyle: { fill: '#627386', fontSize: 10 },
  labelBgStyle: { fill: '#eaf3fc', fillOpacity: 1, stroke: '#d7e7f5' },
  labelBgPadding: [7, 4], labelBgBorderRadius: 4,
})

const initialEdges: Edge[] = [
  edge('e1', 'start', 'submit-job'), edge('e2', 'submit-job', 'poll-loop'), edge('e3', 'poll-loop', 'wait'), edge('e4', 'wait', 'check-status'), edge('e5', 'check-status', 'route-status'),
  edge('e6', 'route-status', 'timeout', 'defaultCase'), edge('e7', 'route-status', 'failure', 'failed'), edge('e8', 'route-status', 'success', 'completed'), edge('e9', 'timeout', 'join'), edge('e10', 'failure', 'join'), edge('e11', 'success', 'join'), edge('e12', 'join', 'end'),
]

const blankNodes: StudioNode[] = [
  { id: 'start', type: 'start', position: { x: 210, y: 24 }, data: { label: 'Start', ref: 'start', kind: 'SIMPLE' } },
  { id: 'end', type: 'end', position: { x: 210, y: 175 }, data: { label: 'End', ref: 'end', kind: 'SIMPLE' } },
]
const blankEdges: Edge[] = [edge('blank-start-end', 'start', 'end')]

function layoutGraph(nodes: StudioNode[], edges: Edge[]): StudioNode[] {
  const distance = new Map<string, number>(nodes.filter((node) => node.type === 'start').map((node) => [node.id, 0]))
  for (let pass = 0; pass < nodes.length; pass += 1) edges.forEach((item) => {
    const sourceRank = distance.get(item.source)
    if (sourceRank !== undefined) distance.set(item.target, Math.max(distance.get(item.target) ?? 0, sourceRank + 1))
  })
  const fallbackRank = Math.max(0, ...distance.values()) + 1
  const byRank = new Map<number, StudioNode[]>()
  nodes.forEach((node) => {
    const rank = distance.get(node.id) ?? (node.type === 'end' ? fallbackRank + 1 : fallbackRank)
    byRank.set(rank, [...(byRank.get(rank) ?? []), node])
  })
  return nodes.map((node) => {
    const rank = [...byRank.entries()].find(([, items]) => items.some((item) => item.id === node.id))?.[0] ?? 0
    const siblings = byRank.get(rank) ?? [node]
    const siblingIndex = siblings.findIndex((item) => item.id === node.id)
    return { ...node, position: { x: 220 + (siblingIndex - (siblings.length - 1) / 2) * 220, y: 35 + rank * 145 } }
  })
}

function buildDiagramSvg(nodes: StudioNode[], edges: Edge[]) {
  const minX = Math.min(0, ...nodes.map((node) => node.position.x))
  const minY = Math.min(0, ...nodes.map((node) => node.position.y))
  const maxX = Math.max(900, ...nodes.map((node) => node.position.x + 220))
  const maxY = Math.max(700, ...nodes.map((node) => node.position.y + 110))
  const width = Math.round(maxX - minX + 80)
  const height = Math.round(maxY - minY + 80)
  const point = (node: StudioNode) => ({ x: Math.round(node.position.x - minX + (node.type === 'start' || node.type === 'end' ? 18 : node.type === 'switch' ? 27 : 90) + 40), y: Math.round(node.position.y - minY + (node.type === 'start' || node.type === 'end' ? 18 : node.type === 'switch' ? 27 : 38) + 40) })
  const lines = edges.map((item) => { const source = nodes.find((node) => node.id === item.source); const target = nodes.find((node) => node.id === item.target); if (!source || !target) return ''; const from = point(source); const to = point(target); return `<path d="M ${from.x} ${from.y} C ${from.x} ${Math.round((from.y + to.y) / 2)}, ${to.x} ${Math.round((from.y + to.y) / 2)}, ${to.x} ${to.y}" fill="none" stroke="#9aa7b5" stroke-width="1.5" marker-end="url(#arrow)" />` }).join('')
  const shapes = nodes.map((node) => { const x = Math.round(node.position.x - minX + 40); const y = Math.round(node.position.y - minY + 40); const label = svgEscape(node.data.label); if (node.type === 'start' || node.type === 'end') return `<circle cx="${x + 18}" cy="${y + 18}" r="17" fill="#f8ffff" stroke="#66a8bd" stroke-width="2" /><text x="${x + 18}" y="${y + 48}" text-anchor="middle" fill="#4d6676" font-size="11">${label}</text>`; if (node.type === 'switch') return `<polygon points="${x + 27},${y} ${x + 54},${y + 27} ${x + 27},${y + 54} ${x},${y + 27}" fill="#fff" stroke="#aeb9c3" stroke-width="1.5" /><text x="${x + 27}" y="${y + 31}" text-anchor="middle" fill="#4d6676" font-size="9">${label}</text>`; return `<rect x="${x}" y="${y}" width="180" height="76" rx="7" fill="#fff" stroke="#d2dce4" /><text x="${x + 12}" y="${y + 25}" fill="#334c61" font-size="11" font-weight="600">${label}</text><text x="${x + 12}" y="${y + 43}" fill="#91a0ad" font-size="9">${svgEscape(node.data.ref)}</text><text x="${x + 12}" y="${y + 61}" fill="#6e8293" font-size="9">${svgEscape(node.data.kind)}</text>` }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9aa7b5" /></marker></defs><rect width="100%" height="100%" fill="#ffffff" />${lines}${shapes}</svg>`
}

function svgEscape(value: string) { return value.replace(/[<>&"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[character] ?? character) }

type ExecutionOptions = { correlationId: string; priority: string; executionName: string; metadata: string; idempotencyKey: string }
type GraphSnapshot = { nodes: StudioNode[]; edges: Edge[] }
type RunState = 'idle' | 'running' | 'paused' | 'completed' | 'terminated'
type BuilderEntry = 'blank' | 'template' | 'ai'
type AppPage = 'builder' | 'list' | PlatformView
const graphSnapshot = (nodes: StudioNode[], edges: Edge[]): GraphSnapshot => ({ nodes, edges })

function resolveAppPage(pathname: string): AppPage {
  if (pathname === '/workflows') return 'list'
  if (pathname === '/executions') return 'executions'
  if (pathname === '/execution') return 'execution-detail'
  if (pathname === '/queueMonitor') return 'queue'
  if (pathname === '/eventMonitor') return 'events'
  if (pathname === '/taskDefs') return 'task-definitions'
  if (pathname === '/eventHandlers') return 'event-handlers'
  if (pathname === '/schedules') return 'schedulers'
  if (pathname === '/schemas') return 'schemas'
  if (pathname === '/apiDocs') return 'api'
  if (pathname === '/integrations') return 'integrations'
  if (pathname === '/accessControl') return 'access'
  return 'builder'
}

function platformPath(view: PlatformView) {
  return ({ executions: '/executions', 'execution-detail': '/execution', queue: '/queueMonitor', events: '/eventMonitor', 'task-definitions': '/taskDefs', 'event-handlers': '/eventHandlers', schedulers: '/schedules', schemas: '/schemas', api: '/apiDocs', integrations: '/integrations', access: '/accessControl' } as Record<PlatformView, string>)[view]
}

function App() {
  const nodes = useWorkflowStore((state) => state.nodes)
  const edges = useWorkflowStore((state) => state.edges)
  const workflow = useWorkflowStore((state) => state.workflow)
  const dirty = useWorkflowStore((state) => state.dirty)
  const savedAt = useWorkflowStore((state) => state.savedAt)
  const setNodes = useWorkflowStore((state) => state.setNodes)
  const setEdges = useWorkflowStore((state) => state.setEdges)
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData)
  const updateWorkflow = useWorkflowStore((state) => state.updateWorkflow)
  const markSaved = useWorkflowStore((state) => state.markSaved)
  const replaceDraft = useWorkflowStore((state) => state.replaceDraft)
  const versionHistory = useWorkflowStore((state) => state.versionHistory)
  const recordVersionSnapshot = useWorkflowStore((state) => state.recordVersionSnapshot)
  const restoreVersionSnapshot = useWorkflowStore((state) => state.restoreVersionSnapshot)
  const { activeTab, setActiveTab, selectedId, setSelectedId, operationContext, setOperationContext, drawerOpen, setDrawerOpen, quickAddOpen, setQuickAddOpen, contextMenu, setContextMenu } = useEditorState()
  const [query, setQuery] = useState('')
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<GraphSnapshot[]>([])
  const [future, setFuture] = useState<GraphSnapshot[]>([])
  const [codeText, setCodeText] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [runState, setRunState] = useState<RunState>('idle')
  const [runtimeNodeId, setRuntimeNodeId] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantHistory, setAssistantHistory] = useState<string[]>([])
  const [versionMenu, setVersionMenu] = useState(false)
  const [downloadMenu, setDownloadMenu] = useState(false)
  const [saveMenu, setSaveMenu] = useState(false)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)
  const [importReview, setImportReview] = useState<{ review: ImportReview; name: string } | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [completedNodeIds, setCompletedNodeIds] = useState<string[]>([])
  const [executionEvents, setExecutionEvents] = useState<Array<{ id: string; label: string; status: TaskExecutionStatus }>>([])
  const [lastExecution, setLastExecution] = useState<ExecutionRecord | null>(null)
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<RealtimeExecutionEvent['type'] | null>(null)
  const [page, setPage] = useState<AppPage>(() => resolveAppPage(window.location.pathname))
  const [validationOpen, setValidationOpen] = useState(false)
  const [canvasSearchOpen, setCanvasSearchOpen] = useState(false)
  const [executeOpen, setExecuteOpen] = useState(false)
  const [executionInput, setExecutionInput] = useState(() => JSON.stringify({ jobId: 'demo-job-001', endpointUrl: 'https://api.example.com/health' }, null, 2))
  const [executionOptions, setExecutionOptions] = useState({ correlationId: '', priority: '0', executionName: '', metadata: '{}', idempotencyKey: '' })
  const [catalogItems, setCatalogItems] = useState<TaskCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [lastSavedJson, setLastSavedJson] = useState('')
  const [role, setRole] = useState<Role>('admin')
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [assistantReview, setAssistantReview] = useState<{ prompt: string; task: typeof taskCatalog[number] } | null>(null)
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<StudioNode> | null>(null)
  const [clipboardNode, setClipboardNode] = useState<StudioNode | null>(null)

  useEffect(() => {
    const onPopState = () => setPage(resolveAppPage(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigatePlatform = useCallback((view: PlatformView) => {
    window.history.pushState({}, '', platformPath(view))
    setPage(view)
  }, [])

  const selectedNode = nodes.find((node) => node.id === selectedId)
  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    void workflowApi.getTaskCatalog().then((items) => { if (active) { setCatalogItems(items); setCatalogError(null); setCatalogLoading(false) } }).catch((error: unknown) => { if (active) { setCatalogError(error instanceof Error ? error.message : 'Task catalog could not be loaded.'); setCatalogLoading(false) } })
    return () => { active = false }
  }, [])
  const validation = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges])
  const workflowJson = useMemo(() => JSON.stringify(buildWorkflowJson(nodes, workflow), null, 2), [nodes, workflow])
  const openQuickAddFromNode = useCallback((nodeId: string, branchName?: string) => { setSelectedId(nodeId); setOperationContext({ nodeId, port: branchName ? 'branch' : 'bottom', branchName }); setDrawerOpen(false); setQuickAddOpen(true); setActiveTab('Task') }, [])
  const currentVersionIsPublished = useMemo(() => versionHistory.some((snapshot) => snapshot.version === workflow.version && snapshot.status === 'PUBLISHED'), [versionHistory, workflow.version])
  const ensureDraftVersion = useCallback(() => {
    if (!dirty && currentVersionIsPublished) updateWorkflow({ version: workflow.version + 1 })
  }, [currentVersionIsPublished, dirty, updateWorkflow, workflow.version])
  const isTypingTarget = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')
  const uniqueReference = (candidate: string, existing: string[]) => {
    const used = new Set(existing)
    if (!used.has(candidate)) return candidate
    let suffix = 2
    while (used.has(`${candidate}_${suffix}`)) suffix += 1
    return `${candidate}_${suffix}`
  }
  const copyNode = useCallback((nodeId: string) => {
    const source = nodes.find((node) => node.id === nodeId)
    if (!source || source.type === 'start' || source.type === 'end') return
    setClipboardNode(source)
    setImportMessage(`Copied ${source.data.label}. Press Ctrl/Cmd+V to paste it.`)
    setContextMenu(null)
  }, [nodes, setContextMenu])
  const pasteNode = useCallback(() => {
    if (!clipboardNode || !can(role, 'workflow:edit')) return
    ensureDraftVersion()
    const ref = uniqueReference(clipboardNode.data.ref, nodes.map((node) => node.data.ref))
    const suffix = ref === clipboardNode.data.ref ? '' : `_${ref.split('_').at(-1)}`
    const copy: StudioNode = { ...clipboardNode, id: `${clipboardNode.id}-paste-${Date.now()}`, position: { x: clipboardNode.position.x + 72, y: clipboardNode.position.y + 72 }, selected: false, data: { ...clipboardNode.data, label: `${clipboardNode.data.label}${suffix}`, ref, config: clipboardNode.data.config ? structuredClone(clipboardNode.data.config) : undefined } }
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])
    setNodes(layoutGraph([...nodes, copy], edges))
    setSelectedId(copy.id)
    setDrawerOpen(false)
    setActiveTab('Task')
    setImportMessage(`Pasted ${copy.data.label}.`)
    window.setTimeout(() => flowInstance?.fitView({ padding: 0.18, duration: 260 }), 0)
  }, [clipboardNode, edges, ensureDraftVersion, flowInstance, nodes, role, setActiveTab, setContextMenu, setDrawerOpen, setImportMessage, setNodes, setSelectedId])
  const duplicateNodeShortcut = useCallback((nodeId: string) => {
    const source = nodes.find((node) => node.id === nodeId)
    if (!source || source.type === 'start' || source.type === 'end' || !can(role, 'workflow:edit')) return
    ensureDraftVersion()
    const ref = uniqueReference(source.data.ref, nodes.map((node) => node.data.ref))
    const suffix = ref === source.data.ref ? '_copy' : `_${ref.split('_').at(-1)}`
    const copy: StudioNode = { ...source, id: `${source.id}-copy-${Date.now()}`, position: { x: source.position.x + 55, y: source.position.y + 55 }, selected: false, data: { ...source.data, label: `${source.data.label}${suffix}`, ref, config: source.data.config ? structuredClone(source.data.config) : undefined } }
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])
    const nextEdges = [...edges, edge(`duplicate-${Date.now()}`, source.id, copy.id)]
    setNodes(layoutGraph([...nodes, copy], nextEdges))
    setEdges(nextEdges)
    setSelectedId(copy.id)
    setImportMessage(`Duplicated ${source.data.label}.`)
  }, [edges, ensureDraftVersion, nodes, role, setEdges, setImportMessage, setNodes, setSelectedId])
  const deleteNode = useCallback((nodeId: string) => {
    if (!can(role, 'workflow:edit')) { setImportMessage('Your role is read-only and cannot delete nodes.'); return }
    if (!nodes.some((node) => node.id === nodeId)) return
    ensureDraftVersion()
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])
    setNodes(nodes.filter((node) => node.id !== nodeId))
    setEdges(edges.filter((currentEdge) => currentEdge.source !== nodeId && currentEdge.target !== nodeId))
    setSelectedId((current) => current === nodeId ? null : current)
    setContextMenu((current) => current?.nodeId === nodeId ? null : current)
  }, [edges, ensureDraftVersion, nodes, role, setEdges, setNodes])
  const deleteNestedTask = useCallback((nodeId: string, target: NestedTaskTarget) => {
    if (!can(role, 'workflow:edit')) return
    const container = nodes.find((node) => node.id === nodeId)
    if (!container) return
    const nextNode = removeNestedTask(container, target)
    if (nextNode === container) return
    ensureDraftVersion()
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])
    setNodes(nodes.map((node) => node.id === nodeId ? nextNode : node))
  }, [ensureDraftVersion, nodes, role, setNodes])
  const canvasNodes: StudioNode[] = useMemo(() => nodes.map((node) => ({ ...node, data: { ...node.data, runtimeState: runtimeNodeId === node.id ? 'running' as const : completedNodeIds.includes(node.id) ? 'completed' as const : undefined, onAddConnector: ['studio', 'loop', 'switch', 'join', 'start'].includes(node.type) ? () => openQuickAddFromNode(node.id) : undefined, onAddBranch: node.type === 'switch' || node.data.kind === 'FORK_JOIN' ? (branchName: string) => openQuickAddFromNode(node.id, branchName) : undefined, onAddNested: node.type === 'loop' ? () => openQuickAddFromNode(node.id, 'nested') : undefined, onRemoveNestedTask: ['loop', 'switch', 'studio'].includes(node.type) && ['DO_WHILE', 'SWITCH', 'FORK_JOIN'].includes(node.data.kind) ? (target: NestedTaskTarget) => deleteNestedTask(node.id, target) : undefined, onRemove: ['studio', 'loop', 'switch', 'join'].includes(node.type) ? () => deleteNode(node.id) : undefined } })), [nodes, runtimeNodeId, completedNodeIds, openQuickAddFromNode, deleteNode, deleteNestedTask])
  const recordCurrentSnapshot = useCallback((status: WorkflowVersionSnapshot['status']) => {
    recordVersionSnapshot({ version: workflow.version, workflow, nodes, edges, status, savedAt: new Date().toISOString() })
  }, [edges, nodes, recordVersionSnapshot, workflow])

  useEffect(() => {
    if (!nodes.length) {
      setNodes(initialNodes, false)
      setEdges(initialEdges, false)
    }
  }, [nodes.length, setEdges, setNodes])

  useEffect(() => {
    if (nodes.length && !dirty && versionHistory.length === 0) recordCurrentSnapshot('DRAFT')
  }, [dirty, nodes.length, recordCurrentSnapshot, versionHistory.length])

  useEffect(() => {
    if (activeTab === 'Code') setCodeText(workflowJson)
  }, [activeTab, workflowJson])

  useEffect(() => {
    if (!lastSavedJson && !dirty && nodes.length) setLastSavedJson(workflowJson)
  }, [dirty, lastSavedJson, nodes.length, workflowJson])

  useEffect(() => {
    if (!dirty || !nodes.length) return
    const timer = window.setTimeout(() => { markSaved(); setLastSavedJson(workflowJson); recordCurrentSnapshot('DRAFT') }, 1200)
    return () => window.clearTimeout(timer)
  }, [dirty, nodes.length, markSaved, recordCurrentSnapshot, workflowJson])

  const onConnect = useCallback((connection: Connection) => {
    if (!can(role, 'workflow:edit')) return
    ensureDraftVersion()
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])
    setEdges(addEdge({ ...connection, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#9aa7b5' }, style: { stroke: '#9aa7b5' } }, edges))
  }, [edges, ensureDraftVersion, nodes, role, setEdges])

  const onNodesChange = useCallback((changes: Parameters<typeof applyNodeChanges>[0]) => {
    if (!can(role, 'workflow:edit')) return
    const userChanges = changes.some((change) => change.type !== 'select' && change.type !== 'dimensions')
    if (userChanges) { ensureDraftVersion(); setHistory((current) => [...current, graphSnapshot(nodes, edges)]) }
    setNodes(applyNodeChanges(changes, nodes) as StudioNode[], userChanges)
  }, [ensureDraftVersion, nodes, role, setNodes])

  const onEdgesChange = useCallback((changes: Parameters<typeof applyEdgeChanges>[0]) => {
    if (!can(role, 'workflow:edit')) return
    const userChanges = changes.some((change) => change.type !== 'select')
    if (userChanges) { ensureDraftVersion(); setHistory((current) => [...current, graphSnapshot(nodes, edges)]) }
    setEdges(applyEdgeChanges(changes, edges), userChanges)
  }, [edges, ensureDraftVersion, nodes, role, setEdges])

  const selectNode = useCallback((_: unknown, node: StudioNode) => {
    if (node.type === 'start' || node.type === 'end') return
    setSelectedId(node.id)
    setDrawerOpen(false)
    setActiveTab('Task')
  }, [])

  const addTask = (task: TaskCatalogItem) => {
    if (task.action === 'open-integrations') {
      setQuickAddOpen(false)
      setDrawerOpen(true)
      setActiveTab('Task')
      return
    }
    if (!can(role, 'workflow:edit')) { setImportMessage('Your role is read-only and cannot edit this workflow.'); return }
    ensureDraftVersion()
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])

    const selectedNode = selectedId ? nodes.find((node) => node.id === selectedId) : undefined
    const operationBranch = operationContext?.branchName
    if (selectedNode && ((selectedNode.data.kind === 'DO_WHILE' && operationBranch === 'nested') || (selectedNode.data.kind === 'SWITCH' && operationContext?.port === 'branch') || (selectedNode.data.kind === 'FORK_JOIN' && operationBranch?.startsWith('fork:')))) {
      const existingReferences = nodes.map((node) => node.data.ref)
      const nestedTask = generateNestedTask(task, existingReferences)
      const target = operationBranch ?? ''
      setNodes(nodes.map((node) => node.id === selectedNode.id ? appendNestedTask(node, nestedTask, target) : node))
      setSelectedId(selectedNode.id)
    } else {
      const newNode = generateTaskNode(task, nodes.map((node) => node.data.ref), { x: 195, y: 1010 + nodes.length * 24 })
      const nextEdges = selectedId && nodes.some((node) => node.id === selectedId) ? [...edges, edge(`add-${newNode.id}`, selectedId, newNode.id)] : edges
      setNodes(layoutGraph([...nodes, newNode], nextEdges))
      setEdges(nextEdges)
      setSelectedId(newNode.id)
      window.setTimeout(() => flowInstance?.fitView({ padding: 0.18, duration: 260 }), 0)
    }
    setOperationContext(null)
    setDrawerOpen(false)
    setQuickAddOpen(false)
    setActiveTab('Task')
  }

  const deleteSelected = () => {
    if (!selectedId) return
    deleteNode(selectedId)
  }

  const openWorkflowList = () => { if (dirty && !window.confirm('Discard unsaved workflow changes and return to the workflow list?')) return; window.history.pushState({}, '', '/workflows'); setPage('list') }
  const openBuilder = (entry: BuilderEntry = 'template', workflowName?: string) => {
    if (dirty && !window.confirm('Discard unsaved workflow changes and start another workflow?')) return
    if (entry === 'blank') {
      replaceDraft(structuredClone(blankNodes), { name: workflowName ?? 'new_workflow', description: 'A new workflow definition.', inputSchema: '', outputSchema: '', version: 1 })
      setEdges(structuredClone(blankEdges))
    }
    if (entry === 'template') {
      replaceDraft(structuredClone(initialNodes), { name: workflowName ?? 'api_polling_workflow', description: 'Submits a job to an external API, polls for its status until completed or failed, then routes based on the outcome.', version: 1 })
      setEdges(structuredClone(initialEdges))
    }
    window.history.pushState({}, '', '/'); setPage('builder'); setSelectedId(null); setDrawerOpen(false); setAssistantOpen(entry === 'ai'); setActiveTab('Workflow')
  }

  const openExistingWorkflow = async (name: string) => {
    if (dirty && !window.confirm('Discard unsaved workflow changes and open another workflow?')) return
    const record = await workflowApi.getWorkflowDefinition(name)
    if (!record?.nodes || !record.edges || !record.workflow) { openBuilder('template', name); return }
    replaceDraft(record.nodes, record.workflow)
    setEdges(record.edges)
    window.history.pushState({}, '', '/'); setPage('builder'); setSelectedId(null); setDrawerOpen(false); setAssistantOpen(false); setActiveTab('Workflow')
  }

  const importJsonFromList = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const graph = conductorJsonToGraph(parsed, blankNodes)
      if (graph.errors.length) throw new Error(graph.errors.join(' '))
      replaceDraft(graph.nodes, graph.workflow)
      setEdges(graph.edges)
      setImportMessage(graph.warnings.length ? graph.warnings.join(' ') : 'Workflow JSON imported. Review the graph before saving.')
      window.history.pushState({}, '', '/'); setPage('builder'); setSelectedId(null); setActiveTab('Workflow'); setDrawerOpen(false)
    } catch (error: unknown) {
      setImportMessage(error instanceof Error ? `JSON import failed: ${error.message}` : 'JSON import failed.')
    }
  }

  const deleteWorkflow = () => {
    if (!can(role, 'workflow:edit')) { setImportMessage('Your role cannot delete this workflow.'); return }
    if (!window.confirm(`Delete workflow "${workflow.name}"? This action cannot be undone.`)) return
    void workflowApi.deleteWorkflowDefinition(workflow.name).catch(() => undefined).finally(() => { window.history.pushState({}, '', '/workflows'); setPage('list') })
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setFuture((current) => [...current, graphSnapshot(nodes, edges)])
    setNodes(previous.nodes)
    setEdges(previous.edges)
    setHistory((current) => current.slice(0, -1))
  }

  const redo = () => {
    const next = future.at(-1)
    if (!next) return
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setNodes(next.nodes)
    setEdges(next.edges)
    setFuture((current) => current.slice(0, -1))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault()
        markSaved()
        setLastSavedJson(workflowJson)
        recordCurrentSnapshot('DRAFT')
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1800)
      }
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
      if (modifier && event.key.toLowerCase() === 'c' && selectedId && !isTypingTarget()) {
        event.preventDefault()
        copyNode(selectedId)
      }
      if (modifier && event.key.toLowerCase() === 'v' && !isTypingTarget()) {
        event.preventDefault()
        pasteNode()
      }
      if (modifier && event.key.toLowerCase() === 'd' && selectedId && !isTypingTarget()) {
        event.preventDefault()
        duplicateNodeShortcut(selectedId)
      }
      if (modifier && event.key === '0' && !isTypingTarget()) {
        event.preventDefault()
        flowInstance?.fitView({ padding: 0.18, duration: 260 })
      }
      if (modifier && (event.key.toLowerCase() === 'k' || event.key.toLowerCase() === 'f') && !isTypingTarget()) {
        event.preventDefault()
        setCanvasSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setContextMenu(null)
        setQuickAddOpen(false)
        setCanvasSearchOpen(false)
        setValidationOpen(false)
      }
      if (event.key === 'Delete' && selectedId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') deleteSelected()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [copyNode, deleteSelected, duplicateNodeShortcut, flowInstance, pasteNode, redo, selectedId, undo])

  const updateSelectedNode = (patch: Partial<StudioNode['data']>) => {
    if (!can(role, 'workflow:edit')) { setImportMessage('Your role is read-only and cannot edit task configuration.'); return }
    if (!selectedId) return
    ensureDraftVersion()
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])
    updateNodeData(selectedId, patch)
  }

  const testSelectedTask = async () => {
    if (!selectedNode) return
    const result = await workflowApi.testTask(selectedNode)
    setTestResult(`${result.statusCode} OK · ${selectedNode.data.label} returned a mock response in ${result.durationMs}ms.`)
  }

  const applyJson = () => {
    setCodeError(null)
    try {
      const parsed = JSON.parse(codeText) as unknown
      const graph = conductorJsonToGraph(parsed, nodes)
      if (graph.errors.length) throw new Error(graph.errors.join(' '))
      setHistory((current) => [...current, graphSnapshot(nodes, edges)])
      ensureDraftVersion()
      const nextVersion = currentVersionIsPublished && !dirty ? workflow.version + 1 : graph.workflow.version ?? workflow.version
      replaceDraft(graph.nodes, { ...graph.workflow, version: nextVersion })
      setEdges(graph.edges)
      if (graph.warnings.length) setImportMessage(graph.warnings.join(' '))
      setSaved(false)
    } catch (error: unknown) {
      setCodeError(error instanceof Error ? `JSON was not applied: ${error.message}` : 'JSON was not applied. Check the document syntax.')
      setActiveTab('Code')
    }
  }

  const runWorkflow = () => {
    if (!can(role, 'workflow:execute')) { setImportMessage('Your role does not have workflow:execute permission.'); return }
    if (validation.some((item) => item.severity === 'error')) {
      setActiveTab('Workflow')
      setDrawerOpen(false)
      return
    }
    const taskNodes = nodes.filter((node) => ['studio', 'loop', 'switch'].includes(node.type))
    setRunState('running')
    setExecuteOpen(false)
    setRuntimeError(null)
    setLastExecution(null)
    setLastRealtimeEvent(null)
    setCompletedNodeIds([])
    setExecutionEvents(taskNodes.map((node) => ({ id: node.id, label: node.data.label, status: 'SCHEDULED' })))
   setDrawerOpen(false)
   setActiveTab('Run')
    const parsedExecutionInput = (() => { try { return JSON.parse(executionInput) } catch { return {} } })()
    let metadata: Record<string, string> = {}
    try {
      const parsedMetadata = JSON.parse(executionOptions.metadata)
      if (parsedMetadata && typeof parsedMetadata === 'object' && !Array.isArray(parsedMetadata)) metadata = Object.fromEntries(Object.entries(parsedMetadata).map(([key, value]) => [key, String(value)]))
    } catch { metadata = {} }
    const idempotencyKey = executionOptions.idempotencyKey.trim() || `studio-${workflow.name}-${workflow.version}-${Date.now()}`
    void workflowApi.startExecution({ workflowName: workflow.name, version: workflow.version, idempotencyKey, strategy: workflow.idempotencyStrategy, tasks: taskNodes, executionInput: parsedExecutionInput, correlationId: executionOptions.correlationId.trim() || undefined, priority: Number(executionOptions.priority) || 0, executionName: executionOptions.executionName.trim() || undefined, metadata, onEvent: (event) => {
      const current = taskNodes.find((node) => node.data.ref === event.taskReferenceName)
      if (!current) return
      setExecutionEvents((events) => events.map((item) => item.id === current.id ? { ...item, status: event.status } : item))
      if (event.status === 'IN_PROGRESS') setRuntimeNodeId(current.id)
      if (event.status === 'COMPLETED') {
        setCompletedNodeIds((ids) => ids.includes(current.id) ? ids : [...ids, current.id])
        if (current.id === taskNodes.at(-1)?.id) {
          setRuntimeNodeId(null)
          setRunState('completed')
        }
      }
    }, onRealtimeEvent: (event) => setLastRealtimeEvent(event.type) }).then((record) => { setLastExecution(record) }).catch((error: unknown) => {
      setRunState('idle')
      setRuntimeNodeId(null)
      setRuntimeError(error instanceof Error ? error.message : 'Execution could not be started.')
      setImportMessage(error instanceof Error ? error.message : 'Execution could not be started.')
    })
  }

  const pauseExecution = () => {
    if (!lastExecution) return
    void workflowApi.pauseExecution(lastExecution.executionId).then(() => setRunState('paused')).catch((error: unknown) => setRuntimeError(error instanceof Error ? error.message : 'Execution could not be paused.'))
  }

  const resumeExecution = () => {
    if (!lastExecution) return
    void workflowApi.resumeExecution(lastExecution.executionId).then(() => setRunState('running')).catch((error: unknown) => setRuntimeError(error instanceof Error ? error.message : 'Execution could not be resumed.'))
  }

  const terminateExecution = () => {
    if (!lastExecution) return
    void workflowApi.terminateExecution(lastExecution.executionId).then(() => { setRunState('terminated'); setRuntimeNodeId(null); setImportMessage('Execution terminated.') }).catch((error: unknown) => setRuntimeError(error instanceof Error ? error.message : 'Execution could not be terminated.'))
  }

  const downloadWorkflow = () => {
    const blob = new Blob([workflowJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflow.name}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadSvg = () => {
    const blob = new Blob([buildDiagramSvg(nodes, edges)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflow.name}.svg`
    anchor.click()
    URL.revokeObjectURL(url)
    setDownloadMenu(false)
  }

  const downloadPng = () => {
    const svg = buildDiagramSvg(nodes, edges)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width * 2
      canvas.height = image.height * 2
      const context = canvas.getContext('2d')
      if (!context) return
      context.scale(2, 2)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, image.width, image.height)
      context.drawImage(image, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${workflow.name}.png`
        anchor.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    setDownloadMenu(false)
  }

  const saveWorkflow = () => {
    if (!can(role, 'workflow:edit')) return
    if (validation.some((item) => item.severity === 'error')) {
      setActiveTab('Workflow')
      setDrawerOpen(false)
      setValidationOpen(true)
      return
    }
    void workflowApi.save(workflow, nodes, edges).then((result) => {
      markSaved()
      setLastSavedJson(workflowJson)
      recordCurrentSnapshot('DRAFT')
      setSaved(true)
      setPublishMessage(`Version ${result.version} saved.`)
      window.setTimeout(() => setSaved(false), 1800)
    }).catch((error: unknown) => setPublishMessage(error instanceof Error ? error.message : 'Save failed.'))
  }

  const resetDraft = () => {
    if (dirty && !window.confirm('Discard all unsaved changes?')) return
    const latest = [...versionHistory].sort((left, right) => left.version - right.version || (left.status === 'DRAFT' ? -1 : 1)).at(-1)
    if (latest) restoreVersionSnapshot(latest)
    else { setNodes(initialNodes); setEdges(initialEdges); markSaved() }
    setHistory([])
    setFuture([])
    setSelectedId(null)
    setImportMessage(null)
    setPublishMessage(null)
    setRuntimeError(null)
    setRuntimeNodeId(null)
    setCompletedNodeIds([])
    setExecutionEvents([])
    setRunState('idle')
  }

  const createVersion = () => {
    if (!can(role, 'workflow:edit')) { setPublishMessage('Your role cannot create workflow versions.'); setVersionMenu(false); return }
    if (dirty) recordCurrentSnapshot('DRAFT')
    updateWorkflow({ version: workflow.version + 1 })
    setVersionMenu(false)
  }

  const saveAsNewVersion = () => {
    if (!can(role, 'workflow:edit')) return
    if (dirty) recordCurrentSnapshot('DRAFT')
    updateWorkflow({ version: workflow.version + 1 })
    setSaveMenu(false)
    setPublishMessage(`Draft version ${workflow.version + 1} created.`)
  }

  const publishVersion = () => {
    if (!can(role, 'workflow:publish')) { setPublishMessage('Your role does not have workflow:publish permission.'); setVersionMenu(false); return }
    if (validation.some((item) => item.severity === 'error')) {
      setPublishMessage('Publish blocked: resolve validation errors before publishing.')
    } else {
      markSaved()
      setLastSavedJson(workflowJson)
      recordCurrentSnapshot('PUBLISHED')
      setPublishMessage(`Version ${workflow.version} published and locked.`)
    }
    setVersionMenu(false)
  }

  const downloadBpmn = () => {
    const blob = new Blob([workflowToBpmn(nodes, workflow.name, edges)], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflow.name}.bpmn`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadConductor = (draftNodes: StudioNode[], workflowName: string) => {
    const blob = new Blob([JSON.stringify(toConductorDefinition(draftNodes, workflowName, workflow.version, workflow), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflowName}.conductor.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const autoLayout = () => {
    if (!can(role, 'workflow:edit')) return
    ensureDraftVersion()
    const nextNodes = layoutGraph(nodes, edges)
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])
    setNodes(nextNodes)
    window.setTimeout(() => flowInstance?.fitView({ padding: 0.18, duration: 260 }), 0)
  }

  const duplicateNode = (nodeId: string) => {
    if (!can(role, 'workflow:edit')) return
    const source = nodes.find((node) => node.id === nodeId)
    if (!source || source.type === 'start' || source.type === 'end') return
    ensureDraftVersion()
    const id = `${source.id}-copy-${Date.now()}`
    const copy: StudioNode = { ...source, id, position: { x: source.position.x + 55, y: source.position.y + 55 }, data: { ...source.data, label: `${source.data.label}_copy`, ref: `${source.data.ref}_copy`, config: source.data.config ? { ...source.data.config, cases: source.data.config.cases ? [...source.data.config.cases] : undefined } : undefined } }
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setFuture([])
    setNodes([...nodes, copy])
    setEdges([...edges, edge(`duplicate-${Date.now()}`, source.id, id)])
    setSelectedId(id)
    setDrawerOpen(false)
    setActiveTab('Task')
    setContextMenu(null)
  }

  if (page === 'list') return <WorkflowList onOpen={openBuilder} onOpenWorkflow={openExistingWorkflow} onImportJson={importJsonFromList} />
  if (page !== 'builder') return <div className="platform-shell"><StudioSidebar onOpenWorkflowList={openWorkflowList} onNavigate={navigatePlatform} activePage={page} /><main className="platform-main"><PlatformPage view={page} onNavigate={navigatePlatform} /></main></div>

  const importBpmn = async (file?: File) => {
    if (!file) return
    const review = bpmnToWorkflow(await file.text())
    if (review.errors.length) {
      setImportMessage(review.errors.join(' '))
      return
    }
    setImportReview({ review, name: file.name.replace(/\.bpmn$/i, '') || workflow.name })
  }

  const applyImport = () => {
    if (!can(role, 'workflow:edit')) { setImportMessage('Your role cannot import workflow definitions.'); setImportReview(null); return }
    if (!importReview) return
    const importedEdges = importReview.review.edges.map((item) => edge(item.id, item.source, item.target, item.label ? String(item.label) : undefined))
    ensureDraftVersion()
    setHistory((current) => [...current, graphSnapshot(nodes, edges)])
    setEdges(importedEdges)
    replaceDraft(importReview.review.nodes, { name: importReview.name })
    setImportMessage(importReview.review.warnings.length ? importReview.review.warnings.join(' ') : 'BPMN conversion applied. Review the graph before saving.')
    setImportReview(null)
    setDrawerOpen(false)
    setActiveTab('Workflow')
  }

  const generateAssistantDraft = (prompt: string) => {
    if (!can(role, 'workflow:edit')) { setImportMessage('Your role cannot apply assistant-generated changes.'); setAssistantOpen(false); return }
    const lower = prompt.toLowerCase()
    setAssistantHistory((items) => [prompt, ...items.filter((item) => item !== prompt)].slice(0, 6))
    const task = lower.includes('human') || lower.includes('approval') ? catalogItems.find((item) => item.name === 'Human Task') : lower.includes('http') || lower.includes('api') ? catalogItems.find((item) => item.name === 'HTTP Task') : catalogItems.find((item) => item.name === 'Worker Task (Simple)')
    setAssistantOpen(false)
    if (task) setAssistantReview({ prompt, task })
  }

  const applyAssistantDraft = () => {
    if (!assistantReview) return
    addTask(assistantReview.task)
    setAssistantReview(null)
    setDrawerOpen(false)
    setActiveTab('Workflow')
    setImportMessage('Assistant draft reviewed and applied: ' + assistantReview.task.name + '.')
  }

  const updateWorkflowWithRole = (patch: Partial<WorkflowSettings>) => {
    if (!can(role, 'workflow:edit')) { setImportMessage('Your role is read-only and cannot edit workflow settings.'); return }
    ensureDraftVersion()
    updateWorkflow(patch)
  }

  return (
    <div className="studio-shell">
      <StudioSidebar onOpenWorkflowList={openWorkflowList} onNavigate={navigatePlatform} activePage={page} />
      <div className="studio-main">
      <header className="topbar">
        <div className="breadcrumb"><button onClick={openWorkflowList}>Workflow Definitions</button><ChevronRight size={14} /><strong>{workflow.name}</strong></div>
<div className='top-actions'><label className='role-control'><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as Role)}><option value='admin'>Admin</option><option value='editor'>Editor</option><option value='operator'>Operator</option><option value='viewer'>Viewer</option></select></label>
<div className="version-wrap"><button className="version-control" onClick={() => setVersionMenu((open) => !open)}><span className="globe-icon">⊕</span> Version {workflow.version} <ChevronDown size={14} /></button>{versionMenu && <div className="version-menu"><strong>Workflow versions</strong>{versionHistory.slice().reverse().map((snapshot) => <button className={`version-row ${snapshot.version === workflow.version ? 'active' : ''}`} key={`${snapshot.version}-${snapshot.status}`} onClick={() => { if (dirty && !window.confirm('Discard unsaved workflow changes?')) return; if (snapshot.version !== workflow.version || snapshot.status === 'PUBLISHED') restoreVersionSnapshot(snapshot); setVersionMenu(false) }}><span><span className={`version-dot ${snapshot.status === 'PUBLISHED' ? 'published-dot' : ''}`} /> Version {snapshot.version}</span><small>{snapshot.status === 'PUBLISHED' ? 'Published · immutable' : snapshot.version === workflow.version ? 'Current draft' : 'Saved draft'}</small></button>)}<button className="version-row" onClick={createVersion}><span><Plus size={14} /> Create new version</span><small>Clone current draft</small></button><button className="version-row publish-row" onClick={publishVersion}><span><Check size={14} /> Publish version</span><small>{validation.some((item) => item.severity === 'error') ? 'Blocked by validation' : 'Lock this definition'}</small></button></div>}</div>
<button className="text-action danger" onClick={deleteWorkflow}><Trash2 size={15} /> Delete</button>
<button className="text-action muted" onClick={resetDraft}><RotateCcw size={15} /> Reset</button>
          <div className="download-wrap"><button className="text-action" onClick={() => setDownloadMenu((open) => !open)}><Download size={15} /> Download <ChevronDown size={12} /></button>{downloadMenu && <div className="download-menu"><strong>Export definition</strong><button onClick={() => { downloadWorkflow(); setDownloadMenu(false) }}>Workflow JSON</button><button onClick={() => { downloadBpmn(); setDownloadMenu(false) }}>BPMN XML</button><button onClick={() => { downloadSvg(); setDownloadMenu(false) }}>SVG diagram</button><button onClick={() => { downloadPng(); setDownloadMenu(false) }}>PNG diagram</button><button onClick={() => { downloadConductor(nodes, workflow.name); setDownloadMenu(false) }}>Conductor JSON</button></div>}</div>
          <button className='primary-action' disabled={!can(role, 'workflow:execute')} onClick={() => setExecuteOpen(true)}><Play size={15} fill="currentColor" /> Execute</button>
          <div className="save-wrap"><button className={`save-action ${saved ? 'is-saved' : ''}`} disabled={!can(role, 'workflow:edit')} onClick={saveWorkflow}><Save size={15} /> {saved ? 'Saved' : 'Save'}</button><button className="save-chevron" onClick={() => setSaveMenu((open) => !open)}><ChevronDown size={14} /></button>{saveMenu && <div className="save-menu"><button onClick={() => { saveWorkflow(); setSaveMenu(false) }}>Save draft</button><button onClick={saveAsNewVersion}>Save as new version</button><button onClick={() => { publishVersion(); setSaveMenu(false) }}>Publish</button></div>}</div>
        </div>
      </header>

      <main className="workspace">
        <section className="canvas-area">
          <div className="canvas-toolbar">
            <button title="Home" onClick={() => flowInstance?.fitView({ padding: 0.18, duration: 260 })}><LayoutDashboard size={16} /></button><span className="zoom-value">40%</span><button title="Zoom out" onClick={() => flowInstance?.zoomOut({ duration: 180 })}>−</button><button title="Zoom in" onClick={() => flowInstance?.zoomIn({ duration: 180 })}>+</button><button title="Fit view" onClick={() => flowInstance?.fitView({ padding: 0.18, duration: 260 })}><Maximize2 size={16} /></button><button title="Auto layout" onClick={autoLayout}><ArrowLeftRight size={16} /></button><button title="Print" onClick={() => window.print()}><Copy size={15} /></button><button title="Help" onClick={() => setImportMessage('Tip: drag nodes to reposition them, connect handles to create routes, and use Ctrl/Cmd+K to search the canvas.')}><CircleHelp size={16} /></button><button title="Search" onClick={() => setCanvasSearchOpen((open) => !open)}><Search size={16} /></button>
          </div>
          {canvasSearchOpen && <CanvasSearch nodes={nodes} onClose={() => setCanvasSearchOpen(false)} onSelect={(id) => { setSelectedId(id); setDrawerOpen(false); setActiveTab('Task'); setCanvasSearchOpen(false) }} />}
<div className="canvas-ribbon"><span className={`live-dot ${dirty ? '' : 'saved-dot'}`} /> {dirty ? 'Draft changes' : 'Saved'} <span className="ribbon-sep" /> {nodes.length - 2} tasks <span className="ribbon-sep" /> {edges.length} connections</div>{publishMessage && <div className="publish-toast"><Check size={14} />{publishMessage}<button onClick={() => setPublishMessage(null)}><X size={13} /></button></div>}{runtimeError && <div className="publish-toast runtime-error"><X size={14} /><span>{runtimeError}</span><button onClick={() => setRuntimeError(null)}><X size={13} /></button></div>}
          <ReactFlow nodes={canvasNodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={selectNode} onNodeContextMenu={(event, node) => { event.preventDefault(); setSelectedId(node.id); setDrawerOpen(false); setActiveTab('Task'); setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY }) }} onPaneClick={() => setContextMenu(null)} onInit={setFlowInstance} nodeTypes={nodeTypes} selectionOnDrag selectionKeyCode="Shift" multiSelectionKeyCode="Shift" fitView fitViewOptions={{ padding: 0.18 }} minZoom={0.22} maxZoom={1.5} defaultEdgeOptions={{ type: 'smoothstep' }}>
            <Background variant={BackgroundVariant.Dots} gap={15} size={1.1} color="#d6dee7" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap position="bottom-right" pannable zoomable nodeColor={(node) => node.type === 'start' || node.type === 'end' ? '#d7f1f4' : '#cbdff1'} maskColor="rgba(255,255,255,.68)" />
          </ReactFlow>
          {contextMenu && <NodeContextMenu x={contextMenu.x} y={contextMenu.y} onCopy={() => copyNode(contextMenu.nodeId)} onDuplicate={() => duplicateNode(contextMenu.nodeId)} onTest={() => { void testSelectedTask(); setContextMenu(null) }} onViewJson={() => { setActiveTab('Code'); setContextMenu(null) }} onDelete={deleteSelected} onClose={() => setContextMenu(null)} />}
          <button className="floating-quick-add" onClick={() => setQuickAddOpen((open) => !open)}><Plus size={16} /> Add task</button>
          {quickAddOpen && <PortedQuickAddMenu tasks={catalogItems} onAdd={addTask} onMore={() => { setQuickAddOpen(false); setDrawerOpen(true) }} />}
<AssistantDock open={assistantOpen} onToggle={() => setAssistantOpen((open) => !open)} onGenerate={generateAssistantDraft} history={assistantHistory} />
          {validationOpen && <ValidationDrawer issues={validation} onClose={() => setValidationOpen(false)} onFocus={(nodeId) => { setSelectedId(nodeId); setDrawerOpen(false); setActiveTab('Task') }} />}
          {importReview && <ImportReviewModal review={importReview.review} name={importReview.name} onCancel={() => setImportReview(null)} onApply={applyImport} />}
          {executeOpen && <ExecuteDialogV2 input={executionInput} setInput={setExecutionInput} options={executionOptions} setOptions={(patch) => setExecutionOptions((current) => ({ ...current, ...patch }))} workflow={workflow} validation={validation} onCancel={() => setExecuteOpen(false)} onRun={runWorkflow} />}
          {assistantReview && <AssistantReviewModal review={assistantReview} onCancel={() => setAssistantReview(null)} onApply={applyAssistantDraft} />}
        </section>

        {drawerOpen && <PortedAddTaskDrawer query={query} setQuery={setQuery} tasks={catalogItems} loading={catalogLoading} error={catalogError} onRetry={() => { setCatalogError(null); setCatalogLoading(true); void workflowApi.getTaskCatalog().then((items) => setCatalogItems(items)).catch((error: unknown) => setCatalogError(error instanceof Error ? error.message : 'Task catalog could not be loaded.')).finally(() => setCatalogLoading(false)) }} onClose={() => setDrawerOpen(false)} onAdd={addTask} />}
 {!drawerOpen && <Inspector activeTab={activeTab} setActiveTab={setActiveTab} selectedNode={selectedNode} onDelete={deleteSelected} onOpenTasks={() => setDrawerOpen(true)} onUpdateNode={updateSelectedNode} codeText={codeText} setCodeText={setCodeText} applyJson={applyJson} codeError={codeError} workflow={workflow} updateWorkflow={updateWorkflowWithRole} validation={validation} runState={runState} onRun={runWorkflow} onPause={pauseExecution} onResume={resumeExecution} onTerminate={terminateExecution} onImportBpmn={importBpmn} onExportBpmn={downloadBpmn} onExportConductor={() => downloadConductor(nodes, workflow.name)} lastSavedJson={lastSavedJson} versionHistory={versionHistory} importMessage={importMessage} testResult={testResult} onTest={testSelectedTask} executionEvents={executionEvents} executionInput={executionInput} lastExecution={lastExecution} realtimeEvent={lastRealtimeEvent} nodes={nodes} />}
      </main>

      <footer className={`statusbar ${validation.length ? 'has-validation' : ''}`}><button className="validation-status" onClick={() => setValidationOpen((open) => !open)}><Check size={14} /> <strong>{validation.length ? `${validation.length} validation ${validation.length === 1 ? 'issue' : 'issues'} found.` : '0 warnings found.'}</strong></button><div className="status-actions"><button onClick={undo} disabled={!history.length}><Undo2 size={14} /> Undo</button><button onClick={redo} disabled={!future.length}><Redo2 size={14} /> Redo</button><span>{savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet'}</span></div></footer>
      </div>
    </div>
  )
}

function StudioSidebar({ onOpenWorkflowList, onNavigate, activePage }: { onOpenWorkflowList: () => void; onNavigate: (view: PlatformView) => void; activePage: AppPage }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Executions: true, Definitions: true })
  const sections = [
    { name: 'Executions', icon: Play, items: ['Workflow', 'Agents', 'Human Tasks', 'Scheduler', 'Queue Monitor', 'Workers', 'Event Monitor'] },
    { name: 'Definitions', icon: FileJson, items: ['Workflow', 'Agents', 'Task', 'User Forms', 'Event Handler', 'Scheduler', 'Secrets', 'Webhook', 'AI Prompts', 'Environment Variables', 'Schemas'] },
    { name: 'Integrations', icon: Globe2, items: ['Connections and Resources'] },
    { name: 'Access Control', icon: UsersRound, items: ['Applications', 'Groups', 'Users'] },
    { name: 'APIs', icon: Settings2, items: ['Services', 'Authentication'] },
  ]
  const routeFor = (section: string, item: string): PlatformView | null => { if (section === 'Executions') return ({ Workflow: 'executions', Scheduler: 'schedulers', 'Queue Monitor': 'queue', 'Event Monitor': 'events' } as Record<string, PlatformView>)[item] ?? null; if (section === 'Definitions') return ({ Task: 'task-definitions', 'Event Handler': 'event-handlers', Scheduler: 'schedulers', Schemas: 'schemas' } as Record<string, PlatformView>)[item] ?? null; if (section === 'Integrations') return 'integrations'; if (section === 'Access Control') return 'access'; if (section === 'APIs') return 'api'; return null }
  return <aside className={`studio-sidebar ${collapsed ? 'collapsed' : ''}`}><div className="sidebar-brand"><span className="brand-orb">◈</span>{!collapsed && <strong>orkes</strong>}<button aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button></div>{!collapsed && <button className="sidebar-search"><Search size={15} /><span>Search</span><small>Ctrl&nbsp;K</small></button>}<button className="sidebar-launch"><Sparkles size={15} /><span>{!collapsed && 'Assistant'}</span></button><nav className="sidebar-nav">{sections.map((section) => <div className="sidebar-section" key={section.name}><button className="sidebar-section-toggle" onClick={() => setExpanded((value) => ({ ...value, [section.name]: !value[section.name] }))}><section.icon size={14} /><span>{!collapsed && section.name}</span>{!collapsed && (expanded[section.name] ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}</button>{!collapsed && expanded[section.name] && <div className="sidebar-items">{section.items.map((item) => { const route = routeFor(section.name, item); const active = (section.name === 'Definitions' && item === 'Workflow' && activePage === 'list') || Boolean(route && activePage === route); return <button className={active ? 'active' : ''} key={`${section.name}-${item}`} onClick={() => section.name === 'Definitions' && item === 'Workflow' ? onOpenWorkflowList() : route && onNavigate(route)}>{item}</button> })}</div>}</div>)}</nav>{!collapsed && <div className="sidebar-footer"><div className="sidebar-user"><span>ÖC</span><div><strong>Özgür celik</strong><small>celikonline@gmail.com</small></div></div><small className="sidebar-version">Orkes Platform Version<br />2.59.7 | v1.8.0</small></div>}</aside>
}

function AssistantDock({ open, onToggle, onGenerate, history }: { open: boolean; onToggle: () => void; onGenerate: (prompt: string) => void; history: string[] }) {
  const [prompt, setPrompt] = useState('')
return <div className={`assistant-dock ${open ? 'open' : ''}`}><div className="assistant-bar" onClick={onToggle}><div className="assistant-title"><Sparkles size={16} /><strong>Assistant</strong><span>Workflow copilot</span></div><div className="assistant-bar-actions"><span>Conversations</span>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div></div>{open && <div className="assistant-body"><div className="assistant-message"><Bot size={15} /><span>Describe the workflow you want to build. I’ll prepare a draft for your review.</span></div><div className="assistant-input"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && prompt.trim()) onGenerate(prompt) }} placeholder="e.g. Poll an API and notify Slack when it fails" /><button disabled={!prompt.trim()} onClick={() => onGenerate(prompt)}><Sparkles size={15} /> Generate</button></div><div className="assistant-history">{history.length > 0 && <><span>Recent conversations</span>{history.slice(0, 3).map((item) => <button key={item} onClick={() => setPrompt(item)}>{item}</button>)}</>}</div><div className="assistant-chips"><button onClick={() => setPrompt('Create an HTTP polling workflow')}>HTTP polling</button><button onClick={() => setPrompt('Add a human approval step')}>Human approval</button><button onClick={() => setPrompt('Review workflow errors')}>Review errors</button></div></div>}</div>
}

function AssistantReviewModal({ review, onCancel, onApply }: { review: { prompt: string; task: TaskCatalogItem }; onCancel: () => void; onApply: () => void }) {
  return <div className='modal-backdrop'><section className='assistant-review-modal'><div className='modal-head'><div><span className='eyebrow'>ASSISTANT REVIEW</span><h2>Review generated task</h2><p>Nothing will be changed until you apply this suggestion.</p></div><button onClick={onCancel}><X size={17} /></button></div><div className='assistant-prompt'><span>Prompt</span><strong>{review.prompt}</strong></div><div className='assistant-task-preview'><div className='catalog-icon'><review.task.icon size={19} /></div><div><strong>{review.task.name}</strong><span>{review.task.desc}</span><small>Task type · {review.task.kind}</small></div></div><div className='modal-actions'><button className='outline-button' onClick={onCancel}>Cancel</button><button className='primary-action' onClick={onApply}><Check size={14} /> Apply to draft</button></div></section></div>
}

function WorkflowList({ onOpen, onOpenWorkflow, onImportJson }: { onOpen: (entry?: BuilderEntry) => void; onOpenWorkflow: (name: string) => void; onImportJson: (file?: File) => void }) {
  const [workflows, setWorkflows] = useState<WorkflowDefinitionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [entryMenu, setEntryMenu] = useState(false)
  const [menuName, setMenuName] = useState<string | null>(null)
  const refresh = useCallback(() => { setLoading(true); void workflowApi.listWorkflowDefinitions().then((items) => { setWorkflows(items); setError(null) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Workflow definitions could not be loaded.')).finally(() => setLoading(false)) }, [])
  useEffect(() => { refresh() }, [refresh])
  const visible = workflows.filter((workflow) => `${workflow.name} ${workflow.description} ${workflow.status}`.toLowerCase().includes(query.toLowerCase()))
  const remove = async (name: string) => { if (!window.confirm(`Delete workflow "${name}"? This action cannot be undone.`)) return; await workflowApi.deleteWorkflowDefinition(name); setMenuName(null); refresh() }
  const archive = async (name: string) => { await workflowApi.archiveWorkflowDefinition(name); setMenuName(null); refresh() }
  const clone = async (name: string) => { const requested = window.prompt('New workflow name', `${name}_copy`); const cloneName = requested?.trim(); if (!cloneName) return; try { await workflowApi.cloneWorkflowDefinition(name, cloneName); setMenuName(null); refresh() } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Workflow could not be cloned.') } }
  const selectEntry = (entry: BuilderEntry) => { setEntryMenu(false); onOpen(entry) }
  return <div className="workflow-list-page"><header className="list-topbar"><div className="brand-mark"><span className="brand-orb">◈</span><span>orkes</span></div><div className="list-top-actions"><button><Settings2 size={15} /> Settings</button><div className="builder-entry-wrap"><button className="primary-action" onClick={() => setEntryMenu((open) => !open)}><Plus size={15} /> New workflow <ChevronDown size={13} /></button>{entryMenu && <div className="builder-entry-menu"><strong>Start with</strong><button onClick={() => selectEntry('blank')}><FileJson size={15} /><span><b>Create blank</b><small>Start with an empty graph</small></span></button><button onClick={() => selectEntry('template')}><Workflow size={15} /><span><b>Use template</b><small>Open the API polling example</small></span></button><label><ArrowDownToLine size={15} /><span><b>Import JSON</b><small>Load a Conductor definition</small></span><input type="file" accept=".json,application/json" onChange={(event) => { setEntryMenu(false); onImportJson(event.target.files?.[0]) }} /></label><button onClick={() => selectEntry('ai')}><Sparkles size={15} /><span><b>Generate with AI</b><small>Describe a workflow to the assistant</small></span></button></div>}</div></div></header><main className="workflow-list-main"><div className="list-heading"><div><span className="eyebrow">WORKSPACE / DEFAULT</span><h1>Workflow Definitions</h1><p>Design, validate and operate your orchestration workflows.</p></div><button className="outline-button" onClick={() => setEntryMenu((open) => !open)}><Plus size={15} /> Create workflow</button></div><div className="list-toolbar"><div className="list-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows..." /></div><button className="filter-button">All workflows <ChevronDown size={14} /></button></div>{error && <div className="list-error">{error}</div>}<div className="workflow-table"><div className="table-head"><span>Workflow</span><span>Version</span><span>Status</span><span>Updated</span><span>Tasks</span><span>Actions</span></div>{loading ? <div className="list-empty">Loading workflow definitions…</div> : visible.length === 0 ? <div className="list-empty">No workflow definitions match your search.</div> : visible.map((workflow) => <div className="workflow-row" key={workflow.name} role="button" tabIndex={0} onClick={() => onOpenWorkflow(workflow.name)} onKeyDown={(event) => { if (event.key === 'Enter') onOpenWorkflow(workflow.name) }}><span className="workflow-name"><span className="workflow-list-icon"><Workflow size={16} /></span><span><strong>{workflow.name}</strong><small>{workflow.description}</small></span></span><span>v{workflow.version}</span><span><em className={workflow.status.toLowerCase()}>{workflow.status}</em></span><span>{workflow.updatedAt}</span><span>{workflow.taskCount}</span><span className="workflow-row-actions"><button aria-label={`Actions for ${workflow.name}`} onClick={(event) => { event.stopPropagation(); setMenuName(menuName === workflow.name ? null : workflow.name) }}>⋯</button>{menuName === workflow.name && <span className="row-action-menu" onClick={(event) => event.stopPropagation()}><button onClick={() => onOpenWorkflow(workflow.name)}>Open</button><button onClick={() => clone(workflow.name)}>Duplicate</button><button onClick={() => archive(workflow.name)} disabled={workflow.status === 'ARCHIVED'}>Archive</button><button className="danger-menu-item" onClick={() => void remove(workflow.name)}>Delete</button></span>}</span></div>)}</div></main></div>
}

function ValidationDrawer({ issues, onClose, onFocus }: { issues: Array<{ severity: 'error' | 'warning'; message: string; nodeId?: string }>; onClose: () => void; onFocus: (nodeId: string) => void }) {
  return <div className="validation-drawer"><div className="validation-drawer-head"><div><strong>Validation</strong><span>{issues.length ? `${issues.length} issues require review` : 'No issues found'}</span></div><button onClick={onClose}><X size={15} /></button></div>{issues.length === 0 ? <div className="validation-empty"><Check size={19} /> Workflow is ready to save.</div> : <div className="validation-items">{issues.map((issue, index) => <button key={`${issue.message}-${index}`} onClick={() => issue.nodeId && onFocus(issue.nodeId)}><span className={`validation-badge ${issue.severity}`}>{issue.severity === 'error' ? '!' : 'i'}</span><span>{issue.message}</span>{issue.nodeId && <ChevronRight size={13} />}</button>)}</div>}</div>
}

function CanvasSearch({ nodes, onClose, onSelect }: { nodes: StudioNode[]; onClose: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const matches = nodes.filter((node) => `${node.data.label} ${node.data.ref} ${node.data.kind}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="canvas-search"><div className="canvas-search-input"><Search size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nodes..." /><button onClick={onClose}><X size={14} /></button></div><div className="canvas-search-results">{matches.slice(0, 8).map((node) => <button key={node.id} onClick={() => onSelect(node.id)}><span className="search-node-kind">{node.data.kind}</span><span><strong>{node.data.label}</strong><small>{node.data.ref}</small></span><ChevronRight size={13} /></button>)}{matches.length === 0 && <div className="search-empty">No nodes found.</div>}</div></div>
}

function NodeContextMenu({ x, y, onCopy, onDuplicate, onTest, onViewJson, onDelete, onClose }: { x: number; y: number; onCopy: () => void; onDuplicate: () => void; onTest: () => void; onViewJson: () => void; onDelete: () => void; onClose: () => void }) {
  return <div className="node-context-menu" style={{ left: x, top: y }} onClick={(event) => event.stopPropagation()}><button onClick={onClose}><Settings2 size={14} /> Open inspector</button><button onClick={() => { onCopy(); onClose() }}><Copy size={14} /> Copy node</button><button onClick={() => { onDuplicate(); onClose() }}><Copy size={14} /> Duplicate node</button><button onClick={onTest}><Zap size={14} /> Test task</button><button onClick={onViewJson}><Code2 size={14} /> View JSON</button><button className="danger-menu-item" onClick={() => { onDelete(); onClose() }}><Trash2 size={14} /> Delete node</button></div>
}

function ImportReviewModal({ review, name, onCancel, onApply }: { review: ImportReview; name: string; onCancel: () => void; onApply: () => void }) {
  return <div className="modal-backdrop"><section className="import-review-modal"><div className="modal-head"><div><span className="eyebrow">BPMN CONVERSION REVIEW</span><h2>Review imported workflow</h2><p>{name}.bpmn will be converted to the canonical workflow graph.</p></div><button onClick={onCancel}><X size={17} /></button></div><div className="review-stats"><div><strong>{review.nodes.length}</strong><span>Supported elements</span></div><div><strong>{review.edges.length}</strong><span>Connections</span></div><div><strong>{review.warnings.length}</strong><span>Warnings</span></div><div><strong>{review.errors.length}</strong><span>Errors</span></div></div>{review.errors.length > 0 && <div className="review-message error"><strong>Conversion blocked</strong><span>{review.errors.join(' ')}</span></div>}{review.warnings.length > 0 && <div className="review-message warning"><strong>Review required</strong><span>{review.warnings.join(' ')}</span></div>}<div className="review-mapping"><span>Mapping preview</span><div><code>startEvent</code><ChevronRight size={13} /><code>Start</code></div><div><code>serviceTask / userTask</code><ChevronRight size={13} /><code>Task / HTTP or Human</code></div><div><code>exclusiveGateway</code><ChevronRight size={13} /><code>Switch + labeled routes</code></div><div><code>sequenceFlow</code><ChevronRight size={13} /><code>{review.edges.length} graph connections</code></div></div><div className="modal-actions"><button className="outline-button" onClick={onCancel}>Cancel</button><button className="primary-action" disabled={review.errors.length > 0} onClick={onApply}><Check size={14} /> Apply conversion</button></div></section></div>
}

function Inspector({ activeTab, setActiveTab, selectedNode, onDelete, onOpenTasks, onUpdateNode, codeText, setCodeText, applyJson, codeError, workflow, updateWorkflow, validation, runState, onRun, onPause, onResume, onTerminate, onImportBpmn, onExportBpmn, onExportConductor, lastSavedJson, versionHistory, importMessage, testResult, onTest, executionEvents, executionInput, lastExecution, realtimeEvent, nodes }: { activeTab: string; setActiveTab: (v: string) => void; selectedNode?: StudioNode; onDelete: () => void; onOpenTasks: () => void; onUpdateNode: (patch: Partial<StudioNode['data']>) => void; codeText: string; setCodeText: (v: string) => void; applyJson: () => void; codeError: string | null; workflow: WorkflowSettings; updateWorkflow: (patch: Partial<WorkflowSettings>) => void; validation: Array<{ severity: 'error' | 'warning'; message: string; nodeId?: string }>; runState: RunState; onRun: () => void; onPause: () => void; onResume: () => void; onTerminate: () => void; onImportBpmn: (file?: File) => void; onExportBpmn: () => void; onExportConductor: () => void; lastSavedJson: string; versionHistory: WorkflowVersionSnapshot[]; importMessage: string | null; testResult: string | null; onTest: () => void; executionEvents: Array<{ id: string; label: string; status: TaskExecutionStatus }>; executionInput: string; lastExecution: ExecutionRecord | null; realtimeEvent: RealtimeExecutionEvent['type'] | null; nodes: StudioNode[] }) {
  const tabs = [['Workflow', Workflow], ['Task', Zap], ['Code', Code2], ['Run', Play], ['Dependencies', Layers3]] as const
  return <aside className="right-panel inspector"><div className="inspector-tabs">{tabs.map(([label, Icon]) => <button key={label} className={activeTab === label ? 'active' : ''} onClick={() => setActiveTab(label)}><Icon size={15} />{label}</button>)}</div>{activeTab === 'Task' && selectedNode ? <TaskEditor node={selectedNode} validation={validation} onDelete={onDelete} onOpenTasks={onOpenTasks} onUpdate={onUpdateNode} onTest={onTest} testResult={testResult} /> : <PanelContent tab={activeTab} onOpenTasks={onOpenTasks} codeText={codeText} setCodeText={setCodeText} applyJson={applyJson} codeError={codeError} workflow={workflow} updateWorkflow={updateWorkflow} validation={validation} runState={runState} onRun={onRun} onPause={onPause} onResume={onResume} onTerminate={onTerminate} onImportBpmn={onImportBpmn} onExportBpmn={onExportBpmn} onExportConductor={onExportConductor} lastSavedJson={lastSavedJson} versionHistory={versionHistory} importMessage={importMessage} executionEvents={executionEvents} executionInput={executionInput} lastExecution={lastExecution} realtimeEvent={realtimeEvent} nodes={nodes} />}</aside>
}

const expressionSuggestions = ['${workflow.input.jobId}', '${workflow.output.finalStatus}', '${workflow.variables.status}', '${workflow.status}', '${workflow.id}', '${task_ref.input.request}', '${task_ref.output.response.body.status}', '${previous_ref.output.result}', '${workflow.secrets.HTTP_API_TOKEN}', '${workflow.env.API_BASE_URL}']
function ExpressionInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return <><input list="expression-suggestions" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /><datalist id="expression-suggestions">{expressionSuggestions.map((suggestion) => <option value={suggestion} key={suggestion} />)}</datalist></>
}

function TaskEditor({ node, validation, onDelete, onOpenTasks, onUpdate, onTest, testResult }: { node: StudioNode; validation: Array<{ severity: 'error' | 'warning'; message: string; nodeId?: string }>; onDelete: () => void; onOpenTasks: () => void; onUpdate: (patch: Partial<StudioNode['data']>) => void; onTest: () => void; testResult: string | null }) {
  const config = node.data.kind === 'HTTP_POLL'
    ? { ...(node.data.config ?? {}), pollIntervalSeconds: node.data.config?.pollIntervalSeconds ?? 30 }
    : node.data.config ?? {}
  const isSwitch = node.type === 'switch' || node.data.kind === 'SWITCH'
  const isLoop = node.type === 'loop' || node.data.kind === 'DO_WHILE'
  const formDefinition = getTaskFormDefinition(node.data.kind)
  const updateConfig = (patch: Partial<TaskConfig>) => onUpdate({ config: { ...config, ...patch } })
  return <div className={'task-inspector ' + (isSwitch ? 'switch-editor' : '')}><div className='editor-head'><div><span className='eyebrow'>{isLoop ? 'DO_WHILE SETTINGS' : isSwitch ? 'SWITCH' : `${formDefinition.group.toUpperCase()} SETTINGS`}</span><h2>{node.data.label}</h2></div><button className='danger-icon' onClick={onDelete}><Trash2 size={16} /></button></div>{formDefinition.docs && <a className='task-doc-link' href={formDefinition.docs} target='_blank' rel='noreferrer'>Open {formDefinition.label} docs ↗</a>}{validation.filter((issue) => issue.nodeId === node.id).map((issue, index) => <div className={`inline-validation ${issue.severity}`} key={`${issue.message}-${index}`}><span>{issue.severity === 'error' ? '!' : 'i'}</span>{issue.message}</div>)}<label>Task definition</label><input value={node.data.label} onChange={(event) => onUpdate({ label: event.target.value })} /><label>Reference name</label><input value={node.data.ref} onChange={(event) => onUpdate({ ref: event.target.value })} />{isLoop ? <LoopFields config={config} optional={node.data.optional ?? false} updateConfig={updateConfig} updateData={onUpdate} /> : <><label>Task type</label><div className='form-select'>{node.data.kind}<ChevronDown size={14} /></div>{isSwitch ? <><label>Decision expression</label><ExpressionInput value={config.expression ?? ''} placeholder='$.task_ref.output.response.status' onChange={(value) => updateConfig({ expression: value })} /><label>Decision cases</label><textarea value={config.cases?.join('\\n') ?? ''} placeholder='One case per line' onChange={(event) => { const cases = event.target.value.split('\\n').filter(Boolean); const previous = config.decisionCases ?? {}; const decisionCases = Object.fromEntries(cases.map((branch) => [branch, previous[branch] ?? []])); updateConfig({ cases, decisionCases, defaultCase: decisionCases.defaultCase ?? [] }) }} /></> : node.data.kind === 'HTTP' || node.data.kind === 'HTTP_POLL' ? <HttpFields config={config} updateConfig={updateConfig} /> : <><TaskSpecificFields kind={node.data.kind} config={config} optional={node.data.optional ?? false} updateConfig={updateConfig} updateData={onUpdate} /><label>Input parameters</label><textarea value={config.inputParameters ?? ''} placeholder='JSON input mapping' onChange={(event) => updateConfig({ inputParameters: event.target.value })} /></>}</>} {!isLoop && node.data.kind !== 'SIMPLE' && <label className='form-toggle'><input type='checkbox' checked={node.data.optional ?? false} onChange={(event) => onUpdate({ optional: event.target.checked })} /><span>Make Task Optional <small>The workflow continues unaffected by the task outcome.</small></span></label>}<div className='editor-section'><span>{isLoop ? 'Task options' : 'Retry and timeout'}</span><ChevronDown size={15} /></div>{!isSwitch && !isLoop && <TaskPolicyFields config={config} updateConfig={updateConfig} />}<div className='task-editor-actions'><button className='outline-button' onClick={onTest}><Zap size={14} /> Test Task</button><button className='outline-button' onClick={onOpenTasks}><Plus size={15} /> Add another task</button></div>{testResult && <div className='test-result'><Check size={14} />{testResult}</div>}<TaskInspectorDetails node={node} /></div>
}

function TaskInspectorDetails({ node }: { node: StudioNode }) {
  const [tab, setTab] = useState<'Summary' | 'Input' | 'Output' | 'Log' | 'JSON' | 'Definition'>('Summary')
  const config = node.data.config ?? {}
  const definition = { name: node.data.label, taskReferenceName: node.data.ref, type: node.data.kind, optional: node.data.optional ?? false, config }
  const content = tab === 'Summary' ? <div className="task-detail-summary"><span><strong>Task Type</strong>{node.data.kind}</span><span><strong>Status</strong>READY</span><span><strong>Retry Count</strong>{config.retryCount ?? 0}</span><span><strong>Timeout</strong>{config.timeoutSeconds ? `${config.timeoutSeconds}s` : 'Not set'}</span></div> : tab === 'Input' ? <pre>{config.inputParameters || JSON.stringify({}, null, 2)}</pre> : tab === 'Output' ? <pre>{JSON.stringify({ status: 'not_started' }, null, 2)}</pre> : tab === 'Log' ? <div className="task-detail-empty">No task logs are available until this task is executed.</div> : tab === 'JSON' ? <pre>{JSON.stringify(definition, null, 2)}</pre> : <pre>{JSON.stringify(config, null, 2)}</pre>
  return <div className="task-inspector-details"><div className="task-detail-tabs">{(['Summary', 'Input', 'Output', 'Log', 'JSON', 'Definition'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div><div className="task-detail-content">{content}</div></div>
}

function LoopFields({ config, optional, updateConfig, updateData }: { config: NonNullable<StudioNode['data']['config']>; optional: boolean; updateConfig: (patch: Partial<TaskConfig>) => void; updateData: (patch: Partial<StudioNode['data']>) => void }) {
  const parameters = config.loopParameters ?? []
  const updateParameter = (index: number, patch: Partial<{ name: string; value: string }>) => updateConfig({ loopParameters: parameters.map((parameter, parameterIndex) => parameterIndex === index ? { ...parameter, ...patch } : parameter) })
  return <div className='loop-settings'><div className='loop-params-head'><strong>Script Parameters</strong><button className='inline-add-button' onClick={() => updateConfig({ loopParameters: [...parameters, { name: '', value: '' }] })}><Plus size={13} /> Add parameter</button></div>{parameters.map((parameter, index) => <div className='loop-parameter-row' key={`${index}-${parameter.name}`}><input value={parameter.name} placeholder='Parameter name' onChange={(event) => updateParameter(index, { name: event.target.value })} /><input value={parameter.value} placeholder='Parameter value' onChange={(event) => updateParameter(index, { value: event.target.value })} /><button aria-label={`Remove parameter ${index + 1}`} onClick={() => updateConfig({ loopParameters: parameters.filter((_, parameterIndex) => parameterIndex !== index) })}>×</button></div>)}<div className='loop-condition-label'>Loop condition:</div><div className='radio-row'><label><input type='radio' name='loop-condition-type' checked={(config.loopConditionType ?? 'ECMASCRIPT') === 'ECMASCRIPT'} onChange={() => updateConfig({ loopConditionType: 'ECMASCRIPT' })} /> ECMASCRIPT</label><label><input type='radio' name='loop-condition-type' checked={config.loopConditionType === 'VALUE_PARAM'} onChange={() => updateConfig({ loopConditionType: 'VALUE_PARAM' })} /> Value-Param</label></div><label>Code</label><textarea className='loop-code' value={config.loopCondition ?? ''} placeholder='if ($.check_status_ref.output.response.body.status !== "COMPLETED") return true;' onChange={(event) => updateConfig({ loopCondition: event.target.value })} /><label>No. of iterations to keep (if enabled, min value is 2):</label><input type='number' min='2' disabled={config.loopNoLimits ?? true} value={config.loopIterations ?? 2} onChange={(event) => updateConfig({ loopIterations: Math.max(2, Number(event.target.value)) })} /><label className='form-toggle'><input type='checkbox' checked={config.loopNoLimits ?? true} onChange={(event) => updateConfig({ loopNoLimits: event.target.checked })} /><span>No Limits</span></label><label className='form-toggle'><input type='checkbox' checked={optional} onChange={(event) => updateData({ optional: event.target.checked })} /><span>Make Task Optional <small>The workflow continues unaffected by the task's outcome, whether it fails or remains incomplete.</small></span></label></div>
}

function TaskSpecificFields({ kind, config, optional, updateConfig, updateData }: { kind: TaskKind; config: NonNullable<StudioNode['data']['config']>; optional: boolean; updateConfig: (patch: Partial<TaskConfig>) => void; updateData: (patch: Partial<StudioNode['data']>) => void }) {
  return <PortedTaskFormFields kind={kind} config={config} optional={optional} updateConfig={updateConfig} updateData={updateData} />
  /* Legacy inline form branches are kept below temporarily as a migration reference. */
  if (kind === 'SIMPLE') {
    const cacheEnabled = Boolean(config.cacheTtlInSecond || config.cacheKey)
    return <><label>Worker task definition</label><input value={config.workerTaskName ?? ''} placeholder='sayHello' onChange={(event) => updateConfig({ workerTaskName: event.target.value })} /><div className='form-toggle'><input type='checkbox' checked={optional} onChange={(event) => updateData({ optional: event.target.checked })} /><span>Optional task</span></div><div className='worker-section'><div className='worker-section-title'><strong>Worker task options</strong><span>Task parameters from the Worker Task reference</span></div><div className='form-toggle'><input type='checkbox' checked={cacheEnabled} onChange={(event) => updateConfig(event.target.checked ? { cacheTtlInSecond: 300, cacheKey: '${workflow.input.jobId}' } : { cacheTtlInSecond: undefined, cacheKey: undefined })} /><span>Cache task output</span></div>{cacheEnabled && <div className='compact-fields'><div><label>TTL (seconds)</label><input type='number' min='1' value={config.cacheTtlInSecond ?? 300} onChange={(event) => updateConfig({ cacheTtlInSecond: Number(event.target.value) })} /></div><div><label>Input-based cache key</label><input value={config.cacheKey ?? ''} placeholder='${workflow.input.jobId}' onChange={(event) => updateConfig({ cacheKey: event.target.value })} /></div></div>}<div className='form-toggle'><input type='checkbox' checked={config.enforceSchema ?? false} onChange={(event) => updateConfig({ enforceSchema: event.target.checked })} /><span>Enforce input/output schema</span></div>{config.enforceSchema && <div className='compact-fields'><div><label>Input schema</label><input value={config.inputSchema ?? ''} placeholder='worker_input_v1' onChange={(event) => updateConfig({ inputSchema: event.target.value })} /></div><div><label>Output schema</label><input value={config.outputSchema ?? ''} placeholder='worker_output_v1' onChange={(event) => updateConfig({ outputSchema: event.target.value })} /></div></div>}</div></>
  }
  if (kind === 'EVENT') return <><label>Event name</label><input value={config.eventName ?? ''} placeholder='workflow.events.job.completed' onChange={(event) => updateConfig({ eventName: event.target.value })} /><label>Event payload</label><textarea value={config.eventPayload ?? ''} placeholder='JSON event payload' onChange={(event) => updateConfig({ eventPayload: event.target.value })} /></>
  if (kind === 'GRPC') return <><label>Service method</label><input value={config.serviceMethod ?? ''} placeholder='package.Service/Method' onChange={(event) => updateConfig({ serviceMethod: event.target.value })} /></>
  if (kind === 'INLINE') return <><label>JavaScript code</label><textarea value={config.script ?? ''} placeholder='return { transformed: $.value };' onChange={(event) => updateConfig({ script: event.target.value })} /></>
  if (kind === 'JSON_JQ_TRANSFORM') return <><label>JQ query</label><textarea value={config.jqQuery ?? ''} placeholder='.payload | { id: .id }' onChange={(event) => updateConfig({ jqQuery: event.target.value })} /></>
  if (kind === 'BUSINESS_RULE') return <><label>Rule name</label><input value={config.ruleName ?? ''} placeholder='order_eligibility' onChange={(event) => updateConfig({ ruleName: event.target.value })} /></>
  if (kind === 'SQL') return <><label>SQL query</label><textarea value={config.sqlQuery ?? ''} placeholder='SELECT * FROM jobs WHERE id = :jobId' onChange={(event) => updateConfig({ sqlQuery: event.target.value })} /></>
  if (kind === 'HUMAN') return <><label>Assignee</label><input value={config.assignee ?? ''} placeholder='team:operations' onChange={(event) => updateConfig({ assignee: event.target.value })} /><label>Form key</label><input value={config.formKey ?? ''} placeholder='approval_form' onChange={(event) => updateConfig({ formKey: event.target.value })} /></>
  if (kind === 'FORK_JOIN') return <><label>Fork tasks</label><textarea value={config.forkTasks ?? ''} placeholder='JSON array of task branches' onChange={(event) => updateConfig({ forkTasks: event.target.value })} /><span className='field-hint'>Each branch is an array of task definitions.</span></>
  if (kind === 'FORK_JOIN_DYNAMIC') return <><label>Dynamic tasks parameter</label><input value={config.dynamicForkTasksParam ?? ''} placeholder='dynamicTasks' onChange={(event) => updateConfig({ dynamicForkTasksParam: event.target.value })} /><label>Dynamic inputs parameter</label><input value={config.dynamicForkTasksInputParamName ?? ''} placeholder='dynamicTasksInput' onChange={(event) => updateConfig({ dynamicForkTasksInputParamName: event.target.value })} /></>
  if (kind === 'JOIN' || kind === 'EXCLUSIVE_JOIN') return <><label>Join on references</label><textarea value={config.joinOn?.join('\n') ?? ''} placeholder='task_ref_1\ntask_ref_2' onChange={(event) => updateConfig({ joinOn: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} /><span className='field-hint'>Leave empty for dynamic joins.</span></>
  if (kind === 'DYNAMIC') return <><label>Dynamic task name parameter</label><input value={config.dynamicTaskNameParam ?? ''} placeholder='taskToExecute' onChange={(event) => updateConfig({ dynamicTaskNameParam: event.target.value })} /></>
  if (kind === 'SUB_WORKFLOW') return <><label>Workflow name</label><input value={config.subWorkflowName ?? ''} placeholder='child_workflow' onChange={(event) => updateConfig({ subWorkflowName: event.target.value })} /><label>Workflow version (optional)</label><input type='number' min='1' value={config.subWorkflowVersion ?? ''} onChange={(event) => updateConfig({ subWorkflowVersion: event.target.value ? Number(event.target.value) : undefined })} /></>
  if (kind === 'START_WORKFLOW') return <><label>Workflow name</label><input value={config.startWorkflowName ?? ''} placeholder='child_workflow' onChange={(event) => updateConfig({ startWorkflowName: event.target.value })} /><label>Workflow version (optional)</label><input type='number' min='1' value={config.startWorkflowVersion ?? ''} onChange={(event) => updateConfig({ startWorkflowVersion: event.target.value ? Number(event.target.value) : undefined })} /></>
  if (kind === 'TERMINATE' || kind === 'TERMINATE_WORKFLOW') return <><label>Termination reason</label><textarea value={config.terminationReason ?? ''} placeholder='Stopped by workflow policy' onChange={(event) => updateConfig({ terminationReason: event.target.value })} /></>
  if (kind === 'YIELD') return <><label>Yield message</label><textarea value={config.yieldMessage ?? ''} placeholder='Continue asynchronously after callback' onChange={(event) => updateConfig({ yieldMessage: event.target.value })} /></>
  if (kind === 'SET_VARIABLE') return <><label>Variable name</label><input value={config.variableName ?? ''} placeholder='status' onChange={(event) => updateConfig({ variableName: event.target.value })} /><label>Variable value</label><ExpressionInput value={config.variableValue ?? ''} placeholder='${workflow.input.status}' onChange={(value) => updateConfig({ variableValue: value })} /></>
  if (kind === 'GET_WORKFLOW') return <><label>Workflow execution ID</label><ExpressionInput value={config.workflowId ?? ''} placeholder='${workflow.input.workflowId}' onChange={(value) => updateConfig({ workflowId: value })} /></>
  if (kind === 'AI_CHAT_COMPLETION' || kind === 'AI_GENERATE_IMAGE') return <><label>Model</label><input value={config.model ?? ''} placeholder='gpt-4.1-mini' onChange={(event) => updateConfig({ model: event.target.value })} /><label>Prompt</label><textarea value={config.prompt ?? ''} placeholder='Describe the desired output' onChange={(event) => updateConfig({ prompt: event.target.value })} /></>
  if (kind === 'WAIT') return <><label>Wait duration (sec)</label><input type='number' value={config.durationSeconds ?? 30} onChange={(event) => updateConfig({ durationSeconds: Number(event.target.value) })} /></>
  return null
}

function HttpFields({ config, updateConfig }: { config: NonNullable<StudioNode['data']['config']>; updateConfig: (patch: Partial<NonNullable<StudioNode['data']['config']>>) => void }) {
  return <><label>HTTP method</label><select className="native-select" value={config.method ?? 'GET'} onChange={(event) => updateConfig({ method: event.target.value })}>{['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'].map((method) => <option key={method}>{method}</option>)}</select><label>Request URL</label><ExpressionInput value={config.url ?? ''} placeholder="https://api.example.com/status" onChange={(value) => updateConfig({ url: value })} /><div className="compact-fields"><div><label>Accept</label><input value={config.accept ?? ''} placeholder="application/json" onChange={(event) => updateConfig({ accept: event.target.value })} /></div><div><label>Content type</label><input value={config.contentType ?? ''} placeholder="application/json" onChange={(event) => updateConfig({ contentType: event.target.value })} /></div></div><label>Headers</label><textarea value={config.headers ?? ''} placeholder={'{\n  "content-type": "application/json"\n}'} onChange={(event) => updateConfig({ headers: event.target.value })} /><label>Request body</label><textarea value={config.body ?? ''} placeholder="Optional JSON body" onChange={(event) => updateConfig({ body: event.target.value })} /><label className="form-toggle"><input type="checkbox" checked={config.encode ?? false} onChange={(event) => updateConfig({ encode: event.target.checked })} /><span>URL encode request values</span></label><InputNumber label="Hedging max attempts" value={config.httpHedgingMaxAttempts ?? 0} onChange={(value) => updateConfig({ httpHedgingMaxAttempts: value ? Math.max(1, Number(value)) : undefined })} /><label>Input parameters</label><textarea value={config.inputParameters ?? ''} placeholder={'{\n  "id": "${workflow.input.id}"\n}'} onChange={(event) => updateConfig({ inputParameters: event.target.value })} /></>
}

function InputNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <><label>{label}</label><input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} /></>
}

function RunPanel({ runState, workflow, executionEvents, executionInput, lastExecution, realtimeEvent, onRun, onPause, onResume, onTerminate }: { runState: RunState; workflow: { version: number; name: string }; executionEvents: Array<{ id: string; label: string; status: TaskExecutionStatus }>; executionInput: string; lastExecution: ExecutionRecord | null; realtimeEvent: RealtimeExecutionEvent['type'] | null; onRun: () => void; onPause: () => void; onResume: () => void; onTerminate: () => void }) {
  const [view, setView] = useState<'Summary' | 'Task List' | 'Timeline' | 'Input' | 'Output' | 'JSON'>('Summary')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const completed = executionEvents.filter((event) => event.status === 'COMPLETED').length
  const taskCount = lastExecution?.events.length || executionEvents.length || 9
  const tabs = ['Summary', 'Task List', 'Timeline', 'Input', 'Output', 'JSON'] as const
  const parsedInput = (() => { try { return JSON.parse(executionInput) } catch { return {} } })()
  const output = lastExecution ? { status: lastExecution.status.toLowerCase(), tasksCompleted: lastExecution.events.filter((event) => event.status === 'COMPLETED').length, reasonForIncompletion: null } : { status: 'not_started' }
  const selectedEvent = executionEvents.find((event) => event.id === selectedEventId)
  return <div className="run-panel"><div className="run-header"><div className={`run-icon ${runState}`}><Play size={20} fill="currentColor" /></div><div><h2>{runState === 'running' ? 'Workflow is running' : runState === 'paused' ? 'Workflow is paused' : runState === 'completed' ? 'Execution completed' : runState === 'terminated' ? 'Execution terminated' : 'Run workflow'}</h2><span className="run-subtitle">{workflow.name} · version {workflow.version}</span>{realtimeEvent && <small className="realtime-indicator">Realtime · {realtimeEvent}</small>}</div></div><div className="run-view-tabs">{tabs.map((tab) => <button key={tab} className={view === tab ? 'active' : ''} onClick={() => setView(tab)}>{tab}</button>)}</div>{view === 'Summary' && <><p>{runState === 'completed' ? 'The mock execution completed successfully. Review task timing and output below.' : runState === 'paused' ? 'Execution is paused. Resume it to continue processing scheduled tasks.' : runState === 'terminated' ? 'Execution was terminated by an operator.' : 'Execute the current draft with test input and inspect every task on the canvas.'}</p><div className="run-summary"><div><span>Status</span><strong className={runState}>{runState === 'idle' ? 'READY' : runState.toUpperCase()}</strong></div><div><span>Version</span><strong>{workflow.version}</strong></div><div><span>Tasks</span><strong>{taskCount}</strong></div></div><div className="summary-grid"><div><span>Execution ID</span><strong>{lastExecution?.executionId ?? '—'}</strong></div><div><span>Started by</span><strong>Workflow Studio</strong></div><div><span>Duration</span><strong>{runState === 'completed' ? '2.34s' : '—'}</strong></div><div><span>Worker ID</span><strong>studio-mock-worker</strong></div></div></>}{view === 'Task List' && <div className="execution-timeline task-list-view">{executionEvents.map((event) => <button className={`timeline-row ${event.status.toLowerCase()} ${selectedEventId === event.id ? 'selected' : ''}`} key={event.id} onClick={() => setSelectedEventId(event.id)}><span className="timeline-dot" /><span>{event.label}</span><small>{event.status}</small><ChevronRight size={13} /></button>)}{selectedEvent && <ExecutionTaskDetails event={selectedEvent} />}</div>}{view === 'Timeline' && <div className="execution-timeline"><div className="timeline-title"><span>Execution timeline</span><small>{completed}/{taskCount} completed</small></div>{(executionEvents.length ? executionEvents : [{ id: 'empty', label: 'Run the workflow to populate the timeline', status: 'SCHEDULED' as const }]).map((event) => <div className={`timeline-row ${event.status.toLowerCase()}`} key={event.id}><span className="timeline-dot" /><span>{event.label}</span><small>{event.status}</small></div>)}</div>}{view === 'Input' && <CodeBlock value={JSON.stringify(lastExecution?.input ?? parsedInput, null, 2)} />}{view === 'Output' && <CodeBlock value={JSON.stringify(output, null, 2)} />}{view === 'JSON' && <CodeBlock value={JSON.stringify({ executionId: lastExecution?.executionId ?? null, status: lastExecution?.status ?? (runState === 'idle' ? 'READY' : runState.toUpperCase()), workflowVersion: workflow.version, events: lastExecution?.events ?? [] }, null, 2)} />}{view !== 'Task List' && <div className="run-actions">{runState === 'running' && <button className="outline-button" onClick={onPause}>Pause</button>}{runState === 'paused' && <button className="outline-button" onClick={onResume}>Resume</button>}{(runState === 'running' || runState === 'paused') && <button className="danger-outline-button" onClick={onTerminate}>Terminate</button>}<button className="primary-action" disabled={runState === 'running' || runState === 'paused'} onClick={onRun}><Play size={15} fill="currentColor" /> {runState === 'running' ? 'Executing…' : 'Execute draft'}</button></div>}</div>
}

function ExecutionTaskDetails({ event }: { event: { label: string; status: TaskExecutionStatus } }) {
  return <div className="execution-task-details"><div className="task-detail-tabs"><button className="active">Summary</button><button>Input</button><button>Output</button><button>Logs</button><button>Definition</button></div><div className="task-detail-summary"><span><strong>Status</strong>{event.status}</span><span><strong>Task</strong>{event.label}</span><span><strong>Worker ID</strong>{event.status === 'IN_PROGRESS' || event.status === 'COMPLETED' ? 'studio-mock-worker' : '—'}</span><span><strong>Retry attempts</strong>0</span></div></div>
}

function CodeBlock({ value }: { value: string }) { return <pre className="inline-code-block">{value}</pre> }

function DiffViewer({ baseline, current }: { baseline: string; current: string }) {
  if (!baseline) return <div className="diff-empty"><strong>No saved baseline yet.</strong><span>Save the workflow once to compare future draft changes.</span></div>
  const oldLines = baseline.split('\n')
  const newLines = current.split('\n')
  const rows = newLines.map((line, index) => ({ line, number: index + 1, changed: oldLines[index] !== line }))
  const removed = oldLines.slice(newLines.length)
  return <div className="diff-viewer">{rows.map((row) => <div className={row.changed ? 'diff-line added' : 'diff-line'} key={`new-${row.number}`}><span>{row.changed ? '+' : ' '}</span><small>{row.number}</small><code>{row.line || ' '}</code></div>)}{removed.map((line, index) => <div className="diff-line removed" key={`removed-${index}`}><span>-</span><small>{newLines.length + index + 1}</small><code>{line || ' '}</code></div>)}</div>
}

function _ExecuteDialog({ input, setInput, workflow, validation, onCancel, onRun }: { input: string; setInput: (value: string) => void; workflow: WorkflowSettings; validation: Array<{ severity: 'error' | 'warning'; message: string }>; onCancel: () => void; onRun: () => void }) {
  let inputError = ''
  try { JSON.parse(input) } catch { inputError = 'Execution input must be valid JSON.' }
  const blocked = Boolean(inputError) || validation.some((item) => item.severity === 'error')
  return <div className="modal-backdrop"><section className="execute-modal"><div className="modal-head"><div><span className="eyebrow">EXECUTION</span><h2>Execute workflow</h2><p>Run version {workflow.version} with a controlled test input.</p></div><button onClick={onCancel}><X size={17} /></button></div><div className="execute-meta"><span><strong>Workflow</strong>{workflow.name}</span><span><strong>Strategy</strong>{workflow.idempotencyStrategy}</span><span><strong>Timeout</strong>{workflow.timeoutSeconds}s</span></div><label>Input JSON</label><textarea className="execute-input" value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />{inputError && <div className="execute-error">{inputError}</div>}{validation.some((item) => item.severity === 'error') && <div className="execute-error">Resolve validation errors before starting this execution.</div>}<div className="modal-actions"><button className="outline-button" onClick={onCancel}>Cancel</button><button className="primary-action" disabled={blocked} onClick={onRun}><Play size={14} fill="currentColor" /> Start execution</button></div></section></div>
}

function ExecuteDialogV2({ input, setInput, options, setOptions, workflow, validation, onCancel, onRun }: { input: string; setInput: (value: string) => void; options: ExecutionOptions; setOptions: (patch: Partial<ExecutionOptions>) => void; workflow: WorkflowSettings; validation: Array<{ severity: 'error' | 'warning'; message: string }>; onCancel: () => void; onRun: () => void }) {
  let inputError = ''
  let metadataError = ''
  try { JSON.parse(input) } catch { inputError = 'Execution input must be valid JSON.' }
  try { const metadata = JSON.parse(options.metadata); if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) metadataError = 'Metadata must be a JSON object.' } catch { metadataError = 'Metadata must be valid JSON.' }
  const blocked = Boolean(inputError || metadataError) || validation.some((item) => item.severity === 'error')
  const field = (label: string, key: keyof ExecutionOptions, placeholder: string, type = 'text') => <div><label htmlFor={`execution-${key}`}>{label}</label><input id={`execution-${key}`} type={type} value={options[key]} placeholder={placeholder} onChange={(event) => setOptions({ [key]: event.target.value })} /></div>
  return <div className="modal-backdrop"><section className="execute-modal"><div className="modal-head"><div><span className="eyebrow">EXECUTION</span><h2>Execute workflow</h2><p>Run version {workflow.version} with a controlled test input.</p></div><button onClick={onCancel}><X size={17} /></button></div><div className="execute-meta"><span><strong>Workflow</strong>{workflow.name}</span><span><strong>Strategy</strong>{workflow.idempotencyStrategy}</span><span><strong>Timeout</strong>{workflow.timeoutSeconds}s</span></div><div className="execute-fields">{field('Execution name', 'executionName', 'health-check-run')}{field('Correlation ID', 'correlationId', 'incident-123')}{field('Priority', 'priority', '0', 'number')}{field('Idempotency key', 'idempotencyKey', 'Generated automatically')}</div><label htmlFor="execution-input">Input JSON</label><textarea id="execution-input" className="execute-input" value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} />{inputError && <div className="execute-error">{inputError}</div>}<label htmlFor="execution-metadata">Metadata JSON</label><textarea id="execution-metadata" className="execute-input compact-input" value={options.metadata} onChange={(event) => setOptions({ metadata: event.target.value })} spellCheck={false} />{metadataError && <div className="execute-error">{metadataError}</div>}{validation.some((item) => item.severity === 'error') && <div className="execute-error">Resolve validation errors before starting this execution.</div>}<div className="modal-actions"><button className="outline-button" onClick={onCancel}>Cancel</button><button className="primary-action" disabled={blocked} onClick={onRun}><Play size={14} fill="currentColor" /> Start execution</button></div></section></div>
}

function DependenciesPanel({ nodes, workflow }: { nodes: StudioNode[]; workflow: WorkflowSettings }) {
  const [open, setOpen] = useState<string | null>('Integrations')
  const taskNodes = nodes.filter((node) => ['studio', 'loop', 'switch'].includes(node.type))
  const workerTasks = taskNodes.filter((node) => node.data.kind === 'SIMPLE')
  const integrationTasks = taskNodes.filter((node) => ['HTTP', 'HTTP_POLL', 'GRPC', 'EVENT', 'KAFKA_PUBLISH', 'INTEGRATION', 'MCP_REMOTE', 'SENDGRID', 'JDBC', 'SQL'].includes(node.data.kind))
  const sections: Record<string, string> = { Integrations: `${integrationTasks.length} integration task${integrationTasks.length === 1 ? '' : 's'} referenced`, 'AI Prompts': 'Prompt and model dependencies used by AI tasks.', Secrets: 'Masked secret bindings · values hidden', 'Environment Variables': 'Runtime environment values available', 'User Forms': 'Human task form dependencies', Schemas: 'Input and output schema contracts', 'Task Definitions': `${workerTasks.length} Worker Task definition${workerTasks.length === 1 ? '' : 's'} referenced`, 'Sub Workflows': 'Child workflow dependencies' }
  const rows = (name: string) => {
    if (name === 'Integrations') return integrationTasks.length ? integrationTasks.map((node) => <div className="dependency-row" key={node.id}><Globe2 size={14} /><span>{node.data.ref}</span><small>{node.data.kind}</small></div>) : <div className="dependency-empty">No integration task is referenced.</div>
    if (name === 'Task Definitions') return workerTasks.length ? workerTasks.map((node) => <div className="dependency-worker" key={node.id}><div className="dependency-row"><Zap size={14} /><span>{node.data.config?.workerTaskName || node.data.ref}</span><small>{node.data.config?.workerTaskName ? 'FOUND' : 'MISSING'}</small></div><div className="worker-health-grid"><span>Worker activity<small>{node.data.config?.workerTaskName ? 'READY' : 'WAITING'}</small></span><span>Queue depth<small>{node.data.config?.workerTaskName ? '0' : '—'}</small></span><span>Last poll<small>{node.data.config?.workerTaskName ? 'Just now' : '—'}</small></span></div></div>) : <div className="dependency-empty">No Worker Task is referenced.</div>
    if (name === 'Schemas') return <><div className="dependency-row"><FileJson size={14} /><span>workflow.input</span><small>{workflow.inputSchema ? 'DEFINED' : 'MISSING'}</small></div><div className="dependency-row"><FileJson size={14} /><span>workflow.output</span><small>{workflow.outputSchema ? 'DEFINED' : 'MISSING'}</small></div></>
    if (name === 'AI Prompts') { const aiTasks = taskNodes.filter((node) => node.data.config?.prompt); return aiTasks.length ? aiTasks.map((node) => <div className="dependency-row" key={node.id}><Bot size={14} /><span>{node.data.ref}</span><small>{node.data.config?.model || 'DEFAULT MODEL'}</small></div>) : <div className="dependency-empty">No AI prompt is referenced.</div> }
    if (name === 'Secrets') return <><div className="dependency-row"><span>HTTP_API_TOKEN</span><small>MASKED</small></div><div className="dependency-row"><span>DATABASE_PASSWORD</span><small>MASKED</small></div></>
    if (name === 'Environment Variables') return <><div className="dependency-row"><span>API_BASE_URL</span><small>AVAILABLE</small></div><div className="dependency-row"><span>DEFAULT_TIMEOUT</span><small>AVAILABLE</small></div></>
    return <div className="dependency-empty">No dependency is currently referenced.</div>
  }
  return <div className="dependency-panel">{Object.entries(sections).map(([name, detail]) => <div className={`dependency-section ${open === name ? 'open' : ''}`} key={name}><button onClick={() => setOpen(open === name ? null : name)}><span>{name}</span><ChevronDown size={16} /></button>{open === name && <div className="dependency-content"><div className="dependency-detail">{detail}</div>{rows(name)}</div>}</div>)}</div>
}

function WorkflowSettingsPanel({ workflow, updateWorkflow, validation, onOpenTasks, onImportBpmn, onExportBpmn, onExportConductor, importMessage }: { workflow: WorkflowSettings; updateWorkflow: (patch: Partial<WorkflowSettings>) => void; validation: Array<{ severity: 'error' | 'warning'; message: string; nodeId?: string }>; onOpenTasks: () => void; onImportBpmn: (file?: File) => void; onExportBpmn: () => void; onExportConductor: () => void; importMessage: string | null }) {
  const [open, setOpen] = useState<'details' | 'schema' | 'execution'>('details')
  const [schemaTab, setSchemaTab] = useState<'parameters' | 'schema'>('parameters')
  const inputParameters = workflow.inputParameters ?? []
  const outputParameters = workflow.outputParameters ?? []
  const updateParameters = (key: 'inputParameters' | 'outputParameters', parameters: WorkflowParameter[]) => updateWorkflow({ [key]: parameters })
  return <div className="workflow-properties-panel"><div className="workflow-panel-intro"><div className="workflow-avatar"><Workflow size={20} /></div><div><h2>Workflow</h2><p>Configure workflow metadata, parameters and execution behavior.</p></div></div><WorkflowAccordion title="Workflow Details" open={open === 'details'} onToggle={() => setOpen(open === 'details' ? 'schema' : 'details')}><label htmlFor="workflow-name">Name</label><input id="workflow-name" value={workflow.name} onChange={(event) => updateWorkflow({ name: event.target.value })} /><span className="field-hint">Workflow name must be unique.</span><label htmlFor="workflow-description">Description</label><textarea id="workflow-description" value={workflow.description} onChange={(event) => updateWorkflow({ description: event.target.value })} /></WorkflowAccordion><WorkflowAccordion title="Schema and Parameters" open={open === 'schema'} onToggle={() => setOpen(open === 'schema' ? 'details' : 'schema')}><div className="schema-tabs"><button className={schemaTab === 'parameters' ? 'active' : ''} onClick={() => setSchemaTab('parameters')}>Input and Output Parameters</button><button className={schemaTab === 'schema' ? 'active' : ''} onClick={() => setSchemaTab('schema')}>Workflow Schema</button></div>{schemaTab === 'parameters' ? <><ParameterEditor title="Input parameters" items={inputParameters} onChange={(items) => updateParameters('inputParameters', items)} /><ParameterEditor title="Output parameters" items={outputParameters} onChange={(items) => updateParameters('outputParameters', items)} /></> : <><label htmlFor="input-schema">Input schema</label><textarea id="input-schema" className="schema-editor" value={workflow.inputSchema ?? ''} onChange={(event) => updateWorkflow({ inputSchema: event.target.value })} /><label htmlFor="output-schema">Output schema</label><textarea id="output-schema" className="schema-editor" value={workflow.outputSchema ?? ''} onChange={(event) => updateWorkflow({ outputSchema: event.target.value })} /><label className="form-toggle"><input type="checkbox" checked={workflow.enforceSchema} onChange={(event) => updateWorkflow({ enforceSchema: event.target.checked })} /><span>Enforce workflow schema</span></label></>}</WorkflowAccordion><WorkflowAccordion title="Execution Parameters" open={open === 'execution'} onToggle={() => setOpen(open === 'execution' ? 'details' : 'execution')}><label className="form-toggle"><input type="checkbox" checked={workflow.enableStatusListener ?? false} onChange={(event) => updateWorkflow({ enableStatusListener: event.target.checked })} /><span>Enable workflow status listener</span></label><div className="section-caption">Timeout Settings</div><div className="compact-fields"><div><label htmlFor="workflow-timeout">Timeout seconds</label><input id="workflow-timeout" type="number" value={workflow.timeoutSeconds} onChange={(event) => updateWorkflow({ timeoutSeconds: Number(event.target.value) })} /></div><div><label htmlFor="timeout-policy">Timeout policy</label><select id="timeout-policy" className="native-select" value={workflow.timeoutPolicy ?? 'TIMEOUT_WORKFLOW'} onChange={(event) => updateWorkflow({ timeoutPolicy: event.target.value as WorkflowSettings['timeoutPolicy'] })}><option value="TIMEOUT_WORKFLOW">Timeout Workflow</option><option value="TIMEOUT_TASK">Timeout Task</option></select></div></div><div className="section-caption">Restartable</div><label className="form-toggle"><input type="checkbox" checked={workflow.restartable} onChange={(event) => updateWorkflow({ restartable: event.target.checked })} /><span>Allow workflow restarts</span></label><span className="field-hint">When enabled, completed workflows can be restarted.</span><label htmlFor="failure-workflow">Failure/Compensation workflow name</label><input id="failure-workflow" value={workflow.failureWorkflow ?? ''} placeholder="failure_handler_workflow" onChange={(event) => updateWorkflow({ failureWorkflow: event.target.value })} /><div className="section-caption">Rate Limit</div><span className="field-hint">Limits the number of workflow executions at any given time.</span><label htmlFor="rate-limit-key">Rate limit key</label><input id="rate-limit-key" value={workflow.rateLimitKey ?? ''} placeholder="Optional key" onChange={(event) => updateWorkflow({ rateLimitKey: event.target.value })} /><label htmlFor="concurrent-limit">Concurrent execution limit</label><input id="concurrent-limit" type="number" value={workflow.concurrentLimit ?? 0} onChange={(event) => updateWorkflow({ concurrentLimit: Number(event.target.value) })} /></WorkflowAccordion>{validation.length > 0 && <div className="validation-list">{validation.slice(0, 5).map((item, index) => <div key={`${item.message}-${index}`} className={item.severity}><span>{item.severity === 'error' ? '!' : 'i'}</span>{item.message}</div>)}</div>}{importMessage && <div className="import-message">{importMessage}</div>}<div className="workflow-actions"><button className="outline-button" onClick={onOpenTasks}><Plus size={15} /> Add task</button><button className="outline-button" onClick={onExportBpmn}><Download size={14} /> Export BPMN</button><button className="outline-button" onClick={onExportConductor}><Download size={14} /> Conductor JSON</button><label className="outline-button file-button"><ArrowDownToLine size={14} /> Import BPMN<input type="file" accept=".bpmn,.xml,application/xml,text/xml" onChange={(event) => onImportBpmn(event.target.files?.[0])} /></label></div></div>
}

function WorkflowAccordion({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) { return <section className={`workflow-accordion ${open ? 'open' : ''}`}><button className="workflow-accordion-toggle" onClick={onToggle}><span>{title}</span>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>{open && <div className="workflow-accordion-content">{children}</div>}</section> }

function ParameterEditor({ title, items, onChange }: { title: string; items: WorkflowParameter[]; onChange: (items: WorkflowParameter[]) => void }) { const setItem = (index: number, patch: Partial<WorkflowParameter>) => onChange(items.map((item, current) => current === index ? { ...item, ...patch } : item)); return <div className="parameter-editor"><div className="section-caption">{title}</div>{items.map((item, index) => <div className="parameter-row" key={`${title}-${index}`}><div><label>Key</label><input aria-label={`${title} key ${index + 1}`} value={item.key} placeholder="Parameter" onChange={(event) => setItem(index, { key: event.target.value })} /></div><div><label>Value</label><input aria-label={`${title} value ${index + 1}`} value={item.value} placeholder="${task_ref.output.result}" onChange={(event) => setItem(index, { value: event.target.value })} /></div><button aria-label={`Remove ${title} ${index + 1}`} onClick={() => onChange(items.filter((_, current) => current !== index))}>×</button></div>)}<button className="add-parameter" onClick={() => onChange([...items, { key: '', value: '' }])}><Plus size={14} /> Add parameter</button></div> }

function PanelContent({ tab, onOpenTasks, codeText, setCodeText, applyJson, codeError, workflow, updateWorkflow, validation, runState, onRun, onPause, onResume, onTerminate, onImportBpmn, onExportBpmn, onExportConductor, lastSavedJson, versionHistory, importMessage, executionEvents, executionInput, lastExecution, realtimeEvent, nodes }: { tab: string; onOpenTasks: () => void; codeText: string; setCodeText: (v: string) => void; applyJson: () => void; codeError: string | null; workflow: WorkflowSettings; updateWorkflow: (patch: Partial<WorkflowSettings>) => void; validation: Array<{ severity: 'error' | 'warning'; message: string; nodeId?: string }>; runState: RunState; onRun: () => void; onPause: () => void; onResume: () => void; onTerminate: () => void; onImportBpmn: (file?: File) => void; onExportBpmn: () => void; onExportConductor: () => void; lastSavedJson: string; versionHistory: WorkflowVersionSnapshot[]; importMessage: string | null; executionEvents: Array<{ id: string; label: string; status: TaskExecutionStatus }>; executionInput: string; lastExecution: ExecutionRecord | null; realtimeEvent: RealtimeExecutionEvent['type'] | null; nodes: StudioNode[] }) {
  const [showDiff, setShowDiff] = useState(false)
  const [compareVersion, setCompareVersion] = useState('')
  const selectedSnapshot = versionHistory.find((snapshot) => `${snapshot.version}-${snapshot.status}` === compareVersion)
  const compareBaseline = selectedSnapshot ? JSON.stringify(buildWorkflowJson(selectedSnapshot.nodes, selectedSnapshot.workflow), null, 2) : lastSavedJson
  const formatCode = () => { try { setCodeText(JSON.stringify(JSON.parse(codeText), null, 2)) } catch { /* Keep invalid source visible for Monaco diagnostics. */ } }
  if (tab === 'Code') return <div className="code-panel"><div className="code-top"><span>{showDiff ? 'Draft diff' : 'workflow.json'} · {validation.length ? `${validation.length} issues` : 'valid'}</span><div className="code-top-actions">{versionHistory.length > 0 && <select className="compare-select" aria-label="Compare with version" value={compareVersion} onChange={(event) => { setCompareVersion(event.target.value); setShowDiff(Boolean(event.target.value)) }}><option value="">Saved baseline</option>{versionHistory.slice().reverse().map((snapshot) => <option value={`${snapshot.version}-${snapshot.status}`} key={`${snapshot.version}-${snapshot.status}`}>v{snapshot.version} · {snapshot.status.toLowerCase()}</option>)}</select>}<button onClick={formatCode}>Format</button><button onClick={() => setShowDiff((open) => !open)}>{showDiff ? 'Editor' : 'Diff'}</button><button onClick={() => navigator.clipboard?.writeText(codeText)}><Copy size={15} /></button></div></div>{showDiff ? <DiffViewer baseline={compareBaseline} current={codeText} /> : <Suspense fallback={<div className="code-loading">Loading Monaco editor…</div>}><MonacoEditor height="425px" language="json" theme="vs" value={codeText} onChange={(value) => setCodeText(value ?? '')} options={{ minimap: { enabled: true }, fontSize: 11, lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false, automaticLayout: true }} /></Suspense>}{codeError && <div className="code-error">{codeError}</div>}{showDiff && <div className="diff-caption">Comparing current draft against {selectedSnapshot ? `version ${selectedSnapshot.version} ${selectedSnapshot.status.toLowerCase()}` : 'the last saved baseline'}.</div>}<div className="code-actions"><button className="outline-button" onClick={applyJson}><Check size={14} /> Apply JSON</button><button className="outline-button" onClick={onExportConductor}><Download size={14} /> Conductor JSON</button></div></div>
  if (tab === 'Dependencies') return <DependenciesPanel nodes={nodes} workflow={workflow} />
  if (tab === 'Run') return <RunPanel runState={runState} workflow={workflow} executionEvents={executionEvents} executionInput={executionInput} lastExecution={lastExecution} realtimeEvent={realtimeEvent} onRun={onRun} onPause={onPause} onResume={onResume} onTerminate={onTerminate} />
  if (tab === 'Workflow') return <WorkflowSettingsPanel workflow={workflow} updateWorkflow={updateWorkflow} validation={validation} onOpenTasks={onOpenTasks} onImportBpmn={onImportBpmn} onExportBpmn={onExportBpmn} onExportConductor={onExportConductor} importMessage={importMessage} />
return <div className="workflow-panel"><div className="workflow-avatar"><Workflow size={20} /></div><h2>Workflow settings</h2><p>Configure workflow inputs, schema enforcement and version metadata.</p><label>Workflow name</label><input value={workflow.name} onChange={(event) => updateWorkflow({ name: event.target.value })} /><label>Description</label><textarea value={workflow.description} onChange={(event) => updateWorkflow({ description: event.target.value })} /><label>Input schema</label><textarea value={workflow.inputSchema ?? ''} placeholder='JSON Schema for workflow.input' onChange={(event) => updateWorkflow({ inputSchema: event.target.value })} /><label>Output schema</label><textarea value={workflow.outputSchema ?? ''} placeholder='JSON Schema for workflow.output' onChange={(event) => updateWorkflow({ outputSchema: event.target.value })} /><div className="form-toggle"><input type="checkbox" checked={workflow.enforceSchema} onChange={(event) => updateWorkflow({ enforceSchema: event.target.checked })} /><span>Enforce input/output schema</span></div><div className="compact-fields"><div><label>Workflow timeout (sec)</label><input type="number" value={workflow.timeoutSeconds} onChange={(event) => updateWorkflow({ timeoutSeconds: Number(event.target.value) })} /></div><div><label>Idempotency</label><select className="native-select" value={workflow.idempotencyStrategy} onChange={(event) => updateWorkflow({ idempotencyStrategy: event.target.value as WorkflowSettings['idempotencyStrategy'] })}><option>FAIL</option><option>RETURN_EXISTING</option><option>FAIL_ON_RUNNING</option></select></div></div><div className="form-toggle"><input type="checkbox" checked={workflow.restartable} onChange={(event) => updateWorkflow({ restartable: event.target.checked })} /><span>Allow restart from failed execution</span></div><label>Failure workflow (optional)</label><input value={workflow.failureWorkflow ?? ''} placeholder="failure_handler_workflow" onChange={(event) => updateWorkflow({ failureWorkflow: event.target.value })} />{validation.length > 0 && <div className="validation-list">{validation.slice(0, 5).map((item, index) => <div key={`${item.message}-${index}`} className={item.severity}><span>{item.severity === 'error' ? '!' : 'i'}</span>{item.message}</div>)}</div>}{importMessage && <div className="import-message">{importMessage}</div>}<div className="workflow-actions"><button className="outline-button" onClick={onOpenTasks}><Plus size={15} /> Add task</button><button className="outline-button" onClick={onExportBpmn}><Download size={14} /> Export BPMN</button><button className="outline-button" onClick={onExportConductor}><Download size={14} /> Conductor JSON</button><label className="outline-button file-button"><ArrowDownToLine size={14} /> Import BPMN<input type="file" accept=".bpmn,.xml,application/xml,text/xml" onChange={(event) => onImportBpmn(event.target.files?.[0])} /></label></div></div>
}

export default App
