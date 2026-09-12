import type { Edge } from '@xyflow/react'
import { validateWorkflow, type StudioNode, type WorkflowSettings } from './workflowStore'
import { taskCatalog, type TaskCatalogItem } from './taskCatalog'

export type TaskExecutionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'SKIPPED' | 'TIMED_OUT' | 'CANCELED' | 'FAILED' | 'FAILED_WITH_TERMINAL_ERROR' | 'COMPLETED_WITH_ERRORS' | 'COMPLETED'
export type ExecutionTaskEvent = { taskReferenceName: string; status: TaskExecutionStatus; at: string; reasonForIncompletion?: string; retryCount?: number; workerId?: string }
export type ExecutionStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'TIMED_OUT' | 'TERMINATED' | 'FAILED'
export type RealtimeExecutionEvent = { type: 'workflow.started' | 'workflow.completed' | 'workflow.failed' | 'task.scheduled' | 'task.started' | 'task.completed' | 'task.retrying'; executionId: string; taskReferenceName?: string; at: string; status?: ExecutionStatus }
export type ExecutionRecord = { executionId: string; workflowName: string; version: number; status: ExecutionStatus; input: unknown; events: ExecutionTaskEvent[]; startedAt: string; completedAt?: string; correlationId?: string; priority?: number; executionName?: string; metadata?: Record<string, string>; idempotencyKey?: string }

const executionByKey = new Map<string, ExecutionRecord>()
const executionControllers = new Map<string, { record: ExecutionRecord; paused: boolean; terminated: boolean; onEvent: (event: ExecutionTaskEvent) => void; onRealtimeEvent?: (event: RealtimeExecutionEvent) => void }>()

export const workflowApi = {
  getTaskCatalog(): Promise<TaskCatalogItem[]> {
    return Promise.resolve(taskCatalog)
  },

  validate(nodes: StudioNode[], edges: Edge[]) {
    return validateWorkflow(nodes, edges)
  },

  save(settings: WorkflowSettings, nodes: StudioNode[], edges: Edge[] = []) {
    const errors = validateWorkflow(nodes, edges).filter((issue) => issue.severity === 'error')
    if (errors.length) return Promise.reject(new Error(`Save blocked: ${errors[0].message}`))
    return Promise.resolve({ version: settings.version, savedAt: new Date().toISOString(), taskCount: nodes.filter((node) => node.type === 'studio' || node.type === 'switch' || node.type === 'loop').length })
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
    const record: ExecutionRecord = { executionId: `exec_${Date.now()}`, workflowName: input.workflowName, version: input.version, status: 'RUNNING', input: input.executionInput ?? {}, events: [], startedAt, correlationId: input.correlationId, priority: input.priority, executionName: input.executionName, metadata: input.metadata, idempotencyKey: input.idempotencyKey }
    executionByKey.set(input.idempotencyKey, record)
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
        input.onEvent({ ...event })
        input.onRealtimeEvent?.({ type: 'task.started', executionId: record.executionId, taskReferenceName: task.data.ref, at: event.at })
        globalThis.setTimeout(() => whenRunnable(() => {
          event.status = 'COMPLETED'
          event.at = new Date().toISOString()
          input.onEvent({ ...event })
          input.onRealtimeEvent?.({ type: 'task.completed', executionId: record.executionId, taskReferenceName: task.data.ref, at: event.at })
          if (index === input.tasks.length - 1) {
            record.status = 'COMPLETED'
            record.completedAt = event.at
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
    return Promise.resolve({ ...controller.record })
  },

  resumeExecution(executionId: string) {
    const controller = executionControllers.get(executionId)
    if (!controller || controller.terminated || controller.record.status !== 'PAUSED') return Promise.reject(new Error('Execution is not paused.'))
    controller.paused = false
    controller.record.status = 'RUNNING'
    return Promise.resolve({ ...controller.record })
  },

  terminateExecution(executionId: string) {
    const controller = executionControllers.get(executionId)
    if (!controller || controller.terminated || ['COMPLETED', 'TERMINATED'].includes(controller.record.status)) return Promise.reject(new Error('Execution cannot be terminated.'))
    controller.terminated = true
    controller.record.status = 'TERMINATED'
    controller.record.completedAt = new Date().toISOString()
    controller.onRealtimeEvent?.({ type: 'workflow.failed', executionId, at: controller.record.completedAt, status: controller.record.status })
    executionControllers.delete(executionId)
    return Promise.resolve({ ...controller.record })
  },
}
