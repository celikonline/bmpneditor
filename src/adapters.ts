import type { Edge } from '@xyflow/react'
import { buildWorkflowJson, type StudioNode, type TaskConfig, type TaskKind, type WorkflowSettings, type WorkflowTaskDraft } from './workflowStore'
import { isOfficialTaskKind } from './conductor/taskTypes'
import { taskNodeType } from './conductor/taskGenerator'

export type ConductorCompatibleTask = {
  name: string
  taskReferenceName: string
  type: TaskKind
  inputParameters: Record<string, unknown>
  config?: TaskConfig
  optional?: boolean
  retryCount?: number
  retryLogic?: TaskConfig['retryLogic']
  retryDelaySeconds?: number
  maxRetryDelaySeconds?: number
  backoffJitterMs?: number
  totalTimeoutSeconds?: number
  timeoutSeconds?: number
  responseTimeoutSeconds?: number
  pollTimeoutSeconds?: number
  taskTimeoutPolicy?: TaskConfig['taskTimeoutPolicy']
  loopOver?: ConductorCompatibleTask[]
  decisionCases?: Record<string, ConductorCompatibleTask[]>
  defaultCase?: ConductorCompatibleTask[]
  forkTasks?: ConductorCompatibleTask[][]
  cacheConfig?: { ttlInSecond: number; key: string }
  taskDefinition?: { enforceSchema: boolean; inputSchema?: string; outputSchema?: string }
  workerDomain?: string
  callbackAfterSeconds?: number
  rateLimitPerFrequency?: number
  rateLimitFrequencyInSeconds?: number
  concurrentExecLimit?: number
  inputKeys?: string[]
  outputKeys?: string[]
}

export type ConductorCompatibleWorkflowDefinition = {
  name: string
  description?: string
  version: number
  schemaVersion: 2
  tasks: ConductorCompatibleTask[]
  inputParameters?: Array<string | { key: string; value: string }>
  outputParameters?: Record<string, unknown>
  timeoutPolicy?: 'TIME_OUT_WF' | 'ALERT_ONLY'
  timeoutSeconds?: number
  restartable?: boolean
  failureWorkflow?: string
  enforceSchema?: boolean
  inputSchema?: unknown
  outputSchema?: unknown
}

export interface WorkflowAdapter<TExternal> {
  import(source: TExternal): ImportReview
  export(nodes: StudioNode[], workflow: WorkflowSettings): TExternal
  validate?(source: TExternal): { valid: boolean; errors: string[]; warnings: string[] }
}

export type ImportReview = {
  nodes: StudioNode[]
  edges: Edge[]
  warnings: string[]
  errors: string[]
  workflow?: Partial<WorkflowSettings>
}

/** Converts the canonical draft graph to a BPMN 2.0 compatible interchange document. */
export function workflowToBpmn(nodes: StudioNode[], workflowName: string, edges: Edge[] = []) {
  const elements = nodes.map((node) => {
    const safe = escapeXml(node.data.label)
    if (node.type === 'start') return `<bpmn:startEvent id="${escapeXml(node.id)}" name="${safe}" />`
    if (node.type === 'end') return `<bpmn:endEvent id="${escapeXml(node.id)}" name="${safe}" />`
    if (node.type === 'switch') return `<bpmn:exclusiveGateway id="${escapeXml(node.id)}" name="${safe}" data-reference-name="${escapeXml(node.data.ref)}" />`
    if (node.type === 'join') return `<bpmn:parallelGateway id="${escapeXml(node.id)}" name="${safe}" />`
    return `<bpmn:serviceTask id="${escapeXml(node.id)}" name="${safe}" data-task-type="${escapeXml(node.data.kind)}" data-reference-name="${escapeXml(node.data.ref)}" />`
  })
  const flows = edges
    .filter((item) => nodes.some((node) => node.id === item.source) && nodes.some((node) => node.id === item.target))
    .map((item, index) => `<bpmn:sequenceFlow id="${escapeXml(item.id || `flow_${index + 1}`)}" sourceRef="${escapeXml(item.source)}" targetRef="${escapeXml(item.target)}"${item.label ? ` name="${escapeXml(String(item.label))}"` : ''} />`)
  const shapes = nodes.map((node) => {
    const geometry = node.type === 'start' || node.type === 'end' ? { width: 36, height: 36 } : node.type === 'switch' || node.type === 'join' ? { width: 54, height: 54 } : { width: 180, height: 76 }
    return `<bpmndi:BPMNShape id="${escapeXml(node.id)}_di" bpmnElement="${escapeXml(node.id)}"><dc:Bounds x="${Math.round(node.position.x)}" y="${Math.round(node.position.y)}" width="${geometry.width}" height="${geometry.height}" /></bpmndi:BPMNShape>`
  })
  const diEdges = edges
    .filter((item) => nodes.some((node) => node.id === item.source) && nodes.some((node) => node.id === item.target))
    .map((item, index) => {
      const source = nodes.find((node) => node.id === item.source)!
      const target = nodes.find((node) => node.id === item.target)!
      const sourceX = Math.round(source.position.x + (source.type === 'start' || source.type === 'end' ? 18 : source.type === 'switch' || source.type === 'join' ? 27 : 90))
      const sourceY = Math.round(source.position.y + (source.type === 'start' || source.type === 'end' ? 36 : source.type === 'switch' || source.type === 'join' ? 54 : 76))
      const targetX = Math.round(target.position.x + (target.type === 'start' || target.type === 'end' ? 18 : target.type === 'switch' || target.type === 'join' ? 27 : 90))
      const targetY = Math.round(target.position.y)
      return `<bpmndi:BPMNEdge id="${escapeXml(item.id || `flow_${index + 1}`)}_di" bpmnElement="${escapeXml(item.id || `flow_${index + 1}`)}"><di:waypoint x="${sourceX}" y="${sourceY}" /><di:waypoint x="${targetX}" y="${targetY}" /></bpmndi:BPMNEdge>`
    })
  const processId = escapeXml(workflowName)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${Date.now()}">\n  <bpmn:process id="${processId}" isExecutable="true">\n  ${elements.join('\n  ')}\n  ${flows.join('\n  ')}\n  </bpmn:process>\n  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}"><bpmndi:BPMNPlane id="BPMNPlane_${processId}" bpmnElement="${processId}">\n    ${shapes.join('\n    ')}\n    ${diEdges.join('\n    ')}\n  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>\n</bpmn:definitions>`
}

/** Converts BPMN XML into canonical nodes and edges for a human-reviewed import step. */
export function bpmnToWorkflow(xml: string): ImportReview {
  const warnings: string[] = []
  const errors: string[] = []
  const parser = new DOMParser()
  const document = parser.parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) return { nodes: [], edges: [], warnings: [], errors: ['The selected file is not valid BPMN XML.'] }

  const allElements = Array.from(document.getElementsByTagName('*'))
  const flowElements = allElements.filter((element) => isSupportedElement(element.localName))
  const sequenceFlows = allElements.filter((element) => element.localName === 'sequenceFlow')
  const unsupported = [...new Set(allElements.map((element) => element.localName).filter((name) => isFlowElement(name) && !isSupportedElement(name) && name !== 'sequenceFlow'))]
  unsupported.forEach((name) => warnings.push(`Unsupported BPMN element skipped: ${name}.`))

  const starts = flowElements.filter((element) => element.localName === 'startEvent')
  if (starts.length !== 1) errors.push(`BPMN import requires exactly one start event; found ${starts.length}.`)
  if (!flowElements.some((element) => element.localName === 'endEvent')) warnings.push('No end event was found. Add an End node during conversion review.')
  if (flowElements.length === 0) errors.push('No supported BPMN flow elements were found.')

  const nodes: StudioNode[] = flowElements.map((element, index) => {
    const type: StudioNode['type'] = element.localName === 'startEvent' ? 'start' : element.localName === 'endEvent' ? 'end' : element.localName === 'exclusiveGateway' ? 'switch' : element.localName === 'parallelGateway' ? 'join' : 'studio'
    const declaredKind = element.getAttribute('data-task-type') as TaskKind | null
    const kind: TaskKind = type === 'switch' ? 'SWITCH' : type === 'join' || type === 'start' || type === 'end' ? 'SIMPLE' : isOfficialTaskKind(declaredKind) ? declaredKind : element.localName === 'userTask' ? 'HUMAN' : 'SIMPLE'
    const label = element.getAttribute('name') || `${element.localName}_${index + 1}`
    const ref = element.getAttribute('data-reference-name') || `${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_ref`
    return { id: element.getAttribute('id') || `${type}-${index}`, type, position: { x: 180, y: 50 + index * 120 }, data: { label, ref, kind, config: type === 'switch' ? { expression: '', cases: [] } : {} } }
  })

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges: Edge[] = []
  sequenceFlows.forEach((flow, index) => {
    const source = flow.getAttribute('sourceRef')
    const target = flow.getAttribute('targetRef')
    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) {
      warnings.push(`Sequence flow ${flow.getAttribute('id') || index + 1} could not be mapped to supported nodes.`)
      return
    }
    edges.push({ id: flow.getAttribute('id') || `flow_${index + 1}`, source, target, type: 'smoothstep', label: flow.getAttribute('name') || undefined })
  })
  if (nodes.length > 1 && sequenceFlows.length === 0) warnings.push('No sequence flows were found; imported nodes are not connected.')

  const casesByGateway = new Map<string, string[]>()
  sequenceFlows.forEach((flow) => {
    const source = flow.getAttribute('sourceRef')
    const label = flow.getAttribute('name')
    if (source && label && nodes.some((node) => node.id === source && node.type === 'switch')) {
      casesByGateway.set(source, [...(casesByGateway.get(source) ?? []), label])
    }
  })
  const finalizedNodes = nodes.map((node) => node.type === 'switch' ? { ...node, data: { ...node.data, config: { ...node.data.config, cases: casesByGateway.get(node.id) ?? [] } } } : node)
  return { nodes: finalizedNodes, edges, warnings, errors }
}

export function toConductorDefinition(nodes: StudioNode[], workflowName: string, version = 1, settings?: Partial<WorkflowSettings>): ConductorCompatibleWorkflowDefinition {
  const workflow = {
    name: workflowName,
    description: '',
    schemaVersion: 2 as const,
    enforceSchema: false,
    timeoutSeconds: 0,
    restartable: true,
    failureWorkflow: '',
    idempotencyStrategy: 'FAIL' as const,
    ...settings,
    version,
  } as WorkflowSettings
  const canonical = buildWorkflowJson(nodes, workflow)
  return {
    name: canonical.name,
    ...(canonical.description ? { description: canonical.description } : {}),
    version: canonical.version,
    schemaVersion: 2,
    tasks: canonical.tasks.map(toConductorTask),
    ...(canonical.inputParameters ? { inputParameters: canonical.inputParameters.map((parameter) => parameter.key).filter(Boolean) } : {}),
    ...(canonical.outputParameters ? { outputParameters: Object.fromEntries(canonical.outputParameters.filter((parameter) => parameter.key).map((parameter) => [parameter.key, parameter.value])) } : {}),
    ...(canonical.timeoutPolicy ? { timeoutPolicy: canonical.timeoutPolicy === 'TIMEOUT_WORKFLOW' ? 'TIME_OUT_WF' : 'ALERT_ONLY' } : {}),
    ...(canonical.timeoutSeconds != null ? { timeoutSeconds: canonical.timeoutSeconds } : {}),
    ...(canonical.restartable != null ? { restartable: canonical.restartable } : {}),
    ...(canonical.failureWorkflow ? { failureWorkflow: canonical.failureWorkflow } : {}),
    ...(canonical.enforceSchema != null ? { enforceSchema: canonical.enforceSchema } : {}),
    ...(canonical.inputSchema ? { inputSchema: safeJson(canonical.inputSchema) } : {}),
    ...(canonical.outputSchema ? { outputSchema: safeJson(canonical.outputSchema) } : {}),
  }
}

function toConductorTask(task: WorkflowTaskDraft & { cacheConfig?: { ttlInSecond: number; key: string }; taskDefinition?: { enforceSchema: boolean; inputSchema?: string; outputSchema?: string } }): ConductorCompatibleTask {
  const config = task.config ?? {}
  const result: ConductorCompatibleTask = {
    name: task.name,
    taskReferenceName: task.taskReferenceName,
    type: task.type,
    inputParameters: task.inputParameters,
    optional: task.optional,
    ...pickTaskPolicy(config),
    ...(task.cacheConfig ? { cacheConfig: task.cacheConfig } : {}),
    ...(task.taskDefinition ? { taskDefinition: task.taskDefinition } : {}),
    ...pickWorkerPolicy(config),
    ...pickDataMapping(config),
  }
  if (task.type === 'DO_WHILE' && task.loopOver) result.loopOver = task.loopOver.map(toConductorTask)
  if (task.type === 'SWITCH') {
    result.decisionCases = Object.fromEntries(Object.entries(task.decisionCases ?? {}).map(([branch, children]) => [branch, children.map(toConductorTask)]))
    result.defaultCase = (task.defaultCase ?? []).map(toConductorTask)
  }
  if (task.type === 'FORK_JOIN' && task.forkTasks) result.forkTasks = task.forkTasks.map((branch) => branch.map(toConductorTask))
  return result
}

function pickTaskPolicy(config: TaskConfig): Pick<ConductorCompatibleTask, 'retryCount' | 'retryLogic' | 'retryDelaySeconds' | 'maxRetryDelaySeconds' | 'backoffJitterMs' | 'totalTimeoutSeconds' | 'timeoutSeconds' | 'responseTimeoutSeconds' | 'pollTimeoutSeconds' | 'taskTimeoutPolicy'> {
  const keys = ['retryCount', 'retryLogic', 'retryDelaySeconds', 'maxRetryDelaySeconds', 'backoffJitterMs', 'totalTimeoutSeconds', 'timeoutSeconds', 'responseTimeoutSeconds', 'pollTimeoutSeconds', 'taskTimeoutPolicy'] as const
  return Object.fromEntries(keys.filter((key) => config[key] != null).map((key) => [key, config[key]])) as Pick<ConductorCompatibleTask, typeof keys[number]>
}

function pickWorkerPolicy(config: TaskConfig): Pick<ConductorCompatibleTask, 'workerDomain' | 'callbackAfterSeconds' | 'rateLimitPerFrequency' | 'rateLimitFrequencyInSeconds' | 'concurrentExecLimit'> {
  const keys = ['workerDomain', 'callbackAfterSeconds', 'rateLimitPerFrequency', 'rateLimitFrequencyInSeconds', 'concurrentExecLimit'] as const
  return Object.fromEntries(keys.filter((key) => config[key] != null).map((key) => [key, config[key]])) as Pick<ConductorCompatibleTask, typeof keys[number]>
}

function pickDataMapping(config: TaskConfig): Pick<ConductorCompatibleTask, 'inputKeys' | 'outputKeys'> {
  return {
    ...(config.inputKeys?.length ? { inputKeys: config.inputKeys } : {}),
    ...(config.outputKeys?.length ? { outputKeys: config.outputKeys } : {}),
  }
}

type GraphImport = ImportReview & { workflow: Partial<WorkflowSettings> }

/** Rebuilds the top-level graph from canonical studio JSON or Conductor JSON. */
export function conductorJsonToGraph(source: unknown, existingNodes: StudioNode[] = []): GraphImport {
  const warnings: string[] = []
  const errors: string[] = []
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { nodes: [], edges: [], warnings, errors: ['Workflow JSON must be an object.'], workflow: {} }
  const candidate = source as Partial<ConductorCompatibleWorkflowDefinition> & { tasks?: unknown }
  if (!Array.isArray(candidate.tasks)) return { nodes: [], edges: [], warnings, errors: ['tasks must be an array.'], workflow: workflowFromConductor(candidate) }

  const tasks: ConductorCompatibleTask[] = []
  const refs = new Set<string>()
  candidate.tasks.forEach((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(`Task ${index + 1} must be an object.`); return }
    const task = value as Partial<ConductorCompatibleTask>
    const ref = String(task.taskReferenceName ?? '').trim()
    const kind = task.type
    if (!ref) errors.push(`Task ${index + 1} is missing taskReferenceName.`)
    if (typeof kind !== 'string' || !isSupportedTaskKind(kind)) errors.push(`Task ${ref || index + 1} has unknown task type: ${String(kind)}.`)
    if (ref && refs.has(ref)) errors.push(`Duplicate task reference name: ${ref}.`)
    if (ref) refs.add(ref)
    if (typeof kind === 'string' && isSupportedTaskKind(kind)) validateNestedTasks(task, ref || `Task ${index + 1}`, refs, errors)
    if (ref && typeof kind === 'string' && isSupportedTaskKind(kind)) tasks.push({ ...task, name: String(task.name ?? ref), taskReferenceName: ref, type: kind, inputParameters: task.inputParameters && typeof task.inputParameters === 'object' && !Array.isArray(task.inputParameters) ? task.inputParameters : {} } as ConductorCompatibleTask)
  })
  if (errors.length) return { nodes: [], edges: [], warnings, errors, workflow: workflowFromConductor(candidate) }

  const oldStart = existingNodes.find((node) => node.type === 'start')
  const oldEnd = existingNodes.find((node) => node.type === 'end')
  const start: StudioNode = oldStart ?? { id: 'start', type: 'start', position: { x: 220, y: 35 }, data: { label: 'Start', ref: 'start_ref', kind: 'START', config: {} } }
  const end: StudioNode = oldEnd ?? { id: 'end', type: 'end', position: { x: 220, y: 220 + tasks.length * 145 }, data: { label: 'End', ref: 'end_ref', kind: 'SIMPLE', config: {} } }
  const oldByRef = new Map(existingNodes.map((node) => [node.data.ref, node]))
  const importedTasks = tasks.map((task, index) => {
    const previous = oldByRef.get(task.taskReferenceName)
    return {
      id: previous?.id ?? task.taskReferenceName,
      type: taskNodeType(task.type),
      position: previous?.position ?? { x: 220, y: 110 + index * 145 },
      data: { label: task.name, ref: task.taskReferenceName, kind: task.type, optional: task.optional ?? false, detail: previous?.data.detail, config: configFromConductorTask(task) },
    } satisfies StudioNode
  })
  const nodes = [start, ...importedTasks, end]
  const edges = nodes.slice(1).map((node, index) => ({ id: `conductor-${nodes[index].id}-${node.id}`, source: nodes[index].id, target: node.id, type: 'smoothstep' as const }))
  return { nodes, edges, warnings, errors, workflow: workflowFromConductor(candidate) }
}

function validateNestedTasks(task: Partial<ConductorCompatibleTask>, parent: string, refs: Set<string>, errors: string[]) {
  const groups: Array<[string, unknown]> = [['loopOver', task.loopOver], ['defaultCase', task.defaultCase]]
  if (task.decisionCases) groups.push(...Object.entries(task.decisionCases))
  if (task.forkTasks) task.forkTasks.forEach((branch, index) => groups.push([`fork:${index}`, branch]))
  groups.forEach(([name, value]) => {
    if (value == null) return
    if (!Array.isArray(value)) { errors.push(`${parent}.${name} must be an array.`); return }
    value.forEach((childValue, index) => {
      if (!childValue || typeof childValue !== 'object' || Array.isArray(childValue)) { errors.push(`${parent}.${name}[${index}] must be a task object.`); return }
      const child = childValue as Partial<ConductorCompatibleTask>
      const ref = String(child.taskReferenceName ?? '').trim()
      const kind = child.type
      if (!ref) errors.push(`${parent}.${name}[${index}] is missing taskReferenceName.`)
      if (typeof kind !== 'string' || !isSupportedTaskKind(kind)) errors.push(`${parent}.${name}[${index}] has unknown task type: ${String(kind)}.`)
      if (ref && refs.has(ref)) errors.push(`Duplicate task reference name: ${ref}.`)
      if (ref) refs.add(ref)
      if (typeof kind === 'string' && isSupportedTaskKind(kind)) validateNestedTasks(child, ref || `${parent}.${name}[${index}]`, refs, errors)
    })
  })
}

function workflowFromConductor(source: Partial<ConductorCompatibleWorkflowDefinition>): Partial<WorkflowSettings> {
  const inputParameters = Array.isArray(source.inputParameters) ? source.inputParameters.map((parameter) => typeof parameter === 'string' ? { key: parameter, value: '' } : parameter).filter((parameter) => parameter.key) : undefined
  const outputParameters = source.outputParameters && typeof source.outputParameters === 'object' && !Array.isArray(source.outputParameters)
    ? Object.entries(source.outputParameters).map(([key, value]) => ({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }))
    : undefined
  return {
    ...(typeof source.name === 'string' ? { name: source.name } : {}),
    ...(typeof source.description === 'string' ? { description: source.description } : {}),
    ...(typeof source.version === 'number' ? { version: source.version } : {}),
    ...(typeof source.schemaVersion === 'number' ? { schemaVersion: source.schemaVersion as 2 } : {}),
    ...(typeof source.enforceSchema === 'boolean' ? { enforceSchema: source.enforceSchema } : {}),
    ...(typeof source.timeoutSeconds === 'number' ? { timeoutSeconds: source.timeoutSeconds } : {}),
    ...(typeof source.timeoutPolicy === 'string' ? { timeoutPolicy: source.timeoutPolicy === 'TIME_OUT_WF' ? 'TIMEOUT_WORKFLOW' : 'TIMEOUT_TASK' } : {}),
    ...(typeof source.restartable === 'boolean' ? { restartable: source.restartable } : {}),
    ...(typeof source.failureWorkflow === 'string' ? { failureWorkflow: source.failureWorkflow } : {}),
    ...(inputParameters ? { inputParameters } : {}),
    ...(outputParameters ? { outputParameters } : {}),
    ...(source.inputSchema != null ? { inputSchema: schemaText(source.inputSchema) } : {}),
    ...(source.outputSchema != null ? { outputSchema: schemaText(source.outputSchema) } : {}),
  }
}

function schemaText(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

export const conductorAdapter: WorkflowAdapter<ConductorCompatibleWorkflowDefinition> = {
  import(source) {
    return conductorJsonToGraph(source)
  },
  validate(source) {
    const review = conductorJsonToGraph(source)
    return { valid: review.errors.length === 0, errors: review.errors, warnings: review.warnings }
  },
  export(nodes, workflow) {
    return toConductorDefinition(nodes, workflow.name, workflow.version, workflow)
  },
}

function fromConductorTask(task: ConductorCompatibleTask): WorkflowTaskDraft {
  return {
    name: task.name,
    taskReferenceName: task.taskReferenceName,
    type: task.type,
    inputParameters: task.inputParameters,
    config: configFromConductorTask(task),
    optional: task.optional ?? false,
    ...(task.loopOver ? { loopOver: task.loopOver.map(fromConductorTask) } : {}),
    ...(task.forkTasks ? { forkTasks: task.forkTasks.map((branch) => branch.map(fromConductorTask)) } : {}),
    ...(task.decisionCases ? { decisionCases: Object.fromEntries(Object.entries(task.decisionCases).map(([branch, children]) => [branch, children.map(fromConductorTask)])) } : {}),
    ...(task.defaultCase ? { defaultCase: task.defaultCase.map(fromConductorTask) } : {}),
  }
}

function configFromConductorTask(task: ConductorCompatibleTask): TaskConfig {
  const input = task.inputParameters ?? {}
  const config: TaskConfig = { ...(task.config ?? {}), inputParameters: JSON.stringify(input) }
  const assign = (key: keyof TaskConfig, value: unknown) => { if (value !== undefined) config[key] = value as never }
  const text = (value: unknown) => typeof value === 'string' ? value : value == null ? undefined : String(value)
  const jsonText = (value: unknown) => value == null ? undefined : typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  const request = input.http_request && typeof input.http_request === 'object' && !Array.isArray(input.http_request) ? input.http_request as Record<string, unknown> : undefined
  if (task.type === 'HTTP') { assign('url', text(input.uri)); assign('method', text(input.method)); assign('headers', jsonText(input.headers)); assign('body', jsonText(input.body)) }
  if (task.type === 'HTTP_POLL' && request) { assign('url', text(request.uri)); assign('method', text(request.method)); assign('pollCondition', text(request.terminationCondition)); assign('pollIntervalSeconds', Number(request.pollingInterval ?? 30)) }
  if (task.type === 'EVENT' || task.type === 'KAFKA_PUBLISH' || task.type === 'WAIT_FOR_EVENT') { assign('eventName', text(input.sink)); assign('eventPayload', jsonText(input.eventPayload)) }
  if (task.type === 'GRPC') assign('serviceMethod', text(input.serviceMethod))
  if (task.type === 'INLINE') assign('script', text(input.expression))
  if (task.type === 'JSON_JQ_TRANSFORM') assign('jqQuery', text(input.queryExpression))
  if (task.type === 'BUSINESS_RULE') assign('ruleName', text(input.ruleName))
  if (task.type === 'SQL' || task.type === 'JDBC') { assign('integrationName', text(input.integrationName)); assign('sqlQuery', text(input.statement)) }
  if (task.type === 'HUMAN') { const definition = input.__humanTaskDefinition as Record<string, unknown> | undefined; const assignments = Array.isArray(definition?.assignments) ? definition?.assignments : []; assign('assignee', text((assignments[0] as Record<string, unknown> | undefined)?.assignee)); assign('formKey', text(definition?.formKey)) }
  if (task.type === 'FORK_JOIN_DYNAMIC') { assign('dynamicForkTasksParam', text(input.dynamicForkTasksParam)); assign('dynamicForkTasksInputParamName', text(input.dynamicForkTasksInputParamName)) }
  if (task.type === 'DYNAMIC') assign('dynamicTaskNameParam', text(input.dynamicTaskNameParam))
  if (task.type === 'SUB_WORKFLOW') { const value = input.subWorkflowParam as Record<string, unknown> | undefined; assign('subWorkflowName', text(value?.name)); assign('subWorkflowVersion', value?.version == null ? undefined : Number(value.version)) }
  if (task.type === 'START_WORKFLOW') { const value = input.startWorkflow as Record<string, unknown> | undefined; assign('startWorkflowName', text(value?.name)); assign('startWorkflowVersion', value?.version == null ? undefined : Number(value.version)) }
  if (task.type === 'TERMINATE' || task.type === 'TERMINATE_WORKFLOW') { assign('terminationReason', text(input.terminationReason)); if (task.type === 'TERMINATE_WORKFLOW') assign('workflowId', text(input.workflowId)) }
  if (task.type === 'WAIT') assign('durationSeconds', Number(input.durationSeconds ?? 30))
  if (task.type === 'WAIT_FOR_WEBHOOK') { assign('eventName', text(input.webhookName)); assign('eventPayload', jsonText(input.matches)) }
  if (task.type === 'SET_VARIABLE') { assign('variableName', text(input.name)); assign('variableValue', text(input.value)) }
  if (task.type === 'GET_WORKFLOW') assign('workflowId', text(input.id))
  if (task.type === 'GET_SIGNED_JWT') { ;(['subject', 'issuer', 'privateKey', 'privateKeyId', 'audience', 'algorithm'] as const).forEach((key) => assign(key, text(input[key]))); assign('ttlInSecond', input.ttlInSecond == null ? undefined : Number(input.ttlInSecond)); assign('scopes', Array.isArray(input.scopes) ? input.scopes.map(String) : undefined) }
  if (task.type === 'UPDATE_TASK') { ;(['taskStatus', 'taskRefName', 'workflowId'] as const).forEach((key) => assign(key, text(input[key]))); assign('mergeOutput', Boolean(input.mergeOutput)) }
  if (task.type === 'QUERY_PROCESSOR') { ;(['queryType'] as const).forEach((key) => assign(key, text(input[key]))); ;(['workflowNames', 'statuses', 'correlationIds'] as const).forEach((key) => assign(key, Array.isArray(input[key]) ? input[key]?.map(String) : undefined)) }
  if (task.type === 'OPS_GENIE') { assign('alias', text(input.alias)); assign('content', text(input.message)); assign('description', text(input.description)) }
  if (task.type === 'GET_DOCUMENT') assign('url', text(input.url))
  if (task.type === 'LIST_FILES') { assign('inputLocation', text(input.inputLocation)); assign('fileTypes', Array.isArray(input.fileTypes) ? input.fileTypes.map(String) : undefined) }
  if (task.type === 'PARSE_DOCUMENT') { assign('integrationName', text(input.integrationName)); assign('url', text(input.url)); assign('mediaType', text(input.mediaType)); assign('chunkSize', Number(input.chunkSize ?? 0)) }
  if (task.type === 'AGENT' || task.type === 'GET_AGENT_CARD' || task.type === 'CANCEL_AGENT') { assign('agentType', text(input.agentType)); assign('agentUrl', text(input.agentUrl)); assign('taskId', text(input.taskId)); assign('text', text(input.text)); assign('pollIntervalSeconds', input.pollIntervalSeconds == null ? undefined : Number(input.pollIntervalSeconds)) }
  if (task.type === 'SENDGRID') { assign('from', text(input.from)); assign('to', text(input.to)); assign('subjectLine', text(input.subject)); assign('contentType', text(input.contentType)); assign('content', text(input.content)); assign('sendgridConfiguration', text(input.sendgridConfiguration)) }
  if (task.type === 'CHUNK_TEXT') { assign('text', text(input.text)); assign('chunkSize', Number(input.chunkSize ?? 1024)); assign('mediaType', text(input.mediaType)) }
  if (task.type === 'INTEGRATION' || task.type === 'MCP_REMOTE') { assign('integrationName', text(input.integrationName)); assign('operation', text(input.operation)) }
  const policyKeys = ['retryCount', 'retryLogic', 'retryDelaySeconds', 'maxRetryDelaySeconds', 'backoffJitterMs', 'totalTimeoutSeconds', 'timeoutSeconds', 'responseTimeoutSeconds', 'pollTimeoutSeconds', 'taskTimeoutPolicy', 'workerDomain', 'callbackAfterSeconds', 'rateLimitPerFrequency', 'rateLimitFrequencyInSeconds', 'concurrentExecLimit'] as const
  policyKeys.forEach((key) => { if (task[key] != null) config[key] = task[key] as never })
  if (task.inputKeys) config.inputKeys = task.inputKeys
  if (task.outputKeys) config.outputKeys = task.outputKeys
  if (task.cacheConfig) {
    config.cacheTtlInSecond = task.cacheConfig.ttlInSecond
    config.cacheKey = task.cacheConfig.key
  }
  if (task.taskDefinition) {
    config.enforceSchema = task.taskDefinition.enforceSchema
    config.inputSchema = task.taskDefinition.inputSchema
    config.outputSchema = task.taskDefinition.outputSchema
  }
  if (task.loopOver) config.loopOver = task.loopOver.map(fromConductorTask)
  if (task.decisionCases) config.decisionCases = Object.fromEntries(Object.entries(task.decisionCases).map(([branch, children]) => [branch, children.map(fromConductorTask)]))
  if (task.defaultCase) config.defaultCase = task.defaultCase.map(fromConductorTask)
  if (task.forkTasks) {
    config.forkBranches = task.forkTasks.map((branch) => branch.map(fromConductorTask))
    config.forkTasks = JSON.stringify(task.forkTasks)
  }
  return config
}

function isSupportedTaskKind(value: unknown): value is TaskKind {
  return typeof value === 'string' && (isOfficialTaskKind(value) || ['SQL', 'AI_CHAT_COMPLETION', 'AI_GENERATE_IMAGE'].includes(value))
}

function isSupportedElement(name: string | null) {
  return Boolean(name && ['startEvent', 'endEvent', 'serviceTask', 'task', 'userTask', 'exclusiveGateway', 'parallelGateway'].includes(name))
}

function isFlowElement(name: string | null) {
  return Boolean(name && ['startEvent', 'endEvent', 'serviceTask', 'task', 'userTask', 'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'complexGateway', 'eventBasedGateway', 'subProcess', 'callActivity', 'scriptTask', 'sendTask', 'receiveTask', 'manualTask', 'businessRuleTask', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent'].includes(name))
}

function safeJson(value: string) { try { return JSON.parse(value) } catch { return {} } }
function escapeXml(value: string) { return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character) }
