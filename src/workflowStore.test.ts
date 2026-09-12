// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { buildTaskInputParameters, buildWorkflowJson, validateWorkflow, validateWorkflowSettings, useWorkflowStore, type StudioNode } from './workflowStore'
import { bpmnToWorkflow, conductorAdapter, conductorJsonToGraph, toConductorDefinition, workflowToBpmn } from './adapters'

const node = (id: string, label: string, ref: string, type: StudioNode['type'] = 'studio'): StudioNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label, ref, kind: type === 'switch' ? 'SWITCH' : 'HTTP', config: { url: 'https://example.test' } },
})

describe('workflow validation', () => {
  it('validates enforced workflow schemas and parameter keys', () => {
    const issues = validateWorkflowSettings({ name: 'demo', description: '', version: 1, schemaVersion: 2, enforceSchema: true, timeoutSeconds: 30, restartable: true, idempotencyStrategy: 'FAIL', inputSchema: '{', outputSchema: '{}', inputParameters: [{ key: 'id', value: '' }, { key: 'id', value: '' }] })
    expect(issues.some((issue) => issue.message.includes('Input schema must be valid JSON Schema'))).toBe(true)
    expect(issues.some((issue) => issue.message.includes('duplicate key'))).toBe(true)
  })

  it('accepts a connected graph with unique references', () => {
    const nodes = [node('start', 'Start', 'start', 'start'), node('task', 'check_endpoint', 'check_endpoint_ref'), node('end', 'End', 'end', 'end')]
    const issues = validateWorkflow(nodes, [
      { id: 'a', source: 'start', target: 'task' },
      { id: 'b', source: 'task', target: 'end' },
    ])
    expect(issues).toEqual([])
  })

  it('reports duplicate references and disconnected ends', () => {
    const nodes = [node('start', 'Start', 'start', 'start'), node('one', 'one', 'same_ref'), node('two', 'two', 'same_ref'), node('end', 'End', 'end', 'end')]
    const issues = validateWorkflow(nodes, [{ id: 'a', source: 'start', target: 'one' }])
    expect(issues.some((issue) => issue.message.includes('Duplicate reference name'))).toBe(true)
   expect(issues.some((issue) => issue.message.includes('End node is not connected'))).toBe(true)
 })

  it('accepts a forward task reference and warns about unreachable tasks', () => {
    const nodes = [node('start', 'Start', 'start', 'start'), node('first', 'first', 'first_ref'), node('second', 'second', 'second_ref'), node('end', 'End', 'end', 'end')]
    nodes[0].data.kind = 'SIMPLE'
    nodes[0].data.config = {}
    nodes[1].data.config = { inputParameters: '{"id":"${second_ref.output.id}"}' }
    nodes[2].data.config = {}
    const issues = validateWorkflow(nodes, [{ id: 'a', source: 'start', target: 'first' }, { id: 'b', source: 'first', target: 'end' }])
    expect(issues.some((issue) => issue.message.includes('Unknown task reference'))).toBe(false)
    expect(issues.some((issue) => issue.message.includes('second is unreachable'))).toBe(true)
  })

  it('keeps task configuration in the code-first workflow JSON', () => {
    const task = node('task', 'Call API', 'call_api_ref')
    task.data.config = { url: 'https://example.test', method: 'POST', timeoutSeconds: 12 }
    const draft = buildWorkflowJson([task], { name: 'demo', description: '', version: 3, schemaVersion: 2, enforceSchema: false, timeoutSeconds: 60, restartable: true, failureWorkflow: '', idempotencyStrategy: 'FAIL' })
    expect(draft.tasks[0].config).toMatchObject({ url: 'https://example.test', method: 'POST', timeoutSeconds: 12 })
  })

  it('serializes editor fields into canonical Conductor input parameters', () => {
    expect(buildTaskInputParameters('HTTP', { url: 'https://example.test/status', method: 'GET', headers: '{"x-trace":"1"}' })).toMatchObject({ uri: 'https://example.test/status', method: 'GET', headers: { 'x-trace': '1' } })
    expect(buildTaskInputParameters('HTTP_POLL', { url: 'https://example.test/job', pollIntervalSeconds: 15, pollCondition: '$.status == "DONE"' })).toMatchObject({ http_request: { uri: 'https://example.test/job', pollingInterval: '15', terminationCondition: '$.status == "DONE"' } })
    expect(buildTaskInputParameters('GET_SIGNED_JWT', { subject: 'user-1', algorithm: 'RS256', ttlInSecond: 300 })).toMatchObject({ subject: 'user-1', algorithm: 'RS256', ttlInSecond: 300 })
  })

  it('serializes the official Kafka, gRPC, rule, database and secret task shapes', () => {
    expect(buildTaskInputParameters('KAFKA_PUBLISH', { kafkaTopic: 'orders', kafkaValue: '{"id":1}', kafkaBootStrapServers: 'localhost:9092', kafkaHeaders: '{"tenant":"acme"}', kafkaKey: 'order-1', kafkaKeySerializer: 'String' })).toMatchObject({ kafka_request: { topic: 'orders', value: '{"id":1}', bootStrapServers: 'localhost:9092', headers: { tenant: 'acme' }, key: 'order-1', keySerializer: 'String' } })
    expect(buildTaskInputParameters('GRPC', { grpcService: 'orders.OrderService', grpcMethod: 'GetOrder', grpcHost: 'localhost', grpcPort: 6565, grpcUseSSL: true, grpcRequest: '{"id":"1"}', grpcMethodType: 'UNARY' })).toMatchObject({ service: 'orders.OrderService', method: 'GetOrder', host: 'localhost', port: 6565, useSSL: true, request: { id: '1' }, methodType: 'UNARY' })
    expect(buildTaskInputParameters('BUSINESS_RULE', { ruleFileLocation: 'https://rules.test/orders.xlsx', executionStrategy: 'FIRE_ALL', inputColumns: '{"id":"${workflow.input.id}"}', outputColumns: '["eligible"]', cacheTimeoutMinutes: 30 })).toMatchObject({ ruleFileLocation: 'https://rules.test/orders.xlsx', executionStrategy: 'FIRE_ALL', inputColumns: { id: '${workflow.input.id}' }, outputColumns: ['eligible'], cacheTimeoutMinutes: 30 })
    expect(buildTaskInputParameters('JDBC', { integrationName: 'postgres', schemaName: 'public', databaseType: 'UPDATE', sqlQuery: 'UPDATE orders SET status = :status', jdbcParameters: '["READY"]', expectedUpdateCount: '1' })).toMatchObject({ integrationName: 'postgres', schemaName: 'public', type: 'UPDATE', statement: 'UPDATE orders SET status = :status', parameters: ['READY'], expectedUpdateCount: '1' })
    expect(buildTaskInputParameters('UPDATE_SECRET', { secretKey: 'orders/password', secretValue: '${workflow.input.password}' })).toMatchObject({ _secrets: { secretKey: 'orders/password', secretValue: '${workflow.input.password}' } })
    expect(buildTaskInputParameters('LLM_CHAT_COMPLETE', { llmProvider: 'openai', model: 'gpt-4.1-mini', messages: '[{"role":"user","content":"Summarize"}]', temperature: 0.4, maxTokens: 200, jsonOutput: '{"type":"object"}' })).toMatchObject({ llmProvider: 'openai', model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'Summarize' }], temperature: 0.4, maxTokens: 200, jsonOutput: { type: 'object' } })
    expect(buildTaskInputParameters('LLM_SEARCH_INDEX', { vectorDB: 'pinecone', index: 'docs', namespace: 'prod', embeddingModelProvider: 'openai', embeddingModel: 'text-embedding-3-small', query: '${workflow.input.query}', maxResults: 5, dimensions: 1536 })).toMatchObject({ vectorDB: 'pinecone', index: 'docs', namespace: 'prod', query: '${workflow.input.query}', maxResults: 5, dimensions: 1536 })
    expect(buildTaskInputParameters('CALL_MCP_TOOL', { mcpServer: 'https://mcp.example.com', operation: 'search', arguments: '{"query":"${workflow.input.query}"}', headers: '{"x-tenant":"acme"}' })).toMatchObject({ mcpServer: 'https://mcp.example.com', method: 'search', arguments: { query: '${workflow.input.query}' }, headers: { 'x-tenant': 'acme' } })
    expect(buildTaskInputParameters('GENERATE_VIDEO', { llmProvider: 'openai', model: 'video-model', prompt: 'A city at night', width: 1280, height: 720, duration: 8, outputFormat: 'mp4', generateAudio: true, generateThumbnail: true })).toMatchObject({ llmProvider: 'openai', model: 'video-model', prompt: 'A city at night', width: 1280, height: 720, duration: 8, outputFormat: 'mp4', generateAudio: true, generateThumbnail: true })
    expect(buildTaskInputParameters('GENERATE_PDF', { markdown: '# Report', pageSize: 'A4', marginTop: 36, pdfMetadata: '{"title":"Report"}', outputLocation: 's3://reports/out.pdf' })).toMatchObject({ markdown: '# Report', pageSize: 'A4', marginTop: 36, pdfMetadata: { title: 'Report' }, outputLocation: 's3://reports/out.pdf' })
  })

  it('exports Worker Task parameters, cache, schema and optional settings', () => {
    const worker: StudioNode = { ...node('worker', 'Worker step', 'worker_ref'), data: { label: 'Worker step', ref: 'worker_ref', kind: 'SIMPLE', optional: true, config: { workerTaskName: 'sayHello', workerDomain: 'production', callbackAfterSeconds: 30, rateLimitPerFrequency: 10, rateLimitFrequencyInSeconds: 60, concurrentExecLimit: 4, inputParameters: '{"firstName":"${workflow.input.firstName}"}', cacheTtlInSecond: 120, cacheKey: '${workflow.input.firstName}', enforceSchema: true, inputSchema: 'worker_input_v1', outputSchema: 'worker_output_v1' } } }
    const draft = buildWorkflowJson([worker], { name: 'demo', description: '', version: 1, schemaVersion: 2, enforceSchema: false, timeoutSeconds: 60, restartable: true, failureWorkflow: '', idempotencyStrategy: 'FAIL' })
    expect(draft.tasks[0]).toMatchObject({ name: 'sayHello', taskReferenceName: 'worker_ref', type: 'SIMPLE', optional: true, inputParameters: { firstName: '${workflow.input.firstName}' }, cacheConfig: { ttlInSecond: 120, key: '${workflow.input.firstName}' }, taskDefinition: { enforceSchema: true, inputSchema: 'worker_input_v1', outputSchema: 'worker_output_v1' } })
    const exported = toConductorDefinition([worker], 'demo', 1)
    expect(exported.tasks[0]).toMatchObject({ workerDomain: 'production', callbackAfterSeconds: 30, rateLimitPerFrequency: 10, rateLimitFrequencyInSeconds: 60, concurrentExecLimit: 4 })
  })

  it('keeps published version snapshots immutable', () => {
    const workflow = { name: 'demo', description: '', version: 4, schemaVersion: 2 as const, enforceSchema: false, timeoutSeconds: 60, restartable: true, failureWorkflow: '', idempotencyStrategy: 'FAIL' as const }
    useWorkflowStore.setState({ versionHistory: [] })
    useWorkflowStore.getState().recordVersionSnapshot({ version: 4, workflow, nodes: [node('one', 'Original', 'one_ref')], edges: [], status: 'PUBLISHED', savedAt: '2026-01-01T00:00:00.000Z' })
    useWorkflowStore.getState().recordVersionSnapshot({ version: 4, workflow, nodes: [node('two', 'Replacement', 'two_ref')], edges: [], status: 'PUBLISHED', savedAt: '2026-01-02T00:00:00.000Z' })
    expect(useWorkflowStore.getState().versionHistory[0].nodes[0].data.label).toBe('Original')
  })

  it('reports missing task dependencies as warnings', () => {
    const issues = validateWorkflow([node('start', 'Start', 'start', 'start'), { ...node('worker', 'Worker', 'worker_ref'), data: { label: 'Worker', ref: 'worker_ref', kind: 'SIMPLE', config: {} } }, node('end', 'End', 'end', 'end')], [{ id: 'a', source: 'start', target: 'worker' }, { id: 'b', source: 'worker', target: 'end' }])
    expect(issues.some((issue) => issue.message.includes('worker task dependency'))).toBe(true)
  })
})

describe('BPMN adapter', () => {
  it('exports supported flow elements as BPMN XML', () => {
    const xml = workflowToBpmn([node('start', 'Start', 'start', 'start'), node('task', 'Call API', 'call_api_ref'), node('switch', 'Route', 'route_ref', 'switch'), node('end', 'End', 'end', 'end')], 'demo_workflow', [
      { id: 'flow_start_task', source: 'start', target: 'task' },
      { id: 'flow_task_switch', source: 'task', target: 'switch' },
      { id: 'flow_switch_end', source: 'switch', target: 'end', label: 'completed' },
    ])
    expect(xml).toContain('<bpmn:definitions')
    expect(xml).toContain('serviceTask')
    expect(xml).toContain('exclusiveGateway')
    expect(xml).toContain('demo_workflow')
    expect(xml).toContain('sequenceFlow')
    expect(xml).toContain('sourceRef="switch"')
    expect(xml).toContain('bpmndi:BPMNShape')
    expect(xml).toContain('dc:Bounds')
    expect(xml).toContain('bpmndi:BPMNEdge')
  })

  it('imports supported BPMN elements for conversion review', () => {
    const review = bpmnToWorkflow('<definitions><process><startEvent id="start"/><serviceTask id="call" name="Call API" data-task-type="HTTP"/><exclusiveGateway id="route" name="Route"/><endEvent id="end"/><sequenceFlow id="a" sourceRef="start" targetRef="call"/><sequenceFlow id="b" sourceRef="call" targetRef="route"/><sequenceFlow id="c" name="completed" sourceRef="route" targetRef="end"/></process></definitions>')
    expect(review.errors).toEqual([])
    expect(review.nodes.map((item) => item.data.label)).toEqual(['startEvent_1', 'Call API', 'Route', 'endEvent_4'])
    expect(review.edges.map((item) => [item.source, item.target])).toEqual([['start', 'call'], ['call', 'route'], ['route', 'end']])
    expect(review.nodes.find((item) => item.id === 'route')?.data.config?.cases).toEqual(['completed'])
  })

  it('round-trips a parallel gateway as a join node', () => {
    const review = bpmnToWorkflow('<definitions><process><startEvent id="start"/><parallelGateway id="join" name="Join"/><endEvent id="end"/><sequenceFlow id="a" sourceRef="start" targetRef="join"/><sequenceFlow id="b" sourceRef="join" targetRef="end"/></process></definitions>')
    expect(review.errors).toEqual([])
    expect(review.nodes.find((item) => item.id === 'join')?.type).toBe('join')
    expect(review.edges).toHaveLength(2)
  })

  it('maps BPMN task variants to their canonical task kinds', () => {
    const review = bpmnToWorkflow('<definitions><process><startEvent id="start"/><userTask id="approve" name="Approve"/><subProcess id="poll" name="Poll" data-task-type="DO_WHILE"/><scriptTask id="transform" name="Transform"/><receiveTask id="event" name="Wait for event"/><endEvent id="end"/><sequenceFlow id="a" sourceRef="start" targetRef="approve"/><sequenceFlow id="b" sourceRef="approve" targetRef="poll"/><sequenceFlow id="c" sourceRef="poll" targetRef="transform"/><sequenceFlow id="d" sourceRef="transform" targetRef="event"/><sequenceFlow id="e" sourceRef="event" targetRef="end"/></process></definitions>')
    expect(review.errors).toEqual([])
    expect(review.nodes.find((item) => item.id === 'approve')?.data.kind).toBe('HUMAN')
    expect(review.nodes.find((item) => item.id === 'poll')?.type).toBe('loop')
    expect(review.nodes.find((item) => item.id === 'transform')?.data.kind).toBe('INLINE')
    expect(review.nodes.find((item) => item.id === 'event')?.data.kind).toBe('WAIT_FOR_EVENT')
  })

  it('creates a versioned Conductor definition with task input mappings', () => {
    const definition = toConductorDefinition([node('task', 'Call API', 'call_api_ref')], 'demo_workflow', 7)
    expect(definition).toMatchObject({ name: 'demo_workflow', version: 7, schemaVersion: 2 })
    expect(definition.tasks[0]).toMatchObject({ taskReferenceName: 'call_api_ref', type: 'HTTP' })
  })

  it('round-trips nested operator tasks through the Conductor adapter', () => {
    const nested = { name: 'check_status', taskReferenceName: 'check_status_ref', type: 'HTTP' as const, inputParameters: { url: '${workflow.input.endpointUrl}' }, optional: false }
    const loop: StudioNode = { id: 'loop', type: 'loop', position: { x: 0, y: 0 }, data: { label: 'poll_status', ref: 'poll_status_ref', kind: 'DO_WHILE', config: { loopOver: [nested], loopCondition: 'return true;', retryCount: 2, retryLogic: 'EXPONENTIAL_BACKOFF', backoffJitterMs: 250 } } }
    const definition = toConductorDefinition([loop], 'demo_workflow', 2)
    expect(definition.tasks[0]).toMatchObject({ type: 'DO_WHILE', retryCount: 2, retryLogic: 'EXPONENTIAL_BACKOFF', backoffJitterMs: 250 })
    expect(definition.tasks[0].loopOver?.[0]).toMatchObject({ taskReferenceName: 'check_status_ref', type: 'HTTP' })
    const imported = conductorAdapter.import(definition)
    const importedLoop = imported.nodes.find((item) => item.data.ref === 'poll_status_ref')
    expect(importedLoop?.type).toBe('loop')
    expect(importedLoop?.data.config?.loopOver?.[0].taskReferenceName).toBe('check_status_ref')
  })

  it('rebuilds the graph when code adds or removes tasks', () => {
    const existing = [node('start', 'Start', 'start', 'start'), node('old', 'Old task', 'old_ref'), node('end', 'End', 'end', 'end')]
    const review = conductorJsonToGraph({ name: 'edited', version: 3, tasks: [{ name: 'New task', taskReferenceName: 'new_ref', type: 'HTTP', inputParameters: { url: 'https://example.test' } }] }, existing)
    expect(review.errors).toEqual([])
    expect(review.nodes.map((item) => item.data.ref)).toEqual(['start', 'new_ref', 'end'])
    expect(review.nodes.find((item) => item.data.ref === 'new_ref')?.id).toBe('new_ref')
    expect(review.edges.map((item) => [item.source, item.target])).toEqual([['start', 'new_ref'], ['new_ref', 'end']])
  })

  it('rejects unknown types without returning a partial graph', () => {
    const review = conductorJsonToGraph({ tasks: [{ name: 'Bad', taskReferenceName: 'bad_ref', type: 'NOT_A_TASK', inputParameters: {} }] })
    expect(review.nodes).toEqual([])
    expect(review.errors[0]).toContain('unknown task type')
  })

  it('reports circular top-level graph references', () => {
    const nodes = [node('start', 'Start', 'start', 'start'), node('a', 'A', 'a_ref'), node('b', 'B', 'b_ref'), node('end', 'End', 'end', 'end')]
    const issues = validateWorkflow(nodes, [{ id: 'start-a', source: 'start', target: 'a' }, { id: 'a-b', source: 'a', target: 'b' }, { id: 'b-a', source: 'b', target: 'a' }, { id: 'b-end', source: 'b', target: 'end' }])
    expect(issues.some((issue) => issue.message.includes('circular reference'))).toBe(true)
  })
})
