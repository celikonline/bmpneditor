import type { ReactNode } from 'react'
import type { StudioNode, StudioData, TaskConfig, TaskKind, WorkflowTaskDraft } from '../workflowStore'

type TaskFormProps = {
  kind: TaskKind
  config: NonNullable<StudioNode['data']['config']>
  optional: boolean
  updateConfig: (patch: Partial<TaskConfig>) => void
  updateData: (patch: Partial<StudioData>) => void
}

function Input({ label, value, placeholder, type = 'text', onChange }: { label: string; value: string | number; placeholder?: string; type?: string; onChange: (value: string) => void }) {
  return <><label>{label}</label><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></>
}

function Textarea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <><label>{label}</label><textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></>
}

function ExpressionField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <><Input label={label} value={value} placeholder={placeholder} onChange={onChange} /><span className="field-hint">Supports workflow and task expressions such as <code>${'{workflow.input.id}'}</code>.</span></>
}

function OptionalToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <label className="form-toggle"><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><span>Optional task</span></label>
}

function AiFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <><Input label="Model" value={config.model ?? ''} placeholder="gpt-4.1-mini" onChange={(value) => updateConfig({ model: value })} /><Textarea label="Prompt / instructions" value={config.prompt ?? ''} placeholder="Describe the desired output" onChange={(value) => updateConfig({ prompt: value })} /></>
}

function LlmFields({ kind, config, updateConfig }: Pick<TaskFormProps, 'kind' | 'config' | 'updateConfig'>) {
  const vectorTask = kind.includes('EMBEDDING') || kind.includes('INDEX')
  const searchTask = kind.includes('SEARCH')
  const chatTask = kind === 'LLM_CHAT_COMPLETE'
  const textTask = kind === 'LLM_TEXT_COMPLETE'
  return <>
    <div className="compact-fields"><div><Input label="LLM provider" value={config.llmProvider ?? ''} placeholder="openai" onChange={(value) => updateConfig({ llmProvider: value })} /></div><div><Input label="Model" value={config.model ?? ''} placeholder={vectorTask ? 'text-embedding-3-small' : 'gpt-4.1-mini'} onChange={(value) => updateConfig({ model: value })} /></div></div>
    {chatTask ? <Textarea label="Messages (JSON array)" value={config.messages ?? ''} placeholder={'[{"role":"user","content":"Summarize this"}]'} onChange={(value) => updateConfig({ messages: value })} /> : textTask ? <Textarea label="Instructions / prompt" value={config.instructions ?? config.prompt ?? ''} placeholder="Complete the following text..." onChange={(value) => updateConfig({ instructions: value, prompt: value })} /> : null}
    {!vectorTask && !searchTask && <div className="compact-fields"><div><Input label="Temperature" type="number" value={config.temperature ?? 0.7} onChange={(value) => updateConfig({ temperature: value ? Number(value) : undefined })} /></div><div><Input label="Top P" type="number" value={config.topP ?? 1} onChange={(value) => updateConfig({ topP: value ? Number(value) : undefined })} /></div></div>}
    {!vectorTask && !searchTask && <div className="compact-fields"><div><Input label="Max tokens" type="number" value={config.maxTokens ?? 0} onChange={(value) => updateConfig({ maxTokens: value ? Math.max(1, Number(value)) : undefined })} /></div><div><Input label="Stop words (JSON array)" value={config.stopWords ?? ''} placeholder='["END"]' onChange={(value) => updateConfig({ stopWords: value })} /></div></div>}
    {chatTask && <Textarea label="JSON output schema / instructions" value={config.jsonOutput ?? ''} placeholder={'{"type":"object","properties":{}}'} onChange={(value) => updateConfig({ jsonOutput: value })} />}
    {vectorTask && <><div className="compact-fields"><div><Input label="Vector database" value={config.vectorDB ?? ''} placeholder="pinecone" onChange={(value) => updateConfig({ vectorDB: value })} /></div><div><Input label="Index" value={config.index ?? ''} placeholder="documents" onChange={(value) => updateConfig({ index: value })} /></div></div><div className="compact-fields"><div><Input label="Namespace" value={config.namespace ?? ''} placeholder="default" onChange={(value) => updateConfig({ namespace: value })} /></div><div><Input label="Embedding model provider" value={config.embeddingModelProvider ?? ''} placeholder="openai" onChange={(value) => updateConfig({ embeddingModelProvider: value })} /></div></div><div className="compact-fields"><div><Input label="Embedding model" value={config.embeddingModel ?? ''} placeholder="text-embedding-3-small" onChange={(value) => updateConfig({ embeddingModel: value })} /></div><div><Input label="Dimensions" type="number" value={config.dimensions ?? 1536} onChange={(value) => updateConfig({ dimensions: value ? Number(value) : undefined })} /></div></div></>}
    {searchTask && <div className="compact-fields"><div><Input label="Query" value={config.query ?? ''} placeholder="semantic search query" onChange={(value) => updateConfig({ query: value })} /></div><div><Input label="Max results" type="number" value={config.maxResults ?? 10} onChange={(value) => updateConfig({ maxResults: value ? Math.max(1, Number(value)) : undefined })} /></div></div>}
    {kind === 'LLM_GENERATE_EMBEDDINGS' && <Textarea label="Text" value={config.text ?? ''} placeholder="Text to embed" onChange={(value) => updateConfig({ text: value })} />}
    {kind === 'LLM_INDEX_TEXT' && <><Textarea label="Text" value={config.text ?? ''} placeholder="Text to index" onChange={(value) => updateConfig({ text: value })} /><Input label="Document ID" value={config.docId ?? ''} placeholder="doc-123" onChange={(value) => updateConfig({ docId: value })} /></>}
    {kind === 'LLM_INDEX_DOCUMENT' && <><Input label="Document URL" value={config.url ?? ''} placeholder="https://example.com/document.pdf" onChange={(value) => updateConfig({ url: value })} /><div className="compact-fields"><div><Input label="Media type" value={config.mediaType ?? 'auto'} onChange={(value) => updateConfig({ mediaType: value })} /></div><div><Input label="Chunk size" type="number" value={config.chunkSize ?? 1024} onChange={(value) => updateConfig({ chunkSize: value ? Number(value) : undefined })} /></div><div><Input label="Chunk overlap" type="number" value={config.chunkOverlap ?? 0} onChange={(value) => updateConfig({ chunkOverlap: value ? Number(value) : undefined })} /></div></div></>}
    {kind === 'LLM_STORE_EMBEDDINGS' && <Textarea label="Embeddings (JSON array)" value={config.embeddings ?? ''} placeholder="[0.12, 0.34, 0.56]" onChange={(value) => updateConfig({ embeddings: value })} />}
  </>
}

function SignedJwtFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <><div className="compact-fields"><div><Input label="Subject" value={config.subject ?? ''} onChange={(value) => updateConfig({ subject: value })} /></div><div><Input label="Issuer" value={config.issuer ?? ''} onChange={(value) => updateConfig({ issuer: value })} /></div></div><div className="compact-fields"><div><Input label="Audience" value={config.audience ?? ''} onChange={(value) => updateConfig({ audience: value })} /></div><div><Input label="Private key ID" value={config.privateKeyId ?? ''} onChange={(value) => updateConfig({ privateKeyId: value })} /></div></div><label>Private key</label><textarea value={config.privateKey ?? ''} placeholder="Secret or PEM key reference" onChange={(event) => updateConfig({ privateKey: event.target.value })} /><div className="compact-fields"><div><Input label="TTL (seconds)" type="number" value={config.ttlInSecond ?? 300} onChange={(value) => updateConfig({ ttlInSecond: Math.max(0, Number(value)) })} /></div><div><label>Algorithm</label><select className="native-select" value={config.algorithm ?? 'RS256'} onChange={(event) => updateConfig({ algorithm: event.target.value })}><option>RS256</option><option>RS384</option><option>RS512</option><option>ES256</option></select></div></div><ExpressionField label="Scopes" value={config.scopes?.join(' ') ?? ''} placeholder="workflow:read workflow:execute" onChange={(value) => updateConfig({ scopes: value.split(/\s+/).filter(Boolean) })} /></>
}

function UpdateTaskFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <><div className="compact-fields"><div><label>Task status</label><select className="native-select" value={config.taskStatus ?? 'COMPLETED'} onChange={(event) => updateConfig({ taskStatus: event.target.value })}><option>COMPLETED</option><option>FAILED</option><option>IN_PROGRESS</option><option>SKIPPED</option><option>CANCELED</option></select></div><div><Input label="Task reference" value={config.taskRefName ?? ''} placeholder="task_ref" onChange={(value) => updateConfig({ taskRefName: value })} /></div></div><ExpressionField label="Workflow execution ID" value={config.workflowId ?? ''} placeholder="${workflow.id}" onChange={(value) => updateConfig({ workflowId: value })} /><label className="form-toggle"><input type="checkbox" checked={config.mergeOutput ?? false} onChange={(event) => updateConfig({ mergeOutput: event.target.checked })} /><span>Merge task output</span></label></>
}

function QueryProcessorFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <><div className="compact-fields"><div><label>Query type</label><select className="native-select" value={config.queryType ?? 'CONDUCTOR_API'} onChange={(event) => updateConfig({ queryType: event.target.value })}><option>CONDUCTOR_API</option><option>ELASTICSEARCH</option><option>SQL</option></select></div><div><Input label="Workflow names" value={config.workflowNames?.join('\n') ?? ''} placeholder="workflow_name" onChange={(value) => updateConfig({ workflowNames: value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></div></div><div className="compact-fields"><div><Input label="Statuses" value={config.statuses?.join('\n') ?? ''} placeholder="RUNNING" onChange={(value) => updateConfig({ statuses: value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></div><div><Input label="Correlation IDs" value={config.correlationIds?.join('\n') ?? ''} placeholder="correlation-id" onChange={(value) => updateConfig({ correlationIds: value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></div></div></>
}

function AgentFields({ kind, config, updateConfig }: Pick<TaskFormProps, 'kind' | 'config' | 'updateConfig'>) {
  return <><div className="compact-fields"><div><label>Agent type</label><select className="native-select" value={config.agentType ?? 'a2a'} onChange={(event) => updateConfig({ agentType: event.target.value })}><option value="a2a">A2A</option><option value="conductor">Conductor</option></select></div><div><Input label={kind === 'CANCEL_AGENT' ? 'Task ID' : 'Agent URL'} value={kind === 'CANCEL_AGENT' ? config.taskId ?? '' : config.agentUrl ?? ''} placeholder={kind === 'CANCEL_AGENT' ? '${task_ref.output.taskId}' : 'https://agent.example.com'} onChange={(value) => updateConfig(kind === 'CANCEL_AGENT' ? { taskId: value } : { agentUrl: value })} /></div></div>{kind === 'AGENT' && <><Textarea label="Prompt / text" value={config.text ?? ''} placeholder="Message for the agent" onChange={(value) => updateConfig({ text: value })} /><Input label="Poll interval (sec)" type="number" value={config.pollIntervalSeconds ?? 5} onChange={(value) => updateConfig({ pollIntervalSeconds: Math.max(1, Number(value)) })} /></>}</>
}

function DocumentFields({ kind, config, updateConfig }: Pick<TaskFormProps, 'kind' | 'config' | 'updateConfig'>) {
  return <><Input label={kind === 'LIST_FILES' ? 'Input location' : 'Document URL'} value={kind === 'LIST_FILES' ? config.inputLocation ?? '' : config.url ?? ''} placeholder="https://example.com/document.pdf" onChange={(value) => updateConfig(kind === 'LIST_FILES' ? { inputLocation: value } : { url: value })} /><div className="compact-fields"><div><Input label="Media type" value={config.mediaType ?? 'auto'} onChange={(value) => updateConfig({ mediaType: value })} /></div><div><Input label="Chunk size" type="number" value={config.chunkSize ?? 0} onChange={(value) => updateConfig({ chunkSize: Math.max(0, Number(value)) })} /></div></div>{kind === 'LIST_FILES' && <Input label="File types" value={config.fileTypes?.join(', ') ?? ''} placeholder="pdf, md, txt" onChange={(value) => updateConfig({ fileTypes: value.split(',').map((item) => item.trim()).filter(Boolean) })} />}</>
}

function SendgridFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <><div className="compact-fields"><div><Input label="From" value={config.from ?? ''} placeholder="noreply@example.com" onChange={(value) => updateConfig({ from: value })} /></div><div><Input label="To" value={config.to ?? ''} placeholder="team@example.com" onChange={(value) => updateConfig({ to: value })} /></div></div><Input label="Subject" value={config.subjectLine ?? ''} onChange={(value) => updateConfig({ subjectLine: value })} /><Textarea label="Content" value={config.content ?? ''} placeholder="Email body" onChange={(value) => updateConfig({ content: value })} /><Input label="SendGrid configuration" value={config.sendgridConfiguration ?? ''} placeholder="default" onChange={(value) => updateConfig({ sendgridConfiguration: value })} /></>
}

function KafkaFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <>
    <div className="compact-fields"><div><Input label="Topic" value={config.kafkaTopic ?? config.eventName ?? ''} placeholder="orders.events" onChange={(value) => updateConfig({ kafkaTopic: value, eventName: value })} /></div><div><Input label="Bootstrap server" value={config.kafkaBootStrapServers ?? ''} placeholder="localhost:9092" onChange={(value) => updateConfig({ kafkaBootStrapServers: value })} /></div></div>
    <Textarea label="Value" value={config.kafkaValue ?? config.eventPayload ?? ''} placeholder="${workflow.input.payload} or JSON value" onChange={(value) => updateConfig({ kafkaValue: value, eventPayload: value })} />
    <Textarea label="Headers (JSON object)" value={config.kafkaHeaders ?? ''} placeholder={'{\n  "tenant": "${workflow.input.tenantId}"\n}'} onChange={(value) => updateConfig({ kafkaHeaders: value })} />
    <div className="compact-fields"><div><Input label="Key" value={config.kafkaKey ?? ''} placeholder="${workflow.input.orderId}" onChange={(value) => updateConfig({ kafkaKey: value })} /></div><div><Input label="Key serializer" value={config.kafkaKeySerializer ?? 'String'} placeholder="String" onChange={(value) => updateConfig({ kafkaKeySerializer: value })} /></div></div>
  </>
}

function GrpcFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <>
    <div className="compact-fields"><div><Input label="Service" value={config.grpcService ?? ''} placeholder="package.Service" onChange={(value) => updateConfig({ grpcService: value })} /></div><div><Input label="Method name" value={config.grpcMethod ?? config.serviceMethod ?? ''} placeholder="GetOrder" onChange={(value) => updateConfig({ grpcMethod: value, serviceMethod: value })} /></div></div>
    <div className="compact-fields"><div><Input label="Host" value={config.grpcHost ?? ''} placeholder="localhost" onChange={(value) => updateConfig({ grpcHost: value })} /></div><div><Input label="Port" type="number" value={config.grpcPort ?? 6565} onChange={(value) => updateConfig({ grpcPort: value ? Number(value) : undefined })} /></div></div>
    <Textarea label="Request (JSON object)" value={config.grpcRequest ?? ''} placeholder={'{\n  "orderId": "${workflow.input.orderId}"\n}'} onChange={(value) => updateConfig({ grpcRequest: value })} />
    <Textarea label="Headers (JSON object)" value={config.grpcHeaders ?? ''} placeholder={'{\n  "authorization": "${workflow.input.token}"\n}'} onChange={(value) => updateConfig({ grpcHeaders: value })} />
    <div className="compact-fields"><div><Input label="Input type" value={config.grpcInputType ?? ''} placeholder="OrderRequest" onChange={(value) => updateConfig({ grpcInputType: value })} /></div><div><Input label="Output type" value={config.grpcOutputType ?? ''} placeholder="OrderResponse" onChange={(value) => updateConfig({ grpcOutputType: value })} /></div></div>
    <div className="compact-fields"><div><label>Method type</label><select className="native-select" value={config.grpcMethodType ?? 'UNARY'} onChange={(event) => updateConfig({ grpcMethodType: event.target.value })}><option>UNARY</option><option>SERVER_STREAMING</option><option>CLIENT_STREAMING</option><option>BIDIRECTIONAL_STREAMING</option></select></div><div><Input label="Hedging max attempts" type="number" value={config.grpcHedgingMaxAttempts ?? 0} onChange={(value) => updateConfig({ grpcHedgingMaxAttempts: value ? Math.max(1, Number(value)) : undefined })} /></div></div>
    <div className="compact-fields"><label className="form-toggle"><input type="checkbox" checked={config.grpcUseSSL ?? false} onChange={(event) => updateConfig({ grpcUseSSL: event.target.checked })} /><span>Use SSL</span></label><label className="form-toggle"><input type="checkbox" checked={config.grpcTrustCert ?? false} onChange={(event) => updateConfig({ grpcTrustCert: event.target.checked })} /><span>Trust certificate</span></label></div>
  </>
}

function BusinessRuleFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <>
    <div className="compact-fields"><div><ExpressionField label="Rule file location" value={config.ruleFileLocation ?? ''} placeholder="https://rules.example.com/orders.xlsx" onChange={(value) => updateConfig({ ruleFileLocation: value })} /></div><div><label>Execution strategy</label><select className="native-select" value={config.executionStrategy ?? 'FIRE_FIRST'} onChange={(event) => updateConfig({ executionStrategy: event.target.value })}><option>FIRE_FIRST</option><option>FIRE_ALL</option></select></div></div>
    <Input label="Refresh interval (minutes)" type="number" value={config.cacheTimeoutMinutes ?? 60} onChange={(value) => updateConfig({ cacheTimeoutMinutes: value ? Math.max(0, Number(value)) : undefined })} />
    <Textarea label="Input columns (JSON object)" value={config.inputColumns ?? ''} placeholder={'{\n  "customerId": "${workflow.input.customerId}"\n}'} onChange={(value) => updateConfig({ inputColumns: value })} />
    <Textarea label="Output columns (JSON array)" value={config.outputColumns ?? ''} placeholder={'["eligible", "reason"]'} onChange={(value) => updateConfig({ outputColumns: value })} />
  </>
}

function DatabaseFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  const update = config.databaseType === 'UPDATE'
  return <>
    <div className="compact-fields"><div><Input label="Integration name" value={config.integrationName ?? ''} placeholder="postgres-production" onChange={(value) => updateConfig({ integrationName: value })} /></div><div><Input label="Schema name" value={config.schemaName ?? ''} placeholder="public" onChange={(value) => updateConfig({ schemaName: value })} /></div></div>
    <div className="compact-fields"><div><label>Statement type</label><select className="native-select" value={config.databaseType ?? 'SELECT'} onChange={(event) => updateConfig({ databaseType: event.target.value as TaskConfig['databaseType'] })}><option value="SELECT">SELECT</option><option value="UPDATE">INSERT / UPDATE / DELETE</option></select></div>{update && <div><Input label="Expected update count" value={config.expectedUpdateCount ?? ''} placeholder="1" onChange={(value) => updateConfig({ expectedUpdateCount: value })} /></div>}</div>
    <Textarea label="Statement" value={config.sqlQuery ?? ''} placeholder="SELECT * FROM jobs WHERE id = :jobId" onChange={(value) => updateConfig({ sqlQuery: value })} />
    <Textarea label="Query parameters (JSON array)" value={config.jdbcParameters ?? ''} placeholder={'["${workflow.input.jobId}"]'} onChange={(value) => updateConfig({ jdbcParameters: value })} />
  </>
}

function UpdateSecretFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  return <><Input label="Secret key" value={config.secretKey ?? ''} placeholder="database/password" onChange={(value) => updateConfig({ secretKey: value })} /><Input label="Secret value" type="password" value={config.secretValue ?? ''} placeholder="Enter a secret or expression" onChange={(value) => updateConfig({ secretValue: value })} /><span className="field-hint">Secret values are serialized to the canonical <code>_secrets</code> input and should not be committed to source control.</span></>
}

function GenericFields({ kind, config, updateConfig }: Pick<TaskFormProps, 'kind' | 'config' | 'updateConfig'>) {
  return <><Input label={`${kind} resource / operation`} value={config.serviceMethod ?? config.eventName ?? config.ruleName ?? ''} placeholder="Configure the task resource" onChange={(value) => updateConfig({ serviceMethod: value, eventName: value })} /><span className="field-hint">This task type uses the canonical input parameter editor below for type-specific payload fields.</span></>
}

function ForkJoinFields({ config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'>) {
  const branches = config.forkBranches ?? parseForkBranches(config.forkTasks) ?? [[]]
  const updateBranches = (next: WorkflowTaskDraft[][]) => updateConfig({ forkBranches: next, forkTasks: JSON.stringify(next) })
  return <div className="fork-editor"><div className="fork-editor-head"><strong>Fork branches</strong><button className="inline-add-button" onClick={() => updateBranches([...branches, []])}>＋ Add branch</button></div>{branches.map((branch, index) => <div className="fork-editor-branch" key={`fork-editor-${index}`}><div><strong>Branch {index + 1}</strong>{branches.length > 1 && <button className="nested-remove" aria-label={`Remove fork branch ${index + 1}`} onClick={() => updateBranches(branches.filter((_, branchIndex) => branchIndex !== index))}>×</button>}</div>{branch.length ? branch.map((task) => <div className="fork-editor-task" key={task.taskReferenceName}><span>{task.name}</span><small>{task.type}</small><button className="nested-remove" aria-label={`Remove ${task.name} from fork branch ${index + 1}`} onClick={() => updateBranches(branches.map((current, branchIndex) => branchIndex === index ? current.filter((item) => item.taskReferenceName !== task.taskReferenceName) : current))}>×</button></div>) : <span className="field-hint">Empty branch — use the branch + on the canvas to add a task.</span>}</div>)}<span className="field-hint">Branches are serialized as canonical Conductor <code>forkTasks</code>.</span></div>
}

/** Shared task policy controls mirrored from ui-next's retry/timeout sections. */
export function TaskPolicyFields({ kind, config, updateConfig }: Pick<TaskFormProps, 'config' | 'updateConfig'> & { kind?: TaskKind }) {
  return <div className="task-policy-fields">
    <div className="section-caption">Retry strategy</div>
    <div className="compact-fields">
      <div><Input label="Retry count" type="number" value={config.retryCount ?? 0} onChange={(value) => updateConfig({ retryCount: Math.max(0, Number(value)) })} /></div>
      <div><label>Retry logic</label><select className="native-select" value={config.retryLogic ?? 'FIXED'} onChange={(event) => updateConfig({ retryLogic: event.target.value as TaskConfig['retryLogic'] })}><option value="FIXED">Fixed</option><option value="EXPONENTIAL_BACKOFF">Exponential backoff</option><option value="LINEAR_BACKOFF">Linear backoff</option></select></div>
    </div>
    <div className="compact-fields">
      <div><Input label="Retry delay (sec)" type="number" value={config.retryDelaySeconds ?? 0} onChange={(value) => updateConfig({ retryDelaySeconds: Math.max(0, Number(value)) })} /></div>
      <div><Input label="Maximum retry delay" type="number" value={config.maxRetryDelaySeconds ?? 0} onChange={(value) => updateConfig({ maxRetryDelaySeconds: Math.max(0, Number(value)) })} /></div>
    </div>
    <div className="compact-fields">
      <div><Input label="Backoff jitter (ms)" type="number" value={config.backoffJitterMs ?? 0} onChange={(value) => updateConfig({ backoffJitterMs: Math.max(0, Number(value)) })} /></div>
      <div><Input label="Total retry budget (sec)" type="number" value={config.totalTimeoutSeconds ?? 0} onChange={(value) => updateConfig({ totalTimeoutSeconds: Math.max(0, Number(value)) })} /></div>
    </div>
    <div className="section-caption">Timeout policy</div>
    <div className="compact-fields">
      <div><Input label="Execution timeout (sec)" type="number" value={config.timeoutSeconds ?? 0} onChange={(value) => updateConfig({ timeoutSeconds: Math.max(0, Number(value)) })} /></div>
      <div><Input label="Response / heartbeat (sec)" type="number" value={config.responseTimeoutSeconds ?? 0} onChange={(value) => updateConfig({ responseTimeoutSeconds: Math.max(0, Number(value)) })} /></div>
    </div>
    <div className="compact-fields">
      <div><Input label="Poll timeout (sec)" type="number" value={config.pollTimeoutSeconds ?? 0} onChange={(value) => updateConfig({ pollTimeoutSeconds: Math.max(0, Number(value)) })} /></div>
      <div><label>Timeout policy</label><select className="native-select" value={config.taskTimeoutPolicy ?? 'TIMEOUT_TASK'} onChange={(event) => updateConfig({ taskTimeoutPolicy: event.target.value as TaskConfig['taskTimeoutPolicy'] })}><option value="TIMEOUT_TASK">Timeout task</option><option value="ALERT_ONLY">Alert only</option></select></div>
    </div>
    <div className="section-caption">Task data mapping</div>
    <div className="compact-fields">
      <div><Textarea label="Input keys" value={config.inputKeys?.join('\n') ?? ''} placeholder="input.key\nworkflow.input.id" onChange={(value) => updateConfig({ inputKeys: value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></div>
      <div><Textarea label="Output keys" value={config.outputKeys?.join('\n') ?? ''} placeholder="response.body\nresult" onChange={(value) => updateConfig({ outputKeys: value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></div>
    </div>
    {(kind === 'HTTP_POLL' || config.pollIntervalSeconds != null) && <><div className="section-caption">Polling</div><Input label="Poll interval (sec)" type="number" value={config.pollIntervalSeconds ?? 30} onChange={(value) => updateConfig({ pollIntervalSeconds: Math.max(1, Number(value)) })} /><ExpressionField label="Poll condition" value={config.pollCondition ?? ''} placeholder="$.response.body.status == 'COMPLETED'" onChange={(value) => updateConfig({ pollCondition: value })} /></>}
  </div>
}

function parseForkBranches(value?: string): WorkflowTaskDraft[][] | undefined {
  if (!value?.trim()) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) && parsed.every((branch) => Array.isArray(branch)) ? parsed as WorkflowTaskDraft[][] : undefined
  } catch {
    return undefined
  }
}

/**
 * Task form registry boundary. It mirrors ui-next's TaskFormContent dispatch,
 * while using the existing studio controls and Zustand update contract.
 */
export function TaskFormFields({ kind, config, optional, updateConfig, updateData }: TaskFormProps): ReactNode {
  if (kind === 'SIMPLE') {
    const cacheEnabled = Boolean(config.cacheTtlInSecond || config.cacheKey)
    return <><div className="worker-definition-heading">Task Definition</div><Input label="Worker task definition" value={config.workerTaskName ?? ''} placeholder="sayHello" onChange={(value) => updateConfig({ workerTaskName: value })} /><OptionalToggle value={optional} onChange={(value) => updateData({ optional: value })} /><div className="worker-section"><div className="worker-section-title"><strong>Worker task options</strong><span>Task parameters from the Worker Task reference</span></div><div className="compact-fields"><div><Input label="Domain" value={config.workerDomain ?? ''} placeholder="production" onChange={(value) => updateConfig({ workerDomain: value })} /></div><div><Input label="Callback after (sec)" type="number" value={config.callbackAfterSeconds ?? 0} onChange={(value) => updateConfig({ callbackAfterSeconds: Math.max(0, Number(value)) })} /></div></div><div className="compact-fields"><div><Input label="Rate limit / frequency" type="number" value={config.rateLimitPerFrequency ?? 0} onChange={(value) => updateConfig({ rateLimitPerFrequency: Math.max(0, Number(value)) })} /></div><div><Input label="Frequency (sec)" type="number" value={config.rateLimitFrequencyInSeconds ?? 0} onChange={(value) => updateConfig({ rateLimitFrequencyInSeconds: Math.max(0, Number(value)) })} /></div></div><Input label="Concurrent executions limit" type="number" value={config.concurrentExecLimit ?? 0} onChange={(value) => updateConfig({ concurrentExecLimit: Math.max(0, Number(value)) })} /><label className="form-toggle"><input type="checkbox" checked={cacheEnabled} onChange={(event) => updateConfig(event.target.checked ? { cacheTtlInSecond: 300, cacheKey: '${workflow.input.jobId}' } : { cacheTtlInSecond: undefined, cacheKey: undefined })} /><span>Cache task output</span></label>{cacheEnabled && <div className="compact-fields"><div><Input label="TTL (seconds)" type="number" value={config.cacheTtlInSecond ?? 300} onChange={(value) => updateConfig({ cacheTtlInSecond: Number(value) })} /></div><div><Input label="Input-based cache key" value={config.cacheKey ?? ''} placeholder="${workflow.input.jobId}" onChange={(value) => updateConfig({ cacheKey: value })} /></div></div>}<label className="form-toggle"><input type="checkbox" checked={config.enforceSchema ?? false} onChange={(event) => updateConfig({ enforceSchema: event.target.checked })} /><span>Enforce input/output schema</span></label>{config.enforceSchema && <div className="compact-fields"><div><Input label="Input schema" value={config.inputSchema ?? ''} placeholder="worker_input_v1" onChange={(value) => updateConfig({ inputSchema: value })} /></div><div><Input label="Output schema" value={config.outputSchema ?? ''} placeholder="worker_output_v1" onChange={(value) => updateConfig({ outputSchema: value })} /></div></div>}</div></>
  }
  if (kind === 'EVENT' || kind === 'WAIT_FOR_EVENT') return <><Input label="Event name / topic" value={config.eventName ?? ''} placeholder="workflow.events.job.completed" onChange={(value) => updateConfig({ eventName: value })} /><Textarea label="Event payload" value={config.eventPayload ?? ''} placeholder="JSON event payload" onChange={(value) => updateConfig({ eventPayload: value })} /></>
  if (kind === 'KAFKA_PUBLISH') return <KafkaFields config={config} updateConfig={updateConfig} />
  if (kind === 'GRPC') return <GrpcFields config={config} updateConfig={updateConfig} />
  if (kind === 'INLINE') return <Textarea label="JavaScript code" value={config.script ?? ''} placeholder="return { transformed: $.value };" onChange={(value) => updateConfig({ script: value })} />
  if (kind === 'JSON_JQ_TRANSFORM') return <Textarea label="JQ query" value={config.jqQuery ?? ''} placeholder=".payload | { id: .id }" onChange={(value) => updateConfig({ jqQuery: value })} />
  if (kind === 'BUSINESS_RULE') return <BusinessRuleFields config={config} updateConfig={updateConfig} />
  if (kind === 'SQL' || kind === 'JDBC') return <DatabaseFields config={config} updateConfig={updateConfig} />
  if (kind === 'HUMAN') return <><Input label="Assignee" value={config.assignee ?? ''} placeholder="team:operations" onChange={(value) => updateConfig({ assignee: value })} /><Input label="Form key" value={config.formKey ?? ''} placeholder="approval_form" onChange={(value) => updateConfig({ formKey: value })} /></>
  if (kind === 'FORK_JOIN') return <ForkJoinFields config={config} updateConfig={updateConfig} />
  if (kind === 'FORK_JOIN_DYNAMIC') return <><Input label="Dynamic tasks parameter" value={config.dynamicForkTasksParam ?? ''} placeholder="dynamicTasks" onChange={(value) => updateConfig({ dynamicForkTasksParam: value })} /><Input label="Dynamic inputs parameter" value={config.dynamicForkTasksInputParamName ?? ''} placeholder="dynamicTasksInput" onChange={(value) => updateConfig({ dynamicForkTasksInputParamName: value })} /></>
  if (kind === 'JOIN' || kind === 'EXCLUSIVE_JOIN' || kind === 'SWITCH_JOIN') return <><Textarea label="Join on references" value={config.joinOn?.join('\n') ?? ''} placeholder="task_ref_1\ntask_ref_2" onChange={(value) => updateConfig({ joinOn: value.split('\n').map((item) => item.trim()).filter(Boolean) })} /><span className="field-hint">Leave empty for dynamic joins.</span></>
  if (kind === 'DYNAMIC') return <Input label="Dynamic task name parameter" value={config.dynamicTaskNameParam ?? ''} placeholder="taskToExecute" onChange={(value) => updateConfig({ dynamicTaskNameParam: value })} />
  if (kind === 'SUB_WORKFLOW' || kind === 'START_WORKFLOW') return <><Input label="Workflow name" value={kind === 'SUB_WORKFLOW' ? config.subWorkflowName ?? '' : config.startWorkflowName ?? ''} placeholder="child_workflow" onChange={(value) => updateConfig(kind === 'SUB_WORKFLOW' ? { subWorkflowName: value } : { startWorkflowName: value })} /><Input label="Workflow version (optional)" type="number" value={kind === 'SUB_WORKFLOW' ? config.subWorkflowVersion ?? '' : config.startWorkflowVersion ?? ''} onChange={(value) => updateConfig(kind === 'SUB_WORKFLOW' ? { subWorkflowVersion: value ? Number(value) : undefined } : { startWorkflowVersion: value ? Number(value) : undefined })} /></>
  if (kind === 'TERMINATE' || kind === 'TERMINATE_WORKFLOW') return <Textarea label="Termination reason" value={config.terminationReason ?? ''} placeholder="Stopped by workflow policy" onChange={(value) => updateConfig({ terminationReason: value })} />
  if (kind === 'YIELD') return <Textarea label="Yield message" value={config.yieldMessage ?? ''} placeholder="Continue asynchronously after callback" onChange={(value) => updateConfig({ yieldMessage: value })} />
  if (kind === 'SET_VARIABLE') return <><Input label="Variable name" value={config.variableName ?? ''} placeholder="status" onChange={(value) => updateConfig({ variableName: value })} /><ExpressionField label="Variable value" value={config.variableValue ?? ''} placeholder="${workflow.input.status}" onChange={(value) => updateConfig({ variableValue: value })} /></>
  if (kind === 'GET_WORKFLOW') return <ExpressionField label="Workflow execution ID" value={config.workflowId ?? ''} placeholder="${workflow.input.workflowId}" onChange={(value) => updateConfig({ workflowId: value })} />
  if (kind === 'WAIT' || kind === 'WAIT_FOR_WEBHOOK') return <Input label={kind === 'WAIT' ? 'Wait duration (sec)' : 'Webhook name'} value={kind === 'WAIT' ? config.durationSeconds ?? 30 : config.eventName ?? ''} type={kind === 'WAIT' ? 'number' : 'text'} onChange={(value) => updateConfig(kind === 'WAIT' ? { durationSeconds: Number(value) } : { eventName: value })} />
  if (kind === 'GET_SIGNED_JWT') return <SignedJwtFields config={config} updateConfig={updateConfig} />
  if (kind === 'UPDATE_TASK') return <UpdateTaskFields config={config} updateConfig={updateConfig} />
  if (kind === 'QUERY_PROCESSOR') return <QueryProcessorFields config={config} updateConfig={updateConfig} />
  if (kind === 'OPS_GENIE') return <><Input label="Alias" value={config.alias ?? ''} onChange={(value) => updateConfig({ alias: value })} /><Input label="Message" value={config.content ?? ''} onChange={(value) => updateConfig({ content: value })} /><Textarea label="Description" value={config.description ?? ''} onChange={(value) => updateConfig({ description: value })} /></>
  if (kind === 'GET_DOCUMENT' || kind === 'LIST_FILES' || kind === 'PARSE_DOCUMENT') return <DocumentFields kind={kind} config={config} updateConfig={updateConfig} />
  if (kind === 'AGENT' || kind === 'GET_AGENT_CARD' || kind === 'CANCEL_AGENT') return <AgentFields kind={kind} config={config} updateConfig={updateConfig} />
  if (kind === 'SENDGRID') return <SendgridFields config={config} updateConfig={updateConfig} />
  if (kind === 'CHUNK_TEXT') return <><Textarea label="Text" value={config.text ?? ''} placeholder="Text to split" onChange={(value) => updateConfig({ text: value })} /><Input label="Chunk size" type="number" value={config.chunkSize ?? 1024} onChange={(value) => updateConfig({ chunkSize: Math.max(1, Number(value)) })} /></>
  if (kind === 'INTEGRATION' || kind === 'MCP_REMOTE') return <><Input label="Integration name" value={config.integrationName ?? ''} placeholder="integration_name" onChange={(value) => updateConfig({ integrationName: value })} /><Input label="Operation" value={config.operation ?? ''} placeholder="invoke" onChange={(value) => updateConfig({ operation: value })} /></>
  if (kind.startsWith('LLM_')) return <LlmFields kind={kind} config={config} updateConfig={updateConfig} />
  if (kind === 'AI_CHAT_COMPLETION' || kind === 'AI_GENERATE_IMAGE' || kind === 'IA_TASK' || ['AGENT', 'GET_AGENT_CARD', 'CANCEL_AGENT', 'LIST_MCP_TOOLS', 'CALL_MCP_TOOL', 'GENERATE_IMAGE', 'GENERATE_AUDIO', 'GENERATE_VIDEO', 'GENERATE_PDF'].includes(kind)) return <AiFields config={config} updateConfig={updateConfig} />
  if (kind === 'UPDATE_SECRET') return <UpdateSecretFields config={config} updateConfig={updateConfig} />
  if (kind === 'LIST_MCP_TOOLS' || kind === 'CALL_MCP_TOOL' || kind === 'TASK_SUMMARY' || kind === 'LAMBDA' || kind === 'USER_DEFINED' || kind === 'JUMP') return <GenericFields kind={kind} config={config} updateConfig={updateConfig} />
  return <><GenericFields kind={kind} config={config} updateConfig={updateConfig} /><span className="field-hint">This task has no dedicated editor in the current catalog. Use Code or Input Parameters for advanced fields.</span></>
}
