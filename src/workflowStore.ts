import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { validateExpressions } from './expressions'
import type { Edge, Node } from '@xyflow/react'

export type TaskKind =
  | 'START' | 'HTTP' | 'SIMPLE' | 'EVENT' | 'GRPC' | 'INLINE' | 'JSON_JQ_TRANSFORM' | 'BUSINESS_RULE' | 'SQL' | 'AI_CHAT_COMPLETION' | 'AI_GENERATE_IMAGE'
  | 'DO_WHILE' | 'SWITCH' | 'TERMINATE' | 'WAIT' | 'HUMAN' | 'FORK_JOIN' | 'FORK_JOIN_DYNAMIC' | 'JOIN' | 'DYNAMIC' | 'SUB_WORKFLOW' | 'START_WORKFLOW' | 'TERMINATE_WORKFLOW' | 'YIELD' | 'SET_VARIABLE' | 'GET_WORKFLOW' | 'EXCLUSIVE_JOIN'
  | 'DECISION' | 'USER_DEFINED' | 'LAMBDA' | 'TERMINAL' | 'KAFKA_PUBLISH' | 'WAIT_FOR_EVENT' | 'TASK_SUMMARY' | 'SENDGRID' | 'WAIT_FOR_WEBHOOK' | 'HTTP_POLL' | 'JDBC' | 'SWITCH_JOIN' | 'IA_TASK' | 'JUMP'
  | 'LLM_TEXT_COMPLETE' | 'LLM_GENERATE_EMBEDDINGS' | 'LLM_GET_EMBEDDINGS' | 'LLM_STORE_EMBEDDINGS' | 'LLM_SEARCH_INDEX' | 'LLM_INDEX_DOCUMENT' | 'GET_DOCUMENT' | 'LLM_INDEX_TEXT' | 'UPDATE_SECRET' | 'QUERY_PROCESSOR' | 'OPS_GENIE' | 'GET_SIGNED_JWT' | 'UPDATE_TASK' | 'LLM_CHAT_COMPLETE' | 'INTEGRATION' | 'MCP_REMOTE'
  | 'CHUNK_TEXT' | 'LIST_FILES' | 'PARSE_DOCUMENT' | 'AGENT' | 'GET_AGENT_CARD' | 'CANCEL_AGENT' | 'LLM_SEARCH_EMBEDDINGS' | 'LIST_MCP_TOOLS' | 'CALL_MCP_TOOL' | 'GENERATE_IMAGE' | 'GENERATE_AUDIO' | 'GENERATE_VIDEO' | 'GENERATE_PDF'

export type TaskConfig = {
  method?: string
  url?: string
  headers?: string
  body?: string
  accept?: string
  contentType?: string
  encode?: boolean
  httpHedgingMaxAttempts?: number
  expression?: string
  cases?: string[]
  inputParameters?: string
  retryCount?: number
  retryLogic?: 'FIXED' | 'EXPONENTIAL_BACKOFF' | 'LINEAR_BACKOFF'
  retryDelaySeconds?: number
  maxRetryDelaySeconds?: number
  backoffJitterMs?: number
  totalTimeoutSeconds?: number
  timeoutSeconds?: number
  responseTimeoutSeconds?: number
  pollTimeoutSeconds?: number
  pollIntervalSeconds?: number
  pollCondition?: string
  taskTimeoutPolicy?: 'TIMEOUT_TASK' | 'ALERT_ONLY'
  workerTaskName?: string
  workerDomain?: string
  callbackAfterSeconds?: number
  rateLimitPerFrequency?: number
  rateLimitFrequencyInSeconds?: number
  concurrentExecLimit?: number
  inputKeys?: string[]
  outputKeys?: string[]
  cacheTtlInSecond?: number
  cacheKey?: string
  enforceSchema?: boolean
  inputSchema?: string
  outputSchema?: string
  eventName?: string
  eventPayload?: string
  serviceMethod?: string
  grpcService?: string
  grpcMethod?: string
  grpcHost?: string
  grpcPort?: number
  grpcUseSSL?: boolean
  grpcTrustCert?: boolean
  grpcRequest?: string
  grpcHeaders?: string
  grpcInputType?: string
  grpcMethodType?: string
  grpcOutputType?: string
  grpcHedgingMaxAttempts?: number
  integrationName?: string
  schemaName?: string
  operation?: string
  script?: string
  jqQuery?: string
  ruleName?: string
  ruleFileLocation?: string
  executionStrategy?: string
  inputColumns?: string
  outputColumns?: string
  cacheTimeoutMinutes?: number
  sqlQuery?: string
  assignee?: string
  formKey?: string
  prompt?: string
  model?: string
  llmProvider?: string
  messages?: string
  instructions?: string
  promptName?: string
  promptVariables?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  stopWords?: string
  jsonOutput?: string
  vectorDB?: string
  index?: string
  namespace?: string
  embeddingModelProvider?: string
  embeddingModel?: string
  embeddings?: string
  dimensions?: number
  docId?: string
  query?: string
  maxResults?: number
  chunkOverlap?: number
  mediaSize?: string
  mediaDurationSeconds?: number
  subject?: string
  issuer?: string
  privateKey?: string
  privateKeyId?: string
  audience?: string
  ttlInSecond?: number
  algorithm?: string
  scopes?: string[]
  taskStatus?: string
  taskRefName?: string
  mergeOutput?: boolean
  queryType?: string
  workflowNames?: string[]
  statuses?: string[]
  correlationIds?: string[]
  inputLocation?: string
  fileTypes?: string[]
  mediaType?: string
  chunkSize?: number
  text?: string
  agentType?: string
  agentUrl?: string
  taskId?: string
  from?: string
  to?: string
  subjectLine?: string
  content?: string
  sendgridConfiguration?: string
  alias?: string
  description?: string
  durationSeconds?: number
  loopConditionType?: 'ECMASCRIPT' | 'VALUE_PARAM'
  loopCondition?: string
  loopIterations?: number
  loopNoLimits?: boolean
  loopParameters?: Array<{ name: string; value: string }>
  /** Canonical Conductor nested task list for a DO_WHILE operator. */
  loopOver?: WorkflowTaskDraft[]
  decisionCases?: Record<string, WorkflowTaskDraft[]>
  defaultCase?: WorkflowTaskDraft[]
  forkBranches?: WorkflowTaskDraft[][]
  forkTasks?: string
  dynamicForkTasksParam?: string
  dynamicForkTasksInputParamName?: string
  dynamicTaskNameParam?: string
  subWorkflowName?: string
  subWorkflowVersion?: number
  startWorkflowName?: string
  startWorkflowVersion?: number
  terminationReason?: string
  yieldMessage?: string
  variableName?: string
  variableValue?: string
  workflowId?: string
  joinOn?: string[]
  kafkaTopic?: string
  kafkaValue?: string
  kafkaBootStrapServers?: string
  kafkaHeaders?: string
  kafkaKey?: string
  kafkaKeySerializer?: string
  secretKey?: string
  secretValue?: string
  databaseType?: 'SELECT' | 'UPDATE'
  jdbcParameters?: string
  expectedUpdateCount?: string
}

/** The serializable task shape used inside operator containers. */
export type WorkflowTaskDraft = {
  name: string
  taskReferenceName: string
  type: TaskKind
  inputParameters: Record<string, unknown>
  config?: TaskConfig
  optional: boolean
  loopOver?: WorkflowTaskDraft[]
  forkTasks?: WorkflowTaskDraft[][]
  decisionCases?: Record<string, WorkflowTaskDraft[]>
  defaultCase?: WorkflowTaskDraft[]
}

export type StudioData = {
  label: string
  ref: string
  kind: TaskKind
  detail?: string
  config?: TaskConfig
  runtimeState?: 'idle' | 'running' | 'completed'
  optional?: boolean
  onAddConnector?: () => void
  onAddBranch?: (branchName: string) => void
  onAddNested?: () => void
  onRemoveNestedTask?: (target: { ref: string; branch?: string; index?: number }) => void
  onRemove?: () => void
}

export type StudioNodeType = 'studio' | 'start' | 'end' | 'loop' | 'switch' | 'join'
export type StudioNode = Node<StudioData, StudioNodeType>

export type WorkflowDraft = {
  name: string
  description: string
  inputSchema?: string
  outputSchema?: string
  version: number
  schemaVersion: 2
  enforceSchema: boolean
  timeoutSeconds: number
  timeoutPolicy?: 'TIMEOUT_WORKFLOW' | 'TIMEOUT_TASK'
  restartable: boolean
  failureWorkflow?: string
  idempotencyStrategy: 'FAIL' | 'RETURN_EXISTING' | 'FAIL_ON_RUNNING'
  inputParameters?: WorkflowParameter[]
  outputParameters?: WorkflowParameter[]
  tasks: Array<WorkflowTaskDraft & {
    cacheConfig?: { ttlInSecond: number; key: string }
    taskDefinition?: { enforceSchema: boolean; inputSchema?: string; outputSchema?: string }
  }>
}

export type WorkflowParameter = { key: string; value: string }
export type WorkflowSettings = Pick<WorkflowDraft, 'name' | 'description' | 'inputSchema' | 'outputSchema' | 'version' | 'schemaVersion' | 'enforceSchema' | 'timeoutSeconds' | 'restartable' | 'failureWorkflow' | 'idempotencyStrategy'> & {
  inputParameters?: WorkflowParameter[]
  outputParameters?: WorkflowParameter[]
  enableStatusListener?: boolean
  timeoutPolicy?: 'TIMEOUT_WORKFLOW' | 'TIMEOUT_TASK'
  rateLimitKey?: string
  concurrentLimit?: number
}

export type WorkflowVersionSnapshot = {
  version: number
  workflow: WorkflowSettings
  nodes: StudioNode[]
  edges: Edge[]
  status: 'DRAFT' | 'PUBLISHED'
  savedAt: string
}

type WorkflowStore = {
  nodes: StudioNode[]
  edges: Edge[]
  workflow: WorkflowSettings
  dirty: boolean
  savedAt: string | null
  versionHistory: WorkflowVersionSnapshot[]
  setNodes: (nodes: StudioNode[], markDirty?: boolean) => void
  setEdges: (edges: Edge[], markDirty?: boolean) => void
  updateNodeData: (id: string, patch: Partial<StudioData>) => void
  updateWorkflow: (patch: Partial<WorkflowStore['workflow']>) => void
  markSaved: () => void
  replaceDraft: (nodes: StudioNode[], workflow?: Partial<WorkflowStore['workflow']>) => void
  recordVersionSnapshot: (snapshot: WorkflowVersionSnapshot) => void
  restoreVersionSnapshot: (snapshot: WorkflowVersionSnapshot) => void
}

const defaultInputSchema = ['{', '  "type": "object",', '  "properties": {', '    "jobId": { "type": "string" },', '    "endpointUrl": { "type": "string", "format": "uri" }', '  },', '  "required": ["jobId", "endpointUrl"]', '}'].join('\n')
const defaultOutputSchema = ['{', '  "type": "object",', '  "properties": { "status": { "type": "string" } }', '}'].join('\n')

export const useWorkflowStore = create<WorkflowStore>()(persist((set) => ({
  nodes: [],
  edges: [],
workflow: { name: 'api_polling_workflow', description: 'Submits a job to an external API, polls for its status until completed or failed, then routes based on the outcome.', inputSchema: defaultInputSchema, outputSchema: defaultOutputSchema, version: 1, schemaVersion: 2, enforceSchema: false, timeoutSeconds: 3600, restartable: true, failureWorkflow: '', idempotencyStrategy: 'FAIL', inputParameters: [{ key: 'jobSubmitUrl', value: '' }, { key: 'jobStatusUrl', value: '' }, { key: 'jobPayload', value: '' }, { key: 'maxIterations', value: '10' }, { key: 'successCallbackUrl', value: '' }, { key: 'failureCallbackUrl', value: '' }], outputParameters: [{ key: 'jobId', value: '${submit_job_ref.output.response.body.jobId}' }, { key: 'finalStatus', value: '${check_status_ref.output.response.body.status}' }, { key: '', value: '${check_status_ref.output.response.body.result}' }], enableStatusListener: false, timeoutPolicy: 'TIMEOUT_WORKFLOW', rateLimitKey: '', concurrentLimit: 0 },
  dirty: false,
  savedAt: null,
  versionHistory: [],
  setNodes: (nodes, markDirty = true) => set(markDirty ? { nodes, dirty: true } : { nodes }),
  setEdges: (edges, markDirty = true) => set(markDirty ? { edges, dirty: true } : { edges }),
  updateNodeData: (id, patch) => set((state) => ({ nodes: state.nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node), dirty: true })),
  updateWorkflow: (patch) => set((state) => ({ workflow: { ...state.workflow, ...patch }, dirty: true })),
  markSaved: () => set({ dirty: false, savedAt: new Date().toISOString() }),
  replaceDraft: (nodes, workflow) => set((state) => ({ nodes, workflow: { ...state.workflow, ...workflow }, dirty: true })),
  recordVersionSnapshot: (snapshot) => set((state) => {
    const existing = state.versionHistory.find((item) => item.version === snapshot.version && item.status === snapshot.status)
    if (snapshot.status === 'PUBLISHED' && existing) return {}
    const next = state.versionHistory.filter((item) => !(item.version === snapshot.version && item.status === snapshot.status))
    return { versionHistory: [...next, snapshot].sort((left, right) => left.version - right.version || (left.status === 'DRAFT' ? -1 : 1)) }
  }),
  restoreVersionSnapshot: (snapshot) => set({ nodes: snapshot.nodes, edges: snapshot.edges, workflow: snapshot.workflow, dirty: false, savedAt: snapshot.savedAt }),
}), { name: 'orkes-workflow-studio-draft-v2', version: 3, migrate: (persisted) => persisted, merge: (persisted, current) => { const incoming = (persisted ?? {}) as Partial<WorkflowStore>; return { ...current, ...incoming, workflow: { ...current.workflow, ...(incoming.workflow ?? {}) }, versionHistory: incoming.versionHistory ?? current.versionHistory } }, partialize: (state) => ({ nodes: state.nodes, edges: state.edges, workflow: state.workflow, dirty: state.dirty, savedAt: state.savedAt, versionHistory: state.versionHistory }) }))

export function buildWorkflowJson(nodes: StudioNode[], workflow: WorkflowStore['workflow']): WorkflowDraft {
  return {
    ...workflow,
    tasks: nodes.filter((node) => ['studio', 'loop', 'switch'].includes(node.type) || (node.type === 'join' && ['JOIN', 'EXCLUSIVE_JOIN'].includes(node.data.kind))).map((node) => ({
      name: node.data.kind === 'SIMPLE' ? node.data.config?.workerTaskName?.trim() || node.data.label : node.data.label,
      taskReferenceName: node.data.ref,
      type: node.data.kind,
       inputParameters: buildTaskInputParameters(node.data.kind, node.data.config),
      config: node.data.config,
      optional: node.data.optional ?? false,
      ...(node.data.kind === 'DO_WHILE' && node.data.config?.loopOver ? { loopOver: node.data.config.loopOver } : {}),
      ...(node.data.kind === 'SWITCH' && node.data.config?.decisionCases ? { decisionCases: node.data.config.decisionCases, defaultCase: node.data.config.defaultCase ?? [] } : {}),
      ...(node.data.kind === 'FORK_JOIN' && node.data.config?.forkBranches ? { forkTasks: node.data.config.forkBranches } : {}),
      ...(node.data.kind === 'SIMPLE' && node.data.config?.cacheTtlInSecond && node.data.config.cacheKey ? { cacheConfig: { ttlInSecond: node.data.config.cacheTtlInSecond, key: node.data.config.cacheKey } } : {}),
      ...(node.data.kind === 'SIMPLE' && node.data.config?.enforceSchema && node.data.config.inputSchema && node.data.config.outputSchema ? { taskDefinition: { enforceSchema: true, inputSchema: node.data.config.inputSchema, outputSchema: node.data.config.outputSchema } } : {}),
    })),
  }
}

function parseInputParameters(value?: string): Record<string, unknown> {
  if (!value?.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function parseConfigValue(value?: string): unknown {
  if (value == null || value === '') return undefined
  try { return JSON.parse(value) } catch { return value }
}

/** Maps the flattened editor config back to the canonical Conductor input shape. */
export function buildTaskInputParameters(kind: TaskKind, config?: TaskConfig): Record<string, unknown> {
  const source = config ?? {}
  const params = parseInputParameters(source.inputParameters)
  const set = (key: string, value: unknown) => { if (value !== undefined && value !== '') params[key] = value }
  if (kind === 'HTTP') {
    set('uri', source.url)
    set('method', source.method ?? 'GET')
    set('accept', source.accept)
    set('contentType', source.contentType)
    set('headers', parseConfigValue(source.headers))
    set('body', parseConfigValue(source.body))
    set('encode', source.encode)
    if (source.httpHedgingMaxAttempts != null) set('hedgingConfig', { maxAttempts: source.httpHedgingMaxAttempts })
  }
  if (kind === 'HTTP_POLL') {
    const request = params.http_request && typeof params.http_request === 'object' && !Array.isArray(params.http_request) ? { ...(params.http_request as Record<string, unknown>) } : {}
    if (source.url) request.uri = source.url
    request.method = source.method ?? request.method ?? 'GET'
    if (source.accept) request.accept = source.accept
    if (source.contentType) request.contentType = source.contentType
    if (source.headers) request.headers = parseConfigValue(source.headers)
    if (source.body) request.body = parseConfigValue(source.body)
    if (source.encode != null) request.encode = source.encode
    if (source.httpHedgingMaxAttempts != null) request.hedgingConfig = { maxAttempts: source.httpHedgingMaxAttempts }
    if (source.pollCondition) request.terminationCondition = source.pollCondition
    if (source.pollIntervalSeconds != null) request.pollingInterval = String(source.pollIntervalSeconds)
    request.pollingStrategy = request.pollingStrategy ?? 'FIXED'
    params.http_request = request
  }
  if (kind === 'EVENT' || kind === 'WAIT_FOR_EVENT') { set('sink', source.eventName); set('eventPayload', parseConfigValue(source.eventPayload)) }
  if (kind === 'KAFKA_PUBLISH') set('kafka_request', { topic: source.kafkaTopic ?? source.eventName, value: source.kafkaValue ?? source.eventPayload, bootStrapServers: source.kafkaBootStrapServers, headers: parseConfigValue(source.kafkaHeaders), key: source.kafkaKey, keySerializer: source.kafkaKeySerializer })
  if (kind === 'GRPC') {
    set('service', source.grpcService)
    set('method', source.grpcMethod ?? source.serviceMethod)
    set('host', source.grpcHost)
    set('port', source.grpcPort)
    set('useSSL', source.grpcUseSSL)
    set('trustCert', source.grpcTrustCert)
    set('request', parseConfigValue(source.grpcRequest))
    set('headers', parseConfigValue(source.grpcHeaders))
    set('inputType', source.grpcInputType)
    set('methodType', source.grpcMethodType)
    set('outputType', source.grpcOutputType)
    if (source.grpcHedgingMaxAttempts != null) set('hedgingConfig', { maxAttempts: source.grpcHedgingMaxAttempts })
  }
  if (kind === 'INLINE') { set('expression', source.script); set('evaluatorType', 'graaljs') }
  if (kind === 'JSON_JQ_TRANSFORM') set('queryExpression', source.jqQuery)
  if (kind === 'BUSINESS_RULE') { set('ruleFileLocation', source.ruleFileLocation); set('executionStrategy', source.executionStrategy ?? 'FIRE_FIRST'); set('inputColumns', parseConfigValue(source.inputColumns)); set('outputColumns', parseConfigValue(source.outputColumns)); set('cacheTimeoutMinutes', source.cacheTimeoutMinutes) }
  if (kind === 'SQL' || kind === 'JDBC') { set('integrationName', source.integrationName); set('schemaName', source.schemaName); set('statement', source.sqlQuery); set('parameters', parseConfigValue(source.jdbcParameters)); set('type', source.databaseType ?? 'SELECT'); set('expectedUpdateCount', source.expectedUpdateCount) }
  if (kind === 'HUMAN') { set('__humanTaskDefinition', { assignmentCompletionStrategy: 'LEAVE_OPEN', assignments: source.assignee ? [{ assignee: source.assignee }] : [], formKey: source.formKey }) }
  if (kind === 'FORK_JOIN') set('forkTasks', source.forkBranches)
  if (kind === 'FORK_JOIN_DYNAMIC') { set('dynamicForkTasksParam', source.dynamicForkTasksParam); set('dynamicForkTasksInputParamName', source.dynamicForkTasksInputParamName) }
  if (kind === 'DYNAMIC') set('dynamicTaskNameParam', source.dynamicTaskNameParam)
  if (kind === 'SUB_WORKFLOW') set('subWorkflowParam', { name: source.subWorkflowName, version: source.subWorkflowVersion })
  if (kind === 'START_WORKFLOW') set('startWorkflow', { name: source.startWorkflowName, version: source.startWorkflowVersion, input: {} })
  if (kind === 'TERMINATE') set('terminationReason', source.terminationReason)
  if (kind === 'TERMINATE_WORKFLOW') { set('workflowId', source.workflowId); set('terminationReason', source.terminationReason); set('triggerFailureWorkflow', false) }
  if (kind === 'WAIT') set('durationSeconds', source.durationSeconds ?? 30)
  if (kind === 'WAIT_FOR_WEBHOOK') { set('webhookName', source.eventName); set('matches', parseConfigValue(source.eventPayload)) }
  if (kind === 'SET_VARIABLE') { set('name', source.variableName); set('value', source.variableValue) }
  if (kind === 'GET_WORKFLOW') { set('id', source.workflowId); set('includeTasks', false) }
  if (kind === 'GET_SIGNED_JWT') { ;(['subject', 'issuer', 'privateKey', 'privateKeyId', 'audience', 'ttlInSecond', 'scopes', 'algorithm'] as const).forEach((key) => set(key, source[key])) }
  if (kind === 'UPDATE_SECRET') set('_secrets', { secretKey: source.secretKey, secretValue: source.secretValue })
  if (kind === 'UPDATE_TASK') { ;(['taskStatus', 'taskRefName', 'mergeOutput', 'workflowId'] as const).forEach((key) => set(key, source[key])) }
  if (kind === 'QUERY_PROCESSOR') { ;(['workflowNames', 'statuses', 'correlationIds', 'queryType'] as const).forEach((key) => set(key, source[key])) }
  if (kind === 'OPS_GENIE') { set('alias', source.alias); set('message', source.content); set('description', source.description) }
  if (kind === 'GET_DOCUMENT') set('url', source.url)
  if (kind === 'LIST_FILES') { set('inputLocation', source.inputLocation); set('fileTypes', source.fileTypes) }
  if (kind === 'PARSE_DOCUMENT') { set('integrationName', source.integrationName); set('url', source.url); set('mediaType', source.mediaType); set('chunkSize', source.chunkSize) }
  if (kind === 'AGENT' || kind === 'GET_AGENT_CARD' || kind === 'CANCEL_AGENT') { set('agentType', source.agentType); set('agentUrl', source.agentUrl); set('taskId', source.taskId); set('text', source.text); set('pollIntervalSeconds', source.pollIntervalSeconds) }
  if (kind === 'SENDGRID') { set('from', source.from); set('to', source.to); set('subject', source.subjectLine); set('contentType', source.contentType); set('content', source.content); set('sendgridConfiguration', source.sendgridConfiguration) }
  if (kind === 'CHUNK_TEXT') { set('text', source.text); set('chunkSize', source.chunkSize); set('mediaType', source.mediaType) }
  if (kind === 'INTEGRATION' || kind === 'MCP_REMOTE') { set('integrationName', source.integrationName); set('operation', source.operation) }
  if (kind.startsWith('LLM_')) {
    ;(['llmProvider', 'model', 'promptName', 'instructions', 'text', 'vectorDB', 'index', 'namespace', 'embeddingModelProvider', 'embeddingModel', 'docId', 'query', 'mediaType'] as const).forEach((key) => set(key, source[key]))
    ;(['messages', 'promptVariables', 'stopWords', 'jsonOutput', 'embeddings'] as const).forEach((key) => set(key, parseConfigValue(source[key])))
    ;(['temperature', 'topP', 'maxTokens', 'dimensions', 'maxResults', 'chunkSize', 'chunkOverlap'] as const).forEach((key) => set(key, source[key]))
  }
  return params
}

export function validateWorkflow(nodes: StudioNode[], edges: Edge[]) {
  const problems: Array<{ severity: 'error' | 'warning'; message: string; nodeId?: string }> = []
  const taskNodes = nodes.filter((node) => node.type === 'studio' || node.type === 'switch' || node.type === 'loop')
  const refs = new Set(taskNodes.map((node) => node.data.ref).filter(Boolean))
  taskNodes.forEach((node) => {
    if (!node.data.label.trim()) problems.push({ severity: 'error', message: 'Task name is required.', nodeId: node.id })
    if (!node.data.ref.trim()) problems.push({ severity: 'error', message: `${node.data.label || 'Task'} needs a reference name.`, nodeId: node.id })
    if (taskNodes.filter((candidate) => candidate.data.ref === node.data.ref).length > 1) problems.push({ severity: 'error', message: `Duplicate reference name: ${node.data.ref}.`, nodeId: node.id })
    if (node.data.kind === 'HTTP' && !node.data.config?.url && node.data.label !== 'handle_failure' && node.data.label !== 'handle_success') problems.push({ severity: 'warning', message: `${node.data.label} has no HTTP URL configured.`, nodeId: node.id })
    if (node.data.kind === 'SIMPLE' && !node.data.config?.workerTaskName) problems.push({ severity: 'warning', message: `${node.data.label} has no worker task dependency configured.`, nodeId: node.id })
    if (node.data.kind === 'SIMPLE' && ((node.data.config?.cacheTtlInSecond && !node.data.config.cacheKey) || (node.data.config?.cacheKey && !node.data.config.cacheTtlInSecond))) problems.push({ severity: 'warning', message: `${node.data.label} cache settings need both a TTL and an input-based key.`, nodeId: node.id })
    if (node.data.kind === 'SIMPLE' && node.data.config?.enforceSchema && (!node.data.config.inputSchema || !node.data.config.outputSchema)) problems.push({ severity: 'warning', message: `${node.data.label} schema enforcement needs input and output schema names.`, nodeId: node.id })
    if (node.data.kind === 'EVENT' && !node.data.config?.eventName) problems.push({ severity: 'warning', message: `${node.data.label} has no event integration configured.`, nodeId: node.id })
    if (node.data.kind === 'GRPC' && !node.data.config?.serviceMethod) problems.push({ severity: 'warning', message: `${node.data.label} has no gRPC service method configured.`, nodeId: node.id })
    if (node.data.kind === 'SQL' && !node.data.config?.sqlQuery) problems.push({ severity: 'warning', message: `${node.data.label} has no SQL dependency configured.`, nodeId: node.id })
    if (node.data.kind === 'HUMAN' && !node.data.config?.formKey) problems.push({ severity: 'warning', message: `${node.data.label} has no user form dependency configured.`, nodeId: node.id })
    if ((node.data.kind === 'AI_CHAT_COMPLETION' || node.data.kind === 'AI_GENERATE_IMAGE') && !node.data.config?.prompt) problems.push({ severity: 'warning', message: `${node.data.label} has no AI prompt dependency configured.`, nodeId: node.id })
    if (node.data.kind === 'DO_WHILE' && !node.data.config?.loopCondition) problems.push({ severity: 'warning', message: `${node.data.label} has no loop condition configured.`, nodeId: node.id })
    if (node.data.kind === 'SWITCH' && !(node.data.config?.cases?.length)) problems.push({ severity: 'warning', message: `${node.data.label} has no decision cases configured.`, nodeId: node.id })
    const expressions = [node.data.config?.url, node.data.config?.headers, node.data.config?.body, node.data.config?.inputParameters, node.data.config?.eventPayload, node.data.config?.cacheKey, node.data.config?.loopCondition, node.data.config?.variableValue, node.data.config?.workflowId, node.data.config?.pollCondition].filter((value): value is string => Boolean(value)).flatMap((value) => validateExpressions(value, [...refs]))
    expressions.forEach((message) => problems.push({ severity: 'warning', message, nodeId: node.id }))
  })
  const starts = nodes.filter((node) => node.type === 'start')
  const ends = nodes.filter((node) => node.type === 'end')
  const nodeIds = new Set(nodes.map((node) => node.id))
  edges.filter((item) => !nodeIds.has(item.source) || !nodeIds.has(item.target)).forEach((item) => problems.push({ severity: 'error', message: `Connection ${item.id} points to a missing node.` }))
  if (starts.length === 0) problems.push({ severity: 'error', message: 'Workflow must have a Start node.' })
  if (starts.length > 1) problems.push({ severity: 'error', message: 'Workflow must have exactly one Start node.' })
  if (ends.length === 0) problems.push({ severity: 'error', message: 'Workflow must have an End node.' })
  if (ends.length > 1) problems.push({ severity: 'warning', message: 'Multiple End nodes detected; verify the terminal paths.' })
  const start = starts[0]
  const end = ends[0]
  if (start && !edges.some((item) => item.source === start.id)) problems.push({ severity: 'error', message: 'Start node is not connected.', nodeId: start.id })
  if (end && !edges.some((item) => item.target === end.id)) problems.push({ severity: 'error', message: 'End node is not connected.', nodeId: end.id })
  if (start) {
    const reachable = new Set<string>([start.id])
    for (let pass = 0; pass < nodes.length; pass += 1) edges.forEach((item) => { if (reachable.has(item.source)) reachable.add(item.target) })
    taskNodes.filter((node) => !reachable.has(node.id)).forEach((node) => problems.push({ severity: 'warning', message: `${node.data.label} is unreachable from Start.`, nodeId: node.id }))
  }
  const outgoing = new Map<string, string[]>()
  edges.forEach((item) => { if (nodeIds.has(item.source) && nodeIds.has(item.target)) outgoing.set(item.source, [...(outgoing.get(item.source) ?? []), item.target]) })
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const cycle = (outgoing.get(id) ?? []).some(visit)
    visiting.delete(id)
    visited.add(id)
    return cycle
  }
  if ([...nodeIds].some(visit)) problems.push({ severity: 'error', message: 'Workflow graph contains a circular reference. Use a Do While operator for intentional loops.' })
  return problems
}
