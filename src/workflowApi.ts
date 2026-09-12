import type { Edge } from '@xyflow/react'
import { validateWorkflow, type StudioNode, type WorkflowSettings } from './workflowStore'
import { taskCatalog, type TaskCatalogItem } from './taskCatalog'

export type TaskExecutionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'SKIPPED' | 'TIMED_OUT' | 'CANCELED' | 'FAILED' | 'FAILED_WITH_TERMINAL_ERROR' | 'COMPLETED_WITH_ERRORS' | 'COMPLETED'
export type ExecutionTaskEvent = { taskReferenceName: string; status: TaskExecutionStatus; at: string; reasonForIncompletion?: string; retryCount?: number; workerId?: string }
export type ExecutionStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'TIMED_OUT' | 'TERMINATED' | 'FAILED'
export type RealtimeExecutionEvent = { type: 'workflow.started' | 'workflow.completed' | 'workflow.failed' | 'task.scheduled' | 'task.started' | 'task.completed' | 'task.retrying'; executionId: string; taskReferenceName?: string; at: string; status?: ExecutionStatus }
export type ExecutionRecord = { executionId: string; workflowName: string; version: number; status: ExecutionStatus; input: unknown; events: ExecutionTaskEvent[]; startedAt: string; completedAt?: string; correlationId?: string; priority?: number; executionName?: string; metadata?: Record<string, string>; idempotencyKey?: string; tasks?: StudioNode[] }
export type WorkflowDefinitionRecord = { name: string; description: string; version: number; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; updatedAt: string; taskCount: number; workflow?: WorkflowSettings; nodes?: StudioNode[]; edges?: Edge[] }
export type TaskDefinitionRecord = { name: string; description: string; owner: string; timeoutSeconds: number; retryCount: number; updatedAt: string; status: 'ACTIVE' | 'PAUSED' }
export type EventHandlerRecord = { name: string; event: string; action: string; workflowName: string; active: boolean; updatedAt: string }
export type ScheduleRecord = { name: string; workflowName: string; cronExpression: string; timezone: string; active: boolean; nextRun: string; updatedAt: string }
export type QueueRecord = { queue: string; taskType: string; inProgress: number; unprocessed: number; rateLimit: number; updatedAt: string }
export type EventRecord = { id: string; event: string; status: 'RECEIVED' | 'PROCESSED' | 'FAILED'; source: string; receivedAt: string; payload: unknown }

const executionByKey = new Map<string, ExecutionRecord>()
const executionControllers = new Map<string, { record: ExecutionRecord; paused: boolean; terminated: boolean; onEvent: (event: ExecutionTaskEvent) => void; onRealtimeEvent?: (event: RealtimeExecutionEvent) => void }>()
const workflowStorageKey = 'orkes-workflow-definitions-v1'
const executionStorageKey = 'orkes-executions-v1'
const taskDefinitionStorageKey = 'orkes-task-definitions-v1'
const eventHandlerStorageKey = 'orkes-event-handlers-v1'
const scheduleStorageKey = 'orkes-schedules-v1'
const seedWorkflowDefinitions: WorkflowDefinitionRecord[] = [
  { name: 'api_polling_workflow', description: 'Poll a remote API until a condition is met.', version: 1, status: 'PUBLISHED', updatedAt: 'Just now', taskCount: 10 },
  { name: 'endpoint_health_monitor', description: 'Monitor an HTTP endpoint and route health outcomes.', version: 3, status: 'PUBLISHED', updatedAt: '3 hours ago', taskCount: 7 },
  { name: 'payment_and_subscription_flow', description: 'Process payment outcomes across multiple providers.', version: 12, status: 'DRAFT', updatedAt: 'Yesterday', taskCount: 18 },
]

function readWorkflowDefinitions(): WorkflowDefinitionRecord[] {
  if (typeof window === 'undefined') return seedWorkflowDefinitions
  try {
    const stored = window.localStorage.getItem(workflowStorageKey)
    if (!stored) return seedWorkflowDefinitions
    const parsed = JSON.parse(stored) as unknown
    return Array.isArray(parsed) ? parsed as WorkflowDefinitionRecord[] : seedWorkflowDefinitions
  } catch { return seedWorkflowDefinitions }
}

function writeWorkflowDefinitions(definitions: WorkflowDefinitionRecord[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(workflowStorageKey, JSON.stringify(definitions))
}

function readStored<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as unknown
    return Array.isArray(parsed) ? parsed as T[] : fallback
  } catch { return fallback }
}

function writeStored<T>(key: string, value: T[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value))
}

function persistExecution(record: ExecutionRecord) {
  const records = readStored<ExecutionRecord>(executionStorageKey, [])
  writeStored(executionStorageKey, [record, ...records.filter((item) => item.executionId !== record.executionId)].slice(0, 100))
}

export const workflowApi = {
  getTaskCatalog(): Promise<TaskCatalogItem[]> {
    return Promise.resolve(taskCatalog)
  },

  validate(nodes: StudioNode[], edges: Edge[]) {
    return validateWorkflow(nodes, edges)
  },

  listWorkflowDefinitions(): Promise<WorkflowDefinitionRecord[]> {
    return Promise.resolve(readWorkflowDefinitions().sort((left, right) => left.name.localeCompare(right.name)))
  },

  getWorkflowDefinition(name: string): Promise<WorkflowDefinitionRecord | null> {
    return Promise.resolve(readWorkflowDefinitions().find((item) => item.name === name) ?? null)
  },

  listExecutions(): Promise<ExecutionRecord[]> {
    const stored = readStored<ExecutionRecord>(executionStorageKey, [])
    const records = [...executionByKey.values(), ...stored]
    const unique = new Map(records.map((record) => [record.executionId, record]))
    return Promise.resolve([...unique.values()].sort((left, right) => right.startedAt.localeCompare(left.startedAt)))
  },

  getExecution(executionId: string): Promise<ExecutionRecord | null> {
    return this.listExecutions().then((records) => records.find((record) => record.executionId === executionId) ?? null)
  },

  listTaskDefinitions(): Promise<TaskDefinitionRecord[]> {
    return Promise.resolve(readStored<TaskDefinitionRecord>(taskDefinitionStorageKey, [
      { name: 'http_request', description: 'Invoke an external HTTP endpoint.', owner: 'platform', timeoutSeconds: 60, retryCount: 3, updatedAt: 'Today', status: 'ACTIVE' },
      { name: 'check_status', description: 'Poll and evaluate a job status.', owner: 'platform', timeoutSeconds: 30, retryCount: 2, updatedAt: 'Yesterday', status: 'ACTIVE' },
    ]))
  },

  saveTaskDefinition(definition: TaskDefinitionRecord) {
    const items = readStored<TaskDefinitionRecord>(taskDefinitionStorageKey, [])
    writeStored(taskDefinitionStorageKey, [...items.filter((item) => item.name !== definition.name), definition])
    return Promise.resolve(definition)
  },

  listEventHandlers(): Promise<EventHandlerRecord[]> {
    return Promise.resolve(readStored<EventHandlerRecord>(eventHandlerStorageKey, [
      { name: 'job_completed_handler', event: 'job.completed', action: 'START_WORKFLOW', workflowName: 'api_polling_workflow', active: true, updatedAt: 'Today' },
      { name: 'job_failed_handler', event: 'job.failed', action: 'PUBLISH_EVENT', workflowName: 'endpoint_health_monitor', active: false, updatedAt: '3 hours ago' },
    ]))
  },

  saveEventHandler(handler: EventHandlerRecord) {
    const items = readStored<EventHandlerRecord>(eventHandlerStorageKey, [])
    writeStored(eventHandlerStorageKey, [...items.filter((item) => item.name !== handler.name), handler])
    return Promise.resolve(handler)
  },

  listSchedules(): Promise<ScheduleRecord[]> {
    return Promise.resolve(readStored<ScheduleRecord>(scheduleStorageKey, [
      { name: 'health_monitor_every_5m', workflowName: 'endpoint_health_monitor', cronExpression: '0 */5 * * * *', timezone: 'UTC', active: true, nextRun: 'In 4 minutes', updatedAt: 'Today' },
      { name: 'billing_daily', workflowName: 'payment_and_subscription_flow', cronExpression: '0 0 8 * * *', timezone: 'Europe/Istanbul', active: false, nextRun: 'Paused', updatedAt: 'Yesterday' },
    ]))
  },

  saveSchedule(schedule: ScheduleRecord) {
    const items = readStored<ScheduleRecord>(scheduleStorageKey, [])
    writeStored(scheduleStorageKey, [...items.filter((item) => item.name !== schedule.name), schedule])
    return Promise.resolve(schedule)
  },

  listQueues(): Promise<QueueRecord[]> {
    return Promise.resolve([
      { queue: 'http_request', taskType: 'HTTP', inProgress: 2, unprocessed: 14, rateLimit: 50, updatedAt: 'Now' },
      { queue: 'check_status', taskType: 'SIMPLE', inProgress: 1, unprocessed: 4, rateLimit: 25, updatedAt: 'Now' },
      { queue: 'notifications', taskType: 'EVENT', inProgress: 0, unprocessed: 0, rateLimit: 100, updatedAt: 'Now' },
    ])
  },

  listEvents(): Promise<EventRecord[]> {
    return Promise.resolve([
      { id: 'evt-1003', event: 'job.completed', status: 'PROCESSED', source: 'worker-api', receivedAt: '2 minutes ago', payload: { jobId: 'job-1003', status: 'COMPLETED' } },
      { id: 'evt-1002', event: 'job.failed', status: 'FAILED', source: 'worker-api', receivedAt: '18 minutes ago', payload: { jobId: 'job-1002', status: 'FAILED' } },
      { id: 'evt-1001', event: 'payment.created', status: 'RECEIVED', source: 'payments', receivedAt: '34 minutes ago', payload: { paymentId: 'pay-1001' } },
    ])
  },

  save(settings: WorkflowSettings, nodes: StudioNode[], edges: Edge[] = []) {
    const errors = validateWorkflow(nodes, edges).filter((issue) => issue.severity === 'error')
    if (errors.length) return Promise.reject(new Error(`Save blocked: ${errors[0].message}`))
    const savedAt = new Date().toISOString()
    const taskCount = nodes.filter((node) => node.type === 'studio' || node.type === 'switch' || node.type === 'loop').length
    const definitions = readWorkflowDefinitions()
    const existing = definitions.find((item) => item.name === settings.name)
    const record: WorkflowDefinitionRecord = { name: settings.name, description: settings.description, version: settings.version, status: existing?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT', updatedAt: savedAt, taskCount, workflow: structuredClone(settings), nodes: structuredClone(nodes), edges: structuredClone(edges) }
    writeWorkflowDefinitions([...definitions.filter((item) => item.name !== settings.name), record])
    return Promise.resolve({ version: settings.version, savedAt, taskCount })
  },

  deleteWorkflowDefinition(name: string) {
    const definitions = readWorkflowDefinitions()
    if (!definitions.some((item) => item.name === name)) return Promise.reject(new Error(`Workflow "${name}" was not found.`))
    writeWorkflowDefinitions(definitions.filter((item) => item.name !== name))
    return Promise.resolve()
  },

  archiveWorkflowDefinition(name: string) {
    const definitions = readWorkflowDefinitions()
    const current = definitions.find((item) => item.name === name)
    if (!current) return Promise.reject(new Error(`Workflow "${name}" was not found.`))
    const archived = { ...current, status: 'ARCHIVED' as const, updatedAt: new Date().toISOString() }
    writeWorkflowDefinitions(definitions.map((item) => item.name === name ? archived : item))
    return Promise.resolve(archived)
  },

  cloneWorkflowDefinition(name: string, cloneName: string) {
    const definitions = readWorkflowDefinitions()
    const current = definitions.find((item) => item.name === name)
    if (!current) return Promise.reject(new Error(`Workflow "${name}" was not found.`))
    if (definitions.some((item) => item.name === cloneName)) return Promise.reject(new Error(`Workflow "${cloneName}" already exists.`))
    const clone: WorkflowDefinitionRecord = { ...structuredClone(current), name: cloneName, version: 1, status: 'DRAFT', updatedAt: new Date().toISOString(), workflow: current.workflow ? { ...structuredClone(current.workflow), name: cloneName, version: 1 } : undefined }
    writeWorkflowDefinitions([...definitions, clone])
    return Promise.resolve(clone)
  },

  testTask(node: StudioNode) {
    return Promise.resolve({ statusCode: 200, durationMs: 142, taskReferenceName: node.data.ref, output: { status: 'ok', mock: true } })
  },

  startExecution(input: { workflowName: string; version: number; idempotencyKey: string; strategy: WorkflowSettings['idempotencyStrategy']; tasks: StudioNode[]; executionInput?: unknown; correlationId?: string; priority?: number; executionName?: string; metadata?: Record<string, string>; onEvent: (event: ExecutionTaskEvent) => void; onRealtimeEvent?: (event: RealtimeExecutionEvent) => void }) {
    const existing = executionByKey.get(input.idempotencyKey)
    if (existing && input.strategy === 'RETURN_EXISTING') return Promise.resolve(existing)
    if (existing && input.strategy === 'FAIL') return Promise.reject(new Error('An execution already exists for this idempotency key.'))
    if (existing && input.strategy === 'FAIL_ON_RUNNING' && existing.status === 'RUNNING') return Promise.reject(new Error('An execution is already running for this idempotency key.'))
    const startedAt = new Date().toISOString()
    const record: ExecutionRecord = { executionId: `exec_${Date.now()}`, workflowName: input.workflowName, version: input.version, status: 'RUNNING', input: input.executionInput ?? {}, events: [], startedAt, correlationId: input.correlationId, priority: input.priority, executionName: input.executionName, metadata: input.metadata, idempotencyKey: input.idempotencyKey, tasks: structuredClone(input.tasks) }
    executionByKey.set(input.idempotencyKey, record)
    persistExecution(record)
    const controller = { record, paused: false, terminated: false, onEvent: input.onEvent, onRealtimeEvent: input.onRealtimeEvent }
    executionControllers.set(record.executionId, controller)
    input.onRealtimeEvent?.({ type: 'workflow.started', executionId: record.executionId, at: startedAt, status: record.status })
    input.tasks.forEach((task, index) => {
      const event: ExecutionTaskEvent = { taskReferenceName: task.data.ref, status: 'SCHEDULED', at: new Date().toISOString() }
      record.events.push(event)
      input.onEvent(event)
      input.onRealtimeEvent?.({ type: 'task.scheduled', executionId: record.executionId, taskReferenceName: task.data.ref, at: event.at })
      const whenRunnable = (callback: () => void) => {
        if (controller.terminated) return
        if (controller.paused) { globalThis.setTimeout(() => whenRunnable(callback), 120); return }
        callback()
      }
      globalThis.setTimeout(() => whenRunnable(() => {
        event.status = 'IN_PROGRESS'
        event.at = new Date().toISOString()
        persistExecution(record)
        input.onEvent({ ...event })
        input.onRealtimeEvent?.({ type: 'task.started', executionId: record.executionId, taskReferenceName: task.data.ref, at: event.at })
        globalThis.setTimeout(() => whenRunnable(() => {
          event.status = 'COMPLETED'
          event.at = new Date().toISOString()
          persistExecution(record)
          input.onEvent({ ...event })
          input.onRealtimeEvent?.({ type: 'task.completed', executionId: record.executionId, taskReferenceName: task.data.ref, at: event.at })
          if (index === input.tasks.length - 1) {
            record.status = 'COMPLETED'
            record.completedAt = event.at
            persistExecution(record)
            executionControllers.delete(record.executionId)
            input.onRealtimeEvent?.({ type: 'workflow.completed', executionId: record.executionId, at: event.at, status: record.status })
          }
        }), 180)
      }), index * 360)
    })
    return Promise.resolve(record)
  },

  pauseExecution(executionId: string) {
    const controller = executionControllers.get(executionId)
    if (!controller || controller.terminated || controller.record.status !== 'RUNNING') return Promise.reject(new Error('Execution is not running.'))
    controller.paused = true
    controller.record.status = 'PAUSED'
    persistExecution(controller.record)
    return Promise.resolve({ ...controller.record })
  },

  resumeExecution(executionId: string) {
    const controller = executionControllers.get(executionId)
    if (!controller || controller.terminated || controller.record.status !== 'PAUSED') return Promise.reject(new Error('Execution is not paused.'))
    controller.paused = false
    controller.record.status = 'RUNNING'
    persistExecution(controller.record)
    return Promise.resolve({ ...controller.record })
  },

  terminateExecution(executionId: string) {
    const controller = executionControllers.get(executionId)
    if (!controller || controller.terminated || ['COMPLETED', 'TERMINATED'].includes(controller.record.status)) return Promise.reject(new Error('Execution cannot be terminated.'))
    controller.terminated = true
    controller.record.status = 'TERMINATED'
    controller.record.completedAt = new Date().toISOString()
    persistExecution(controller.record)
    controller.onRealtimeEvent?.({ type: 'workflow.failed', executionId, at: controller.record.completedAt, status: controller.record.status })
    executionControllers.delete(executionId)
    return Promise.resolve({ ...controller.record })
  },

  retryExecution(executionId: string) {
    return this.getExecution(executionId).then((record) => {
      if (!record) throw new Error('Execution was not found.')
      if (!record.tasks?.length) throw new Error('This execution has no replayable task definition.')
      return this.startExecution({ workflowName: record.workflowName, version: record.version, idempotencyKey: `retry-${record.executionId}-${Date.now()}`, strategy: 'FAIL', tasks: record.tasks, executionInput: record.input, correlationId: record.correlationId, priority: record.priority, executionName: record.executionName ? `${record.executionName} (retry)` : undefined, metadata: record.metadata, onEvent: () => undefined })
    })
  },

  updateTaskStatus(executionId: string, taskReferenceName: string, status: TaskExecutionStatus, reasonForIncompletion?: string) {
    return this.getExecution(executionId).then((record) => {
      if (!record) throw new Error('Execution was not found.')
      const event = [...record.events].reverse().find((item) => item.taskReferenceName === taskReferenceName)
      if (!event) throw new Error(`Task "${taskReferenceName}" was not found in this execution.`)
      event.status = status
      event.at = new Date().toISOString()
      event.reasonForIncompletion = reasonForIncompletion
      if (status === 'COMPLETED' && record.events.every((item) => item.status === 'COMPLETED')) {
        record.status = 'COMPLETED'
        record.completedAt = event.at
      }
      if (['FAILED', 'FAILED_WITH_TERMINAL_ERROR', 'TIMED_OUT'].includes(status)) record.status = 'FAILED'
      persistExecution(record)
      return { ...record }
    })
  },
}
