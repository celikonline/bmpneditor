import type { StudioNode, StudioNodeType, TaskConfig, TaskKind, WorkflowTaskDraft } from '../workflowStore'
import type { TaskCatalogItem } from '../taskCatalog'

/**
 * Small, dependency-free port of the official task generator contract.
 * The official UI creates a typed Conductor task before it touches the graph;
 * our adapter keeps the same separation while still rendering React Flow nodes.
 */
export function taskNodeType(kind: TaskKind): StudioNodeType {
  if (kind === 'DO_WHILE') return 'loop'
  if (kind === 'SWITCH') return 'switch'
  if (kind === 'JOIN' || kind === 'EXCLUSIVE_JOIN') return 'join'
  return 'studio'
}

export function taskLabel(item: TaskCatalogItem): string {
  return item.name.replace(/\s*\(.+\)/, '').toLowerCase().replace(/\s+/g, '_')
}

export function taskConfig(kind: TaskKind): TaskConfig {
  if (kind === 'HTTP') return { method: 'GET', url: '' }
  if (kind === 'HTTP_POLL') return { method: 'GET', url: '', pollIntervalSeconds: 30, pollCondition: '' }
  if (kind === 'SIMPLE') return { workerTaskName: '' }
  if (kind === 'DO_WHILE') {
    return {
      loopConditionType: 'ECMASCRIPT',
      loopCondition: '',
      loopNoLimits: true,
      loopIterations: 2,
      loopParameters: [],
      loopOver: [],
    }
  }
  if (kind === 'FORK_JOIN') return { forkTasks: '[]', forkBranches: [[]] }
  if (kind === 'FORK_JOIN_DYNAMIC') {
    return { dynamicForkTasksParam: 'dynamicTasks', dynamicForkTasksInputParamName: 'dynamicTasksInput' }
  }
  if (kind === 'DYNAMIC') return { dynamicTaskNameParam: 'taskToExecute' }
  if (kind === 'SUB_WORKFLOW') return { subWorkflowName: '' }
  if (kind === 'START_WORKFLOW') return { startWorkflowName: '' }
  if (kind === 'SET_VARIABLE') return { variableName: '', variableValue: '' }
  if (kind === 'GET_WORKFLOW') return { workflowId: '' }
  if (kind === 'GET_SIGNED_JWT') return { algorithm: 'RS256', ttlInSecond: 300, scopes: [] }
  if (kind === 'UPDATE_TASK') return { taskStatus: 'COMPLETED', taskRefName: '', mergeOutput: false, workflowId: '${workflow.id}' }
  if (kind === 'QUERY_PROCESSOR') return { queryType: 'CONDUCTOR_API', workflowNames: [], statuses: [], correlationIds: [] }
  if (kind === 'OPS_GENIE') return { alias: '', content: '', description: '' }
  if (kind === 'GET_DOCUMENT' || kind === 'LIST_FILES' || kind === 'PARSE_DOCUMENT') return { url: '', inputLocation: '', mediaType: 'auto', chunkSize: 0, fileTypes: [] }
  if (kind === 'AGENT') return { agentType: 'a2a', agentUrl: '', text: '', pollIntervalSeconds: 5 }
  if (kind === 'GET_AGENT_CARD') return { agentType: 'a2a', agentUrl: '' }
  if (kind === 'CANCEL_AGENT') return { agentType: 'a2a', agentUrl: '', taskId: '' }
  if (kind === 'SENDGRID') return { from: '', to: '', subjectLine: '', contentType: 'text/plain', content: '', sendgridConfiguration: '' }
  if (kind === 'CHUNK_TEXT') return { text: '', chunkSize: 1024, mediaType: 'auto' }
  if (kind === 'INTEGRATION' || kind === 'MCP_REMOTE') return { integrationName: '', operation: '' }
  if (kind === 'JOIN') return { joinOn: [] }
  if (kind === 'SWITCH') return { cases: ['defaultCase'], decisionCases: { defaultCase: [] }, defaultCase: [] }
  return {}
}

function uniqueReference(kind: TaskKind, existingReferences: Set<string>): string {
  const base = `${kind.toLowerCase()}_ref`
  if (!existingReferences.has(base)) return base
  let index = 2
  while (existingReferences.has(`${base}_${index}`)) index += 1
  return `${base}_${index}`
}

export function generateTaskNode(item: TaskCatalogItem, existingReferences: Iterable<string>, position: { x: number; y: number }, id = `${item.kind.toLowerCase()}-${Date.now()}`): StudioNode {
  const references = new Set(existingReferences)
  const ref = uniqueReference(item.kind, references)
  return {
    id,
    type: taskNodeType(item.kind),
    position,
    data: {
      label: taskLabel(item),
      ref,
      kind: item.kind,
      detail: item.desc,
      config: taskConfig(item.kind),
    },
  }
}

export function generateNestedTask(item: TaskCatalogItem, existingReferences: Iterable<string>): WorkflowTaskDraft {
  const node = generateTaskNode(item, existingReferences, { x: 0, y: 0 }, `nested-${item.kind.toLowerCase()}-${Date.now()}`)
  return {
    name: node.data.kind === 'SIMPLE' ? node.data.config?.workerTaskName || node.data.label : node.data.label,
    taskReferenceName: node.data.ref,
    type: node.data.kind,
    inputParameters: {},
    config: node.data.config,
    optional: false,
    ...(node.data.kind === 'DO_WHILE' ? { loopOver: node.data.config?.loopOver ?? [] } : {}),
  }
}
