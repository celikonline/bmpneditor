# Orkes / Conductor Uyumlu BPMN & Workflow Studio — Full Specification v2
## Production-Ready UX, Frontend Architecture, Domain Model ve Uygulama Spesifikasyonu

> Amaç: Ekteki Orkes/Conductor ekran görüntülerindeki kullanım deneyimini ve güncel Orkes workflow developer guide davranışlarını temel alarak, modern, ölçeklenebilir, kurumsal seviyede bir **workflow/BPMN tasarım arayüzü** geliştirmek.
>
> Bu doküman doğrudan bir coding AI / agent / principal frontend engineer’a verilecek şekilde hazırlanmıştır.
>
> Hedef: “görsel olarak benzer bir ekran” değil; gerçek ürün seviyesinde **workflow designer + task editor + run/debug + dependencies + code + assistant + validation + versioning** deneyimi üretmek.

---

# 0. Kritik Mimari Not

Orkes Conductor arayüzü görsel olarak BPMN editörüne benzese de, Conductor’ın çekirdek modeli klasik BPMN 2.0 XML runtime semantiği değildir. Temel model JSON-native, durable bir **workflow orchestration graph** yaklaşımıdır.

Orkes, v5.0.1 ve sonrasında BPMN/XML dosyalarını içe aktararak Conductor workflow definition'a dönüştürebilir. Bu nedenle BPMN desteği ürünümüzde ayrı bir runtime motoru gibi değil, canonical workflow modeline bağlanan bir **import/export/compatibility adapter** olarak ele alınmalıdır.

Ürün iki görünüm/uyumluluk katmanı sunmalıdır:

1. **Workflow Graph Mode**
   - Orkes/Conductor benzeri node tabanlı workflow modelleme
   - HTTP, Worker/SIMPLE, Switch, Fork/Join, Dynamic Fork, Wait, Event, Sub Workflow, Start Workflow, Human Task vb.
   - JSON workflow definition üretimi
   - Durable execution ve versioned definition davranışlarını destekleyen model

2. **BPMN Compatibility**
   - `.bpmn` / XML import
   - Start Event, End Event, Service Task, User Task, gateways, subprocess ve sequence flow mapping
   - Import sonrası canonical graph + Conductor-compatible JSON oluşturma
   - BPMN export bizim ürün uzantımız olabilir; Orkes guide'da doğrulanan temel özellik BPMN import'tur

Arayüz aynı kalmalı; Conductor/BPMN detayları adapter katmanında çözülmelidir.

---

# 1. Ürün Vizyonu

Kullanıcı tek bir ekranda:

- Workflow oluşturabilmeli
- Node ekleyebilmeli
- Node’ları bağlayabilmeli
- Branch oluşturabilmeli
- Task ayarlarını düzenleyebilmeli
- Workflow JSON/BPMN XML görebilmeli
- Task test edebilmeli
- Workflow execute edebilmeli
- Çalışma sonucunu izleyebilmeli
- Validation hatalarını görebilmeli
- Dependencies yönetebilmeli
- AI Assistant ile workflow üretebilmeli
- Versiyon yönetebilmeli
- Save / Reset / Download işlemlerini yapabilmeli

Ana UX prensibi:

> Canvas solda, context-aware inspector sağda, workflow-level komutlar üstte, execution/assistant deneyimi sağ panel ve alt drawer üzerinden yönetilir.

---

# 2. Referans Ekranlardan Çıkarılan Ana Yapı

Ekran aşağıdaki bölgelere ayrılmalıdır:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Header / Breadcrumb / Version / Delete / Reset / Download / Execute     │
├──────────────────────────────┬───────────────────────────────────────────────┤
│                              │ Right Inspector                               │
│                              │ ┌───────────────────────────────────────────┐ │
│                              │ │ Workflow | Task | Code | Run | Dependencies│ │
│       Workflow Canvas        │ ├───────────────────────────────────────────┤ │
│                              │ │                                           │ │
│                              │ │ Context-aware editor                      │ │
│                              │ │                                           │ │
│                              │ └───────────────────────────────────────────┘ │
│                              │ ┌───────────────────────────────────────────┐ │
│                              │ │ Assistant / Conversations Drawer         │ │
│                              │ └───────────────────────────────────────────┘ │
├──────────────────────────────┴───────────────────────────────────────────────┤
│ Validation / warnings status bar                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. Teknoloji Kararı

## 3.1 Frontend

Önerilen stack:

- React 19+
- TypeScript strict mode
- Vite
- React Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Monaco Editor
- React Flow / `@xyflow/react`
- dnd-kit
- Radix UI
- Tailwind CSS veya CSS Modules + design tokens
- Lucide Icons
- Framer Motion
- i18next
- Vitest
- Playwright
- MSW
- Storybook

## 3.2 Neden React Flow / xyflow?

Workflow canvas için aşağıdakileri hazır ve güvenilir sağlar:

- Pan
- Zoom
- MiniMap
- Handles
- Edges
- Node selection
- Drag
- Connect
- Fit view
- Custom nodes
- Custom edges
- Viewport control

Canvas motorunu sıfırdan yazmak yasaktır.

---

# 4. Ana Frontend Mimari Yapısı

```text
src/
├─ app/
│  ├─ router/
│  ├─ providers/
│  ├─ error-boundary/
│  └─ bootstrap/
│
├─ pages/
│  ├─ workflow-list/
│  ├─ workflow-builder/
│  └─ execution-detail/
│
├─ features/
│  ├─ workflow-canvas/
│  ├─ workflow-header/
│  ├─ workflow-inspector/
│  ├─ workflow-versioning/
│  ├─ task-editor/
│  ├─ task-palette/
│  ├─ workflow-code/
│  ├─ workflow-run/
│  ├─ workflow-dependencies/
│  ├─ workflow-validation/
│  ├─ workflow-assistant/
│  ├─ workflow-history/
│  └─ workflow-import-export/
│
├─ entities/
│  ├─ workflow/
│  ├─ workflow-node/
│  ├─ workflow-edge/
│  ├─ workflow-version/
│  ├─ execution/
│  ├─ task-definition/
│  └─ integration/
│
├─ shared/
│  ├─ api/
│  ├─ ui/
│  ├─ hooks/
│  ├─ lib/
│  ├─ utils/
│  ├─ constants/
│  ├─ types/
│  └─ design-system/
│
└─ tests/
```

---

# 5. Builder Sayfası Route Tasarımı

```text
/workflows
/workflows/new
/workflows/:workflowId
/workflows/:workflowId/version/:version
/workflows/:workflowId/executions/:executionId
```

Örnek:

```text
/workflows/endpoint_health_monitor/version/3
```

---

# 6. Sayfa Genel Layout

## 6.1 Desktop

```css
display: grid;

grid-template-columns:
  minmax(560px, 1fr)
  minmax(480px, 42vw);

grid-template-rows:
  64px
  1fr
  auto;
```

## 6.2 Split Pane

Canvas ile sağ panel arasındaki çizgi draggable olmalıdır.

Minimum:

```text
Canvas: 480px
Inspector: 420px
```

Sağ panel kapatılabilir.

Klavye:

```text
Ctrl + Shift + I → Inspector toggle
```

---

# 7. Top Header

## 7.1 Sol Alan

Göster:

```text
Workflow Definitions / endpoint_health_monitor
endpoint_health_monitor
```

Breadcrumb:

```text
Workflow Definitions
/
endpoint_health_monitor
```

Workflow adı büyük heading.

---

## 7.2 Sağ Action Alanı

Sıra:

```text
Version Dropdown
Delete
Reset
Download
Execute
Save
Save Dropdown
```

### Version Dropdown

Örnek:

```text
Latest version
Version 3
Version 2
Version 1
```

Dropdown içeriği:

- version
- createdAt
- createdBy
- status
- published/draft

---

## 7.3 Save

Ana CTA.

Durumlar:

```text
Save
Saving...
Saved
Save failed
```

Dirty indicator:

```text
● Unsaved changes
```

### Save Dropdown

```text
Save
Save as new version
Save draft
Publish
```

---

## 7.4 Execute

Primary action.

Execute basıldığında:

- validation çalıştır
- blocker varsa çalıştırma
- execution drawer/modal aç
- input schema form göster
- Execute butonu

---

## 7.5 Reset

Unsaved değişiklikleri son persisted versiyona döndürür.

Confirmation:

```text
Discard all unsaved changes?
```

---

## 7.6 Download

Dropdown:

```text
Workflow JSON
BPMN XML
SVG Diagram
PNG Diagram
Execution Definition
```

---

# 8. Canvas Tasarımı

Canvas büyük beyaz alan olmalıdır.

Arka plan:

```text
1px dotted grid
24px spacing
```

Node alignment:

```text
vertical flow default
```

---

# 9. Canvas Toolbar

Sol üst floating toolbar:

```text
Home
Zoom %
Zoom Out
Zoom In
Fit View
Select Area
Print
Help
Search
```

Önerilen tooltip:

```text
Fit workflow to screen
Zoom in
Zoom out
Search workflow
```

---

# 10. Canvas Zoom

Minimum:

```text
20%
```

Maximum:

```text
200%
```

Default:

```text
80%
```

Wheel:

```text
Ctrl + wheel = zoom
wheel = vertical scroll/pan
Shift + wheel = horizontal pan
```

Trackpad desteklenmelidir.

---

# 11. Workflow Node Tasarım Sistemi

## 11.1 Generic Task Node

Node boyutu:

```text
width: 220–260px
min-height: 72px
```

Yapı:

```text
┌────────────────────────────────────┐
│ [icon] Task Name          [TYPE] x │
│        reference_name              │
│                                    │
│ metadata / summary                 │
└────────────────────────────────────┘
               +
```

İçerik:

- task icon
- task display name
- reference name
- type badge
- delete action
- warning indicator
- input/output summary
- connection handle

---

# 12. Node States

## Default

```text
white background
neutral border
```

## Hover

```text
border accent
shadow-sm
```

## Selected

```text
blue border
blue subtle shadow
```

## Running

```text
blue animated outline
```

## Completed

```text
green marker
```

## Failed

```text
red border
error icon
```

## Skipped

```text
muted
```

## Waiting

```text
amber
```

---

# 13. Start / End Node

## Start

Circle:

```text
Start
```

Altında plus connector.

## End

Circle:

```text
End
```

Incoming edge only.

---

# 14. Edge Tasarımı

Default:

```text
thin neutral stroke
```

Selected:

```text
blue
```

Execution successful:

```text
green
```

Failed:

```text
red
```

Conditional branch label göster:

```text
healthy
failed
defaultCase
```

---

# 15. Plus Connector Davranışı

Her node altındaki `+`:

Tıklanınca **Quick Add** açılır.

Quick Add popup:

```text
Search tasks...

QUICK ADD

Worker Task
HTTP Task
HTTP Poll Task
gRPC Task
Publish Event
Switch

Fork Join
Do While
Set Variable
Wait
Sub Workflow
Start Workflow

Terminate
Javascript
Connected Apps
Human Task

-------------------
AGENTIC ORCHESTRATION

Chat Complete
Generate Embeddings
Search Embeddings
Index Document
Search Documents
Agent
Get Agent
Cancel Agent
List MCP Tools
Call MCP Tool
Generate Image

                 More tasks
```

---

# 16. Quick Add Popup

## Arama

Placeholder:

```text
Search tasks...
```

Search:

- task name
- category
- description
- tag

Keyboard:

```text
Arrow Up / Down
Enter
Esc
```

---

# 17. Full Add Task Drawer

`More tasks` seçildiğinde sağ drawer:

```text
Add Task
```

Search.

Category tabs:

```text
All
System
AI
Worker Tasks
Connected Apps
```

---

# 18. Add Task Liste Satırı

Örnek:

```text
[icon] HTTP Task
       Call an API / Microservice.
```

Liste scrollable.

Task catalog server-driven olmalıdır.

---

# 19. Task Catalog Domain Model

```ts
type TaskCatalogItem = {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  category:
    | "system"
    | "worker"
    | "integration"
    | "ai"
    | "human"
    | "control-flow";

  tags: string[];

  configSchema: JsonSchema;
  uiSchema?: object;

  capabilities: {
    supportsTest: boolean;
    supportsRetry: boolean;
    supportsTimeout: boolean;
    supportsInputMapping: boolean;
    supportsOutputMapping: boolean;
  };
};
```

---

# 20. Minimum Task Tipleri

## Core

- Worker Task
- HTTP Task
- HTTP Poll Task
- gRPC Task
- Event Task
- Inline JS Task
- JSON JQ Transform
- SQL Query
- Query Processor
- Get Signed JWT
- Update Task
- Update Secret Task
- Wait for Webhook
- SendGrid Task

## Control Flow

- Switch
- Fork
- Join
- Fork/Join
- Do While
- Wait
- Terminate
- Sub Workflow
- Start Workflow

## Human

- Human Task
- Approval Task
- Form Task

## AI

- LLM Chat Completion
- Prompt Task
- Embedding Generation
- Vector Search
- Document Index
- Document Search
- Agent
- MCP Tool List
- MCP Tool Call
- Image Generation

---

# 21. Switch Node

Görsel:

```text
       ◇
 route_on_status
```

Switch diamond kullanılabilir.

Branch handle’ları:

```text
defaultCase
healthy
failed
timeout
```

Her branch ayrı edge üretir.

---

# 22. Switch Editor

Inspector:

```text
Evaluation Expression

$.check_status.output.response.status

Cases
--------------------------------
200    -> healthy
500    -> failed
timeout -> timeout

Default
--------------------------------
defaultCase
```

Alternative expression:

```text
Javascript
JSONPath
JQ
Expression language
```

---

# 23. Fork / Join Görünümü

Fork region backdrop desteklenmelidir.

Örnek:

```text
┌─────────────────────────────┐
│ poll_job_status             │
│                             │
│ wait_between_polls          │
│ check_status                │
└─────────────────────────────┘
```

Container selected olduğunda hafif mavi background.

---

# 24. Right Inspector

Top tabs:

```text
Workflow
Task
Code
Run
Dependencies
```

Aktif tab blue underline.

---

# 25. Workflow Tab

Workflow metadata:

```text
Name
Description
Version
Owner
Tags
Timeout Policy
Execution Timeout
Restartable
Input Parameters
Output Parameters
Schema
Variables
Rate Limits
Metadata
```

---

# 26. Workflow Name

Validation:

```text
^[a-zA-Z0-9_-]+$
```

Öneri:

```text
endpoint_health_monitor
```

---

# 27. Workflow Input Schema

JSON Schema tabanlı.

Örnek:

```json
{
  "type": "object",
  "properties": {
    "endpointUrl": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": ["endpointUrl"]
}
```

Execute form otomatik üretilebilir.

---

# 28. Task Tab

Node seçilince Task tab otomatik aktif olabilir.

Header:

```text
LIST_FILES    SETTINGS
```

Task type badge.

Docs link:

```text
LIST_FILES Docs
```

Test action:

```text
Test Task
```

---

# 29. Task Form Yapısı

Örnek:

```text
Task definition
Reference name

Configuration

Integration Name
Input Location
File Types
Output Location

Advanced Integration Configuration
```

Dynamic form schema-driven olmalıdır.

---

# 30. Task Definition Alanı

```text
taskDefinitionName
```

Task registry içinden seçilebilir.

---

# 31. Reference Name

Graph içinde unique.

Örnek:

```text
list_files_ref
```

Kurallar:

```text
lower snake_case
unique per workflow
```

---

# 32. Input Mapping

Expression autocomplete desteklenmelidir.

Örnek:

```text
${workflow.input.endpointUrl}
${check_endpoint_ref.output.response.body}
${workflow.variables.retryCount}
```

Editor autocomplete kaynakları:

- workflow.input
- workflow.output
- workflow.variables
- task refs
- secrets
- env variables

---

# 33. Input Expression Editor

Normal input yerine gelişmiş expression editor.

Özellikler:

- syntax highlight
- autocomplete
- error underline
- hover preview
- value inspector
- schema-aware suggestion

---

# 34. Test Task

`Test Task` basıldığında floating popover veya drawer.

UI:

```text
Test Task

Input
{ ... }

Run Test

Output
{ ... }

Status
Failed / Completed

Execution ID
```

---

# 35. Test Task Sonucu

Örnek:

```text
Failed
Click the link to view the full execution
execution-id...
```

Copy JSON.

Expand output.

---

# 36. Code Tab

Monaco Editor kullanılmalıdır.

Format:

```text
JSON
```

BPMN mode ise:

```text
XML
```

Toolbar:

```text
Format
Validate
Copy
Download
Diff
```

---

# 37. Code ↔ Canvas Senkronizasyonu

Çift yönlü sync.

### Canvas değişirse:

```text
graph -> domain model -> JSON/XML
```

### Code değişirse:

```text
parse -> validate -> graph rebuild
```

Invalid code durumunda graph overwrite edilmemeli.

Banner:

```text
Code contains errors. Canvas is showing last valid version.
```

---

# 38. Code Validation

Hatalar:

```text
Schema Error
Unknown task type
Duplicate taskReferenceName
Broken dependency
Invalid switch branch
Missing start node
Unreachable node
Cycle detected
Invalid expression
```

---

# 39. Run Tab

Workflow execution control.

Alanlar:

```text
Input
Correlation ID
Priority
Execution Name
Metadata
Idempotency Key
```

CTA:

```text
Execute Workflow
```

---

# 40. Run Sonrası

Run tab şu bilgileri gösterir:

```text
Execution ID
Status
Started At
Duration
Current Task
Input
Output
Errors
Retries
Timeline
```

---

# 41. Execution Durumları

```ts
type ExecutionStatus =
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "TIMED_OUT"
  | "TERMINATED"
  | "FAILED";
```

---

# 42. Canvas Execution Overlay

Run izlenirken node’lar durumlarına göre renklensin.

Node badge:

```text
✔ COMPLETED
⟳ RUNNING
✕ FAILED
⏳ WAITING
```

Click -> task execution detail.

---

# 43. Execution Timeline

Sağ panel:

```text
10:02:01 Workflow started
10:02:02 HTTP check_endpoint started
10:02:02 HTTP check_endpoint completed
10:02:03 evaluate_health started
10:02:03 Switch route_on_health completed
10:02:04 send_health_alert skipped
10:02:04 endpoint_is_healthy completed
10:02:04 Workflow completed
```

---

# 44. Dependencies Tab

Accordion:

```text
Integrations
AI Prompts
Secrets
Environment Variables
User Forms
Schemas
Task Definitions
Sub Workflows
```

---

# 45. Integrations

Liste:

```text
Slack
SendGrid
S3
PostgreSQL
REST APIs
Kafka
RabbitMQ
OpenAI
Azure OpenAI
Anthropic
```

Workflow’un kullandıkları highlight edilmeli.

---

# 46. Secrets

Sadece secret name göster.

Asla value gösterme.

Örnek:

```text
SENDGRID_API_KEY
OPENAI_API_KEY
DATABASE_PASSWORD
```

---

# 47. Environment Variables

```text
API_BASE_URL
DEFAULT_TIMEOUT
MAX_RETRY
```

---

# 48. Validation Status Bar

Bottom right / bottom full width.

Örnek:

```text
ⓘ 0 warnings found.
```

Durum:

```text
green → clean
yellow → warning
red → error
```

---

# 49. Validation Drawer

Status bar tıklanınca:

```text
Validation

Errors 0
Warnings 2
Info 3
```

Örnek:

```text
WARNING
Task "check_endpoint" has no retry policy.

WARNING
Switch "route_on_health" has no explicit timeout branch.
```

Click -> node seç.

---

# 50. Workflow Assistant

Bottom right drawer.

Header:

```text
Assistant                    Conversations
```

Default welcome:

```text
Welcome to Workflow Assistant!

I can help you build workflows.

Try asking me to:
• Create a new workflow
• Add tasks to your workflow
• Generate worker code
• Explain task types
```

---

# 51. Assistant Input

Context chips:

```text
endpoint_health_monitor
WORKFLOW BUILDER
```

Placeholder:

```text
Ask me anything about your workflow...
```

---

# 52. AI Assistant Yetkinlikleri

Assistant şu action’ları yapabilmeli:

```text
createWorkflow
addTask
removeTask
updateTask
connectTasks
createSwitch
createBranch
addRetry
addTimeout
generateWorkerCode
explainTask
validateWorkflow
fixWorkflow
generateInputSchema
generateOutputSchema
generateTestInput
executeTest
```

---

# 53. AI Action Güvenlik Modeli

AI doğrudan persist etmemeli.

Akış:

```text
User prompt
↓
AI proposal
↓
Preview changes
↓
User Apply
↓
Graph mutation
↓
Validation
↓
Save
```

Örnek:

```text
Assistant proposes 4 changes

+ Add HTTP task "check_status"
+ Add Switch "route_status"
+ Add Wait task
+ Connect timeout branch

[Review] [Apply]
```

---

# 54. Assistant Conversation History

Dropdown:

```text
Conversations
```

Liste:

```text
Today
- Endpoint health workflow
- Retry logic improvements

Yesterday
- Kafka publishing flow
```

---

# 55. Undo / Redo

Zorunlu.

Keyboard:

```text
Ctrl + Z
Ctrl + Shift + Z
```

Minimum 50 history state.

Graph mutation command pattern önerilir.

---

# 56. Keyboard Shortcuts

```text
Delete       Delete selected
Ctrl + S     Save
Ctrl + Z     Undo
Ctrl + Y     Redo
Ctrl + C     Copy node
Ctrl + V     Paste node
Ctrl + D     Duplicate
Ctrl + F     Search
Ctrl + 0     Fit view
Esc          Deselect / close popup
Enter        Edit selected
```

---

# 57. Node Context Menu

Right click:

```text
Edit
Duplicate
Disable
Test
Run from here
Copy
Delete
View JSON
Add before
Add after
Add branch
```

---

# 58. Canvas Search

Search açıldığında:

```text
Search workflow...
```

Bulabilir:

- task name
- ref name
- type
- branch
- integration

Enter -> node’a focus.

---

# 59. Auto Layout

Button:

```text
Auto Layout
```

Algoritma:

- Dagre
veya
- ELK.js

Tercih:

```text
ELK.js
```

Çünkü nested graphs ve complex branching daha güçlüdür.

---

# 60. Layout Rules

Default flow:

```text
top → bottom
```

Switch:

```text
branches spread horizontally
```

Join:

```text
branches converge
```

Minimum node gap:

```text
vertical 56px
horizontal 48px
```

---

# 61. Node Drag

Snap grid:

```text
12px
```

Multi-select destekle.

Shift-click.

Drag rectangle selection.

---

# 62. Copy/Paste

Workflow içi.

Cross workflow paste desteklenebilir.

Paste sırasında ref name conflict çöz:

```text
check_status_ref
check_status_ref_2
```

---

# 63. Workflow Domain Model

```ts
export type WorkflowDefinition = {
  id: string;
  name: string;
  description?: string;

  version: number;

  status:
    | "DRAFT"
    | "PUBLISHED"
    | "ARCHIVED";

  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;

  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  settings: WorkflowSettings;

  metadata: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
};
```

---

# 64. Workflow Node Model

```ts
export type WorkflowNode = {
  id: string;

  type: WorkflowNodeType;

  taskDefinitionName?: string;

  referenceName: string;

  name: string;

  position: {
    x: number;
    y: number;
  };

  config: Record<string, unknown>;

  inputParameters?: Record<string, unknown>;

  outputParameters?: Record<string, unknown>;

  retryPolicy?: RetryPolicy;

  timeoutPolicy?: TimeoutPolicy;

  ui?: {
    collapsed?: boolean;
    width?: number;
    height?: number;
  };
};
```

---

# 65. Edge Model

```ts
export type WorkflowEdge = {
  id: string;

  source: string;
  target: string;

  sourceHandle?: string;
  targetHandle?: string;

  branch?: {
    type:
      | "default"
      | "case"
      | "success"
      | "failure"
      | "timeout";

    value?: string;
    label?: string;
  };
};
```

---

# 66. Retry Model

```ts
export type RetryPolicy = {
  retryCount: number;

  retryLogic:
    | "FIXED"
    | "EXPONENTIAL_BACKOFF"
    | "LINEAR_BACKOFF";

  retryDelaySeconds: number;
  maxRetryDelaySeconds?: number;
  backoffJitterMs?: number;
  totalTimeoutSeconds?: number;
};
```

---

# 67. Timeout Model

```ts
export type TimeoutPolicy = {
  timeoutSeconds: number;
  responseTimeoutSeconds?: number;
  pollTimeoutSeconds?: number;

  timeoutPolicy:
    | "RETRY"
    | "TIME_OUT_WF"
    | "ALERT_ONLY";
};
```

---

# 68. Workflow Settings

```ts
export type WorkflowSettings = {
  workflowTimeoutSeconds?: number;

  executionNameExpression?: string;

  restartable: boolean;

  ownerEmail?: string;

  schemaVersion?: number;

  rateLimit?: {
    limit: number;
    periodSeconds: number;
  };
};
```

---

# 69. API Tasarımı

## Workflow

```http
GET    /api/workflows
POST   /api/workflows
GET    /api/workflows/:id
PUT    /api/workflows/:id
DELETE /api/workflows/:id
```

---

# 70. Version API

```http
GET  /api/workflows/:id/versions
GET  /api/workflows/:id/versions/:version
POST /api/workflows/:id/versions
```

---

# 71. Validation API

```http
POST /api/workflows/validate
```

Request:

```json
{
  "workflow": {}
}
```

Response:

```json
{
  "valid": false,
  "errors": [],
  "warnings": []
}
```

---

# 72. Execution API

```http
POST /api/workflows/:id/execute
GET  /api/executions/:executionId
POST /api/executions/:executionId/pause
POST /api/executions/:executionId/resume
POST /api/executions/:executionId/retry
POST /api/executions/:executionId/terminate
```

---

# 73. Task Test API

```http
POST /api/tasks/test
```

Request:

```json
{
  "taskType": "HTTP",
  "configuration": {},
  "input": {}
}
```

---

# 74. Task Catalog API

```http
GET /api/task-catalog
```

Task types frontend’e hard-code edilmemelidir.

---

# 75. Realtime Execution

Önerilen:

```text
WebSocket
```

Fallback:

```text
SSE
```

Events:

```text
workflow.started
workflow.completed
workflow.failed

task.started
task.completed
task.failed
task.retrying

workflow.variable.updated
```

---

# 76. Local Draft State

Zustand slices:

```text
workflowSlice
canvasSlice
selectionSlice
historySlice
validationSlice
executionSlice
assistantSlice
uiSlice
```

---

# 77. Server State

TanStack Query.

Server state Zustand içine kopyalanmamalıdır.

---

# 78. Dirty State

Workflow değişimlerinde hash comparison.

```text
persistedSnapshotHash
currentSnapshotHash
```

Different -> dirty.

---

# 79. Autosave

Default kapalı.

Optional:

```text
Autosave draft every 15 seconds
```

Sadece draft.

Published versiyonu overwrite etme.

---

# 80. Optimistic UI

Node move gibi UI-only changes optimistic olabilir.

Save işlemi server confirmation gerektirir.

---

# 81. Versioning Kuralları

Ürün varsayılanında güvenli versioning uygulanmalıdır:

```text
Version 3
→ Edit
→ Draft Version 4
→ Validate/Test
→ Publish
```

**Orkes uyumluluk notu:** Conductor aynı version numarasındaki definition'ın güncellenmesine izin verebilir; ancak halihazırda başlamış execution'lar başlangıç anındaki definition snapshot'ı ile devam eder. Bu nedenle bizim ürünümüzde `Update current version in place` yalnızca ileri seviye/izinli bir seçenek olmalı; varsayılan davranış yeni version üretmek olmalıdır.

---

# 82. Semantic Version Opsiyonu

Enterprise mode:

```text
1.4.2
```

Kurallar:

```text
patch → metadata/config update
minor → backward-compatible workflow change
major → breaking input/output change
```

---

# 83. Diff Viewer

Versiyon seçip:

```text
Compare v3 ↔ v4
```

Göster:

```text
+ added node
- removed node
~ changed property
~ changed edge
```

Canvas overlay ile de gösterilebilir.

---

# 84. BPMN Import

Destek:

```text
.bpmn
.xml
```

Parse et.

BPMN task’larını internal model’e map et.

---

# 85. BPMN Export

Internal domain -> BPMN adapter.

BPMN Diagram Interchange coordinates yazılmalıdır.

> Not: Orkes developer guide güncel olarak BPMN import davranışını açıkça dokümante etmektedir. BPMN export burada bizim ürün kabiliyetimiz olarak tasarlanmıştır; Orkes uyumluluğu için zorunlu kabul edilmemelidir.

---

# 86. BPMN Mapping

| BPMN | Internal |
|---|---|
| StartEvent | START |
| EndEvent | END |
| ServiceTask | WORKER / HTTP |
| UserTask | HUMAN |
| ExclusiveGateway | SWITCH |
| ParallelGateway | FORK_JOIN |
| SubProcess | SUB_WORKFLOW |
| TimerEvent | WAIT/TIMER |
| SequenceFlow | EDGE |

---

# 87. Orkes/Conductor JSON Adapter

Ayrı package:

```text
workflow-adapters/
├─ conductor/
├─ bpmn/
└─ internal/
```

Hiçbir UI component doğrudan Conductor JSON formatına bağımlı olmamalıdır.

---

# 88. Adapter Interface

```ts
export interface WorkflowAdapter<TExternal> {
  import(source: TExternal): WorkflowDefinition;

  export(
    workflow: WorkflowDefinition
  ): TExternal;

  validate?(
    source: TExternal
  ): ValidationResult;
}
```

---

# 89. Security

## Frontend

- Secret değerlerini render etme
- HTML sanitize
- expression injection kontrolü
- unsafe JS execution client-side yasak
- CSP
- XSS önleme
- trusted types mümkünse aktif

---

# 90. Task Test Security

Inline JS browser’da eval ile çalıştırılmamalı.

Backend sandbox.

Tercihler:

- isolated worker
- container sandbox
- V8 isolate
- timeout
- memory limit

---

# 91. RBAC

Roller:

```text
Viewer
Editor
Executor
Publisher
Admin
```

Permission:

```text
workflow.read
workflow.edit
workflow.execute
workflow.publish
workflow.delete
secret.use
secret.manage
integration.manage
```

---

# 92. Audit Log

Her kritik action log:

```text
workflow.created
workflow.updated
workflow.published
workflow.executed
workflow.deleted

task.tested
secret.bound
integration.changed
```

---

# 93. Accessibility

WCAG AA.

Zorunlu:

- keyboard navigation
- focus ring
- aria labels
- no color-only status
- contrast
- screen reader labels

---

# 94. Responsive Davranış

## ≥ 1440px

Split view.

## 1024–1439px

Inspector width küçülür.

## < 1024px

Inspector drawer.

Mobile editing desteklenmek zorunda değil.

Mobile read-only olabilir.

---

# 95. Performance Hedefleri

Workflow:

```text
100 node → smooth
500 node → usable
1000 node → degraded but functional
```

Canvas FPS:

```text
>= 45 FPS typical
```

Initial builder load:

```text
< 2.5 sec
```

Inspector task switch:

```text
< 100 ms perceived
```

---

# 96. Büyük Workflow Optimizasyonu

- memoized custom nodes
- viewport culling
- lazy inspector forms
- lazy Monaco
- derived state selectors
- avoid global rerender
- debounced validation
- Web Worker for layout
- Web Worker for graph validation

---

# 97. Validation Engine

İki seviye:

```text
client validation
server validation
```

Client hızlı feedback.

Server authoritative.

---

# 98. Graph Validations

Zorunlu:

```text
Exactly one START
At least one END
No orphan node
No broken edge
No duplicate referenceName
No forbidden cycle
No invalid branch
No unresolved task
No invalid expression
No missing required config
```

---

# 99. Advanced Validations

```text
Switch without default
Fork without join
Dead branch
Unreachable task
Task with timeout < HTTP timeout
Potential infinite loop
Sub workflow missing
Secret missing
Integration missing
```

---

# 100. Error UX

Error sadece toast olarak verilmemeli.

Üç katman:

1. field error
2. inspector error summary
3. global validation drawer

---

# 101. Toast Kullanımı

Toast sadece transient event:

```text
Workflow saved
Version published
Task test started
Execution terminated
```

Persistent hata toast içinde tutulmamalı.

---

# 102. Design System

## Renk Tokenları

```css
--bg-app
--bg-canvas
--bg-panel
--bg-muted

--border-default
--border-strong

--text-primary
--text-secondary
--text-muted

--accent
--success
--warning
--danger
--info
```

---

# 103. Spacing

4px grid.

```text
4
8
12
16
20
24
32
40
48
64
```

---

# 104. Radius

```text
control: 6px
card: 8px
dialog: 12px
```

Orkes benzeri görünüm için aşırı yuvarlak kart kullanılmamalı.

---

# 105. Typography

Öneri:

```text
Inter
```

Alternatif:

```text
Geist
```

Code:

```text
JetBrains Mono
```

---

# 106. Button Hiyerarşisi

Primary:

```text
Execute
Save
```

Secondary:

```text
Download
```

Danger text:

```text
Delete
```

Reset:

```text
warning/neutral
```

---

# 107. Inspector Form Kuralları

Label üstte.

Input full width.

Section:

```text
Configuration
```

Accordion gerekirse.

Field spacing:

```text
16px
```

---

# 108. JSON Editor

Monaco.

Features:

- schema autocomplete
- error markers
- folding
- minimap optional
- format
- copy

---

# 109. Dependency Accordion

Collapsed default.

Dependency varsa count:

```text
Secrets (3)
```

---

# 110. Empty States

Canvas:

```text
Create your first task
```

Inspector:

```text
Select a task to configure it.
```

Dependencies:

```text
No dependencies used by this workflow.
```

Run:

```text
This workflow has not been executed yet.
```

---

# 111. Loading States

Skeleton.

Canvas loader asla full-screen spinner olmamalı.

Graph önce skeleton frame gösterebilir.

---

# 112. Error Boundary

Builder crash durumunda:

```text
Workflow Builder encountered an error.

Reload builder
Return to workflow list
Download recovery draft
```

Recovery draft çok değerlidir.

---

# 113. Local Recovery

Unsaved workflow düzenlemeleri local persistence:

```text
IndexedDB
```

Browser crash sonrası:

```text
Recover unsaved draft?
```

---

# 114. Collaborative Editing – Faz 2

Optional:

- Yjs
- WebSocket
- live cursors
- presence
- conflict-free editing

İlk sürümde zorunlu değildir.

---

# 115. Comments – Faz 2

Node comment.

Mention:

```text
@user
```

Resolve/unresolve.

---

# 116. Workflow Templates

Template gallery:

```text
HTTP Health Check
API Polling
Approval Flow
Kafka Consumer Processing
File Processing
ETL
LLM RAG Pipeline
Human-in-the-loop AI
Retry with DLQ
```

---

# 117. endpoint_health_monitor Örnek Workflow

```text
Start
  ↓
check_endpoint
  ↓
evaluate_health
  ↓
list_files
  ↓
route_on_health
  ├── defaultCase
  │      ↓
  │  send_health_alert
  │
  └── healthy
         ↓
     endpoint_is_healthy
         ↓
        End
```

---

# 118. Örnek Workflow JSON

```json
{
  "name": "endpoint_health_monitor",
  "version": 1,
  "description": "Monitors an HTTP/S endpoint for availability.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "endpointUrl": {
        "type": "string",
        "format": "uri"
      }
    },
    "required": ["endpointUrl"]
  },
  "nodes": [
    {
      "id": "start",
      "type": "START",
      "referenceName": "start",
      "name": "Start",
      "position": {
        "x": 400,
        "y": 40
      },
      "config": {}
    },
    {
      "id": "check-endpoint",
      "type": "HTTP",
      "referenceName": "check_endpoint_ref",
      "name": "check_endpoint",
      "position": {
        "x": 400,
        "y": 140
      },
      "config": {
        "method": "GET",
        "url": "${workflow.input.endpointUrl}",
        "connectionTimeout": 10000,
        "readTimeout": 10000
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "start",
      "target": "check-endpoint"
    }
  ]
}
```

---

# 119. api_polling_workflow Örnek Akış

```text
Start
 ↓
submit_job
 ↓
poll_job_status
 ├── wait_between_polls
 └── check_status
 ↓
route_on_status
 ├── defaultCase → handle_timeout
 ├── failed      → handle_failure
 └── completed   → handle_success
 ↓
End
```

---

# 120. Do While UI

Do While loop özel container node olarak çizilebilir.

Header:

```text
poll_job_status      DO_WHILE
```

Body:

```text
wait_between_polls
check_status
```

Expression:

```text
$.check_status.output.status != "completed"
```

---

# 121. Loop Güvenliği

Config:

```text
Max Iterations
Max Duration
Loop Condition
Delay
```

Infinite loop warning.

---

# 122. Human Task

Alanlar:

```text
Title
Description
Assignee
Candidate Groups
Form
Due Date
Escalation
Completion Strategy
```

---

# 123. Forms

JSON Schema tabanlı.

User Form dependencies altında listelenmeli.

---

# 124. Integration Builder

Task seçildiğinde:

```text
Integration Name
```

Dropdown.

Missing integration:

```text
Create Integration
```

---

# 125. Secret Binding

Field type:

```text
secret-ref
```

UI:

```text
Select secret
```

Asla secret value input olarak serialize edilmemeli.

---

# 126. Observability

Workflow execution için:

```text
traceId
correlationId
executionId
taskExecutionId
```

UI’da göster.

---

# 127. Metrics

Builder telemetry:

```text
workflow_builder_load_ms
workflow_save_latency_ms
workflow_validation_ms
workflow_execute_latency_ms
node_count
edge_count
```

---

# 128. Product Analytics

Track:

```text
task_added
task_deleted
task_tested
workflow_saved
workflow_executed
workflow_published
assistant_action_applied
validation_error_clicked
```

PII kaydetme.

---

# 129. Backend Separation

Önerilen servisler:

```text
Workflow Definition Service
Workflow Execution Service
Task Catalog Service
Integration Service
Secret Service
Validation Service
Assistant Service
Audit Service
```

---

# 130. Frontend API Client

Feature bazlı:

```text
shared/api/http-client.ts

entities/workflow/api
entities/execution/api
entities/task-definition/api
```

Axios zorunlu değil.

Native fetch wrapper yeterlidir.

---

# 131. API Error Model

```json
{
  "code": "WORKFLOW_VALIDATION_FAILED",
  "message": "Workflow contains validation errors.",
  "traceId": "...",
  "details": []
}
```

---

# 132. Authentication

UI auth bağımsız tutulmalı.

Desteklenebilir:

```text
OIDC
OAuth2
SAML via identity broker
Enterprise SSO
```

Frontend access token storage:

```text
memory preferred
```

Long-lived token localStorage’da tutulmamalı.

---

# 133. Multi-Tenant

Her entity:

```text
tenantId
```

Frontend route tenant-aware olabilir:

```text
/t/:tenantId/workflows/:id
```

---

# 134. Feature Flags

```text
AI Assistant
BPMN Export
Collaboration
Advanced Task Types
MCP
Human Tasks
```

---

# 135. Unsaved Navigation Guard

User sayfadan çıkarken:

```text
You have unsaved changes.
```

Actions:

```text
Stay
Discard
Save & Leave
```

---

# 136. Delete Workflow

Danger confirmation.

Workflow adı yazdırma enterprise mode’da kullanılabilir.

---

# 137. Workflow List Sayfası

Kolonlar:

```text
Name
Version
Status
Updated
Owner
Executions
Actions
```

Actions:

```text
Open
Execute
Duplicate
Download
Archive
Delete
```

---

# 138. Builder Entry

Yeni workflow:

```text
Create blank
Use template
Import BPMN
Import JSON
Generate with AI
```

---

# 139. AI Generate Dialog

Prompt:

```text
“Her 30 saniyede bir API status kontrolü yap.
200 gelirse tamamla, 500 gelirse 3 kez retry et,
sonra Slack alarmı gönder.”
```

AI sonucu preview graph.

---

# 140. Workflow Lint Rules

Configurable:

```text
require-retry-on-http
require-timeout
no-secret-literal
switch-requires-default
max-loop-iterations-required
require-owner
require-description
```

---

# 141. Static Analysis

Save öncesi:

```text
graph lint
expression lint
schema lint
security lint
```

---

# 142. Test Stratejisi

## Unit

- validators
- adapters
- graph transforms
- node factories
- expression parser

## Component

- TaskNode
- SwitchNode
- TaskInspector
- TaskPalette
- VersionDropdown

## Integration

- add task
- connect task
- edit config
- save
- reload

## E2E

Playwright.

---

# 143. Kritik E2E Senaryoları

```text
Create workflow
Add HTTP task
Add Switch
Create branches
Edit task
Test task
Save workflow
Create new version
Execute workflow
Observe completion
Download JSON
Import workflow
```

---

# 144. Visual Regression

Storybook + screenshot test.

Özellikle:

- TaskNode
- SwitchNode
- QuickAdd
- AddTaskDrawer
- Inspector tabs
- TestTaskPopover
- Validation bar

---

# 145. Acceptance Criteria – Layout

- Canvas ve inspector split görünür.
- Inspector resize edilebilir.
- Header fixed.
- Canvas bağımsız scroll/pan.
- Assistant bottom drawer.
- Validation footer görünür.

---

# 146. Acceptance Criteria – Canvas

- Node eklenebilir.
- Node taşınabilir.
- Node bağlanabilir.
- Node silinebilir.
- Multi-select vardır.
- Zoom/pan vardır.
- Fit view vardır.
- Auto layout vardır.
- Undo/redo vardır.

---

# 147. Acceptance Criteria – Task Editing

- Node seçimi inspector açar.
- Config form schema-driven gelir.
- Validation inline gösterilir.
- Reference name unique doğrulanır.
- Expression autocomplete vardır.
- Test Task çalışır.

---

# 148. Acceptance Criteria – Code

- JSON live gösterilir.
- Valid JSON edit edilirse graph güncellenir.
- Invalid JSON graph’ı bozmaz.
- Format, copy, download vardır.

---

# 149. Acceptance Criteria – Execution

- Input form vardır.
- Workflow execute edilir.
- Execution status realtime gelir.
- Canvas node state değişir.
- Error task seçilebilir.
- Retry/terminate desteklenir.

---

# 150. Acceptance Criteria – Dependencies

- Integrations gösterilir.
- Secrets gösterilir.
- Env vars gösterilir.
- Forms gösterilir.
- Schemas gösterilir.
- Eksik dependency validation üretir.

---

# 151. Acceptance Criteria – Assistant

- Natural language workflow önerir.
- Değişiklik preview verir.
- User Apply olmadan graph mutate etmez.
- Validation sonrası sonucu gösterir.
- Conversation history tutar.

---

# 152. Tasarımda Yapılmaması Gerekenler

YASAK:

- Canvas motorunu sıfırdan yazmak
- task type’ları tek component içine gömmek
- büyük monolithic `WorkflowBuilder.tsx`
- inline CSS karmaşası
- secret value client’ta saklamak
- browser `eval`
- server state’i Zustand içine kopyalamak
- node başına bağımsız API request
- validation’ı sadece backend’e bırakmak
- published workflow’u direkt overwrite etmek
- sadece toast ile hata göstermek
- raw Conductor JSON’u UI domain modeli yapmak

---

# 153. Component Tree

```text
WorkflowBuilderPage
├─ WorkflowHeader
│  ├─ Breadcrumb
│  ├─ WorkflowTitle
│  ├─ VersionSelector
│  └─ WorkflowActions
│
├─ BuilderSplitPane
│  ├─ WorkflowCanvas
│  │  ├─ CanvasToolbar
│  │  ├─ ReactFlow
│  │  │  ├─ StartNode
│  │  │  ├─ EndNode
│  │  │  ├─ TaskNode
│  │  │  ├─ SwitchNode
│  │  │  ├─ LoopNode
│  │  │  └─ CustomEdge
│  │  ├─ QuickAddMenu
│  │  └─ CanvasSearch
│  │
│  └─ WorkflowInspector
│     ├─ InspectorTabs
│     ├─ WorkflowTab
│     ├─ TaskTab
│     ├─ CodeTab
│     ├─ RunTab
│     └─ DependenciesTab
│
├─ AssistantDrawer
└─ ValidationStatusBar
```

---

# 154. Önerilen Feature Dosya Yapısı

```text
features/workflow-canvas/
├─ components/
│  ├─ WorkflowCanvas.tsx
│  ├─ CanvasToolbar.tsx
│  ├─ CanvasSearch.tsx
│  ├─ QuickAddMenu.tsx
│  ├─ nodes/
│  │  ├─ TaskNode.tsx
│  │  ├─ SwitchNode.tsx
│  │  ├─ StartNode.tsx
│  │  └─ EndNode.tsx
│  └─ edges/
│     └─ WorkflowEdge.tsx
│
├─ hooks/
│  ├─ useCanvasKeyboard.ts
│  ├─ useGraphSelection.ts
│  └─ useAutoLayout.ts
│
├─ model/
│  ├─ canvas.store.ts
│  └─ graph.commands.ts
│
└─ utils/
   ├─ layout.ts
   └─ node-factory.ts
```

---

# 155. Task Editor Dosya Yapısı

```text
features/task-editor/
├─ TaskInspector.tsx
├─ DynamicTaskForm.tsx
├─ TaskHeader.tsx
├─ TestTaskButton.tsx
├─ TestTaskPanel.tsx
├─ ExpressionField.tsx
├─ JsonField.tsx
├─ RetrySettings.tsx
└─ TimeoutSettings.tsx
```

---

# 156. Dynamic Form Engine

Task config forms JSON Schema’dan üretilecek.

Tercih:

```text
react-jsonschema-form
```

veya özel wrapper.

Ama tasarım sistemiyle entegre edilmelidir.

---

# 157. Task Plugin Modeli

Yeni task eklemek UI deploy gerektirmemeli.

Task schema backend’den gelsin.

Frontend renderer registry:

```ts
const specializedEditors = {
  SWITCH: SwitchTaskEditor,
  DO_WHILE: LoopTaskEditor,
  HUMAN: HumanTaskEditor,
  HTTP: HttpTaskEditor
};
```

Diğerleri generic schema form.

---

# 158. HTTP Task Editor

Alanlar:

```text
Method
URL
Headers
Query Params
Body
Connection Timeout
Read Timeout
Authentication
Retry
Expected Status
```

---

# 159. HTTP Method UI

Dropdown:

```text
GET
POST
PUT
PATCH
DELETE
HEAD
```

---

# 160. HTTP Test

`Test Task`

Input substitute edildikten sonra request preview göster.

Secret value maskeli.

---

# 161. Worker Task

Alanlar:

```text
Task Definition
Domain
Input
Callback After
Rate Limit
Retry
Timeout
```

---

# 162. Event Task

Destek:

```text
Kafka
RabbitMQ
AMQP
SQS
NATS
Custom
```

Alanlar provider’a göre schema-driven.

---

# 163. AI Task

Alanlar:

```text
Provider
Model
System Prompt
User Prompt
Temperature
Max Tokens
Response Schema
Tools
Timeout
Retry
```

---

# 164. MCP Task

Alanlar:

```text
MCP Server
Tool
Arguments
Timeout
Approval Required
```

---

# 165. Human Task Execution UX

Execution sırasında:

```text
Waiting for human input
```

Form aç.

Submit.

Audit log.

---

# 166. Error Panel

Task failure:

```text
Task Failed

Error Code
Message
Stack Trace
Input
Output
Attempt
Worker
Started At
Ended At

Retry Task
Retry Workflow
Terminate
```

---

# 167. Dev Mode

Optional toggle:

```text
Design
Debug
```

Debug mode:

- execution overlays
- input/output
- timing
- logs

---

# 168. Dependency Graph

Dependencies tab ileri aşamada graph view gösterebilir.

Örnek:

```text
Workflow
 ├─ Secret OPENAI_API_KEY
 ├─ Integration Slack
 └─ Sub Workflow notify_ops
```

---

# 169. Search Command Palette

Global:

```text
Ctrl + K
```

Actions:

```text
Add HTTP Task
Add Switch
Run Workflow
Save
Publish
Search Node
Open Dependencies
Open Code
```

---

# 170. Theme

Light ilk sürüm.

Dark ikinci sürüm.

Design tokens ilk günden dark-compatible olmalı.

---

# 171. Internationalization

UI text hard-code edilmemeli.

Diller:

```text
tr
en
```

Başlangıçta İngilizce olabilir.

---

# 172. Suggested Sprint Plan

## Sprint 1
- App shell
- Header
- split pane
- basic canvas
- node rendering
- zoom/pan

## Sprint 2
- add task
- task palette
- inspector
- HTTP task
- generic task form

## Sprint 3
- switch
- branch
- loop
- auto layout
- undo/redo

## Sprint 4
- code tab
- JSON sync
- validation
- save/version

## Sprint 5
- execution
- realtime events
- run tab
- execution overlay

## Sprint 6
- dependencies
- test task
- import/export
- error UX

## Sprint 7
- AI assistant
- review/apply actions
- workflow generation

## Sprint 8
- BPMN adapter
- XML import/export
- hardening
- E2E
- performance

---

# 173. Definition of Done

Bir özellik “done” sayılmadan:

```text
TypeScript strict passes
ESLint passes
Unit tests pass
E2E passes
Accessibility checked
Responsive checked
Error state handled
Loading state handled
Empty state handled
No console error
No direct secret exposure
Telemetry added
Docs updated
```

---

# 174. AI Coding Agent Talimatı

Aşağıdaki kuralları ihlal etme:

1. Önce domain model oluştur.
2. UI’ı backend JSON formatına doğrudan bağlama.
3. Canvas için `@xyflow/react` kullan.
4. State için Zustand, server state için TanStack Query kullan.
5. Form validation için Zod kullan.
6. Kod editörü Monaco olsun.
7. Task palette server-driven olsun.
8. Task config schema-driven olsun.
9. Switch / Loop / Human Task özel editor kullanabilir.
10. Her mutation undoable command olarak tasarlansın.
11. Save öncesi validation çalışsın.
12. Published version immutable olsun.
13. Secret değerleri client state’e düşmesin.
14. Test Task browser `eval` kullanmasın.
15. E2E test yazılmadan feature tamamlanmış sayılmasın.

---

# 175. AI İçin İlk Uygulama Görevi

İlk iterasyonda yalnızca aşağıdakileri yap:

```text
1. WorkflowBuilderPage
2. Header
3. React Flow canvas
4. StartNode
5. EndNode
6. GenericTaskNode
7. QuickAddMenu
8. AddTaskDrawer
9. Right Inspector shell
10. Workflow / Task / Code / Run / Dependencies tabs
11. Zustand draft store
12. Mock task catalog
13. Add / move / delete / connect
14. Save mock
15. Undo / redo
```

Backend entegrasyonu yapmadan önce UX skeleton tamamlanmalı.

---

# 176. AI İçin İkinci Uygulama Görevi

```text
1. HTTP Task editor
2. Switch editor
3. Branch rendering
4. Dynamic task form
5. Expression field
6. Validation engine
7. Monaco Code tab
8. Canvas ↔ JSON sync
```

---

# 177. AI İçin Üçüncü Uygulama Görevi

```text
1. Execute dialog
2. Run tab
3. Execution timeline
4. WebSocket events
5. Node execution states
6. Test Task
7. Error panel
```

---

# 178. AI İçin Dördüncü Uygulama Görevi

```text
1. Dependencies
2. Versioning
3. Diff
4. Import/export
5. BPMN adapter
6. Conductor adapter
7. AI Assistant
```

---

# 179. Görsel Kalite Hedefi

Arayüz:

- yoğun ama temiz
- enterprise
- düşük görsel gürültü
- task odaklı
- ince border
- minimal shadow
- net seçili state
- güçlü canvas alanı
- panel tabanlı configuration

olmalıdır.

Şunlardan kaçın:

- aşırı gradient
- neon renk
- büyük kartlar
- dashboard estetiği
- gereksiz hero alan
- fazla padding
- mobile-app tarzı yuvarlak button

---

# 180. Son Mimari Karar

Bu ürün için önerilen ana yapı:

```text
Internal Workflow Domain Model
        │
        ├── React Workflow Builder
        │
        ├── Validation Engine
        │
        ├── Execution Debugger
        │
        └── AI Assistant
        │
        ├── Conductor Adapter
        └── BPMN 2.0 Adapter
```

Bu yaklaşım sayesinde ürün:

- Orkes/Conductor benzeri modern UX sunar,
- belirli bir workflow engine’e kilitlenmez,
- BPMN desteği ekleyebilir,
- AI orchestration task’larını destekleyebilir,
- ileride başka engine adapter’ları ekleyebilir.

Örneğin:

```text
Flowable Adapter
Camunda Adapter
Temporal Adapter
Argo Adapter
Custom Engine Adapter
```

---

# 181. Nihai Hedef Ekran

Kullanıcı ekrana girdiğinde:

- Sol tarafta workflow graph
- Sağ tarafta contextual editor
- Üstte workflow lifecycle actions
- Node üstünde hızlı task ekleme
- Sağ drawer’da tüm task katalogu
- Task tabında form
- Code tabında JSON/XML
- Run tabında execution
- Dependencies tabında bağımlılıklar
- Altta AI Assistant
- Footer’da validation status

görmelidir.

Bu, yalnızca BPMN çizim ekranı değil; tam bir:

```text
Workflow Design Studio
+
Execution Console
+
Integration Configuration
+
AI Assisted Orchestration IDE
```

olmalıdır.

---

# 182. Proje Adı Önerileri

İç kullanım için:

```text
Workflow Studio
Process Studio
Orchestration Studio
Flow Designer
Process Builder
Automation Studio
```

Ürünün mevcut yapısına en uygun genel isim:

```text
Workflow Studio
```

BPMN menü adı:

```text
Process Designer
```

---

# 183. Son Kabul Kriteri

Kullanıcı aşağıdaki senaryoyu 3 dakikadan kısa sürede tamamlayabilmelidir:

```text
New Workflow
→ HTTP Task ekle
→ Wait ekle
→ HTTP Poll ekle
→ Switch ekle
→ Success / Failure branch oluştur
→ Failure notification task ekle
→ Save
→ Test Task
→ Execute
→ Running state’i canvas üzerinde gör
→ Output incele
```

Bu senaryo akıcı çalışıyorsa builder UX başarılı kabul edilir.

---

# 184. AI Agent'a Verilecek Kısa Master Prompt

```text
You are implementing a production-grade Workflow Studio inspired by modern
workflow orchestration tools such as Orkes Conductor.

Do not build a visual mock.

Build a real modular React + TypeScript workflow editor using @xyflow/react.

The application must support:
- workflow graph editing
- draggable nodes
- connectable edges
- switch branches
- loop containers
- task palette
- quick add
- right-side inspector
- workflow/task/code/run/dependencies tabs
- schema-driven task forms
- Monaco JSON editor
- undo/redo
- graph validation
- workflow versioning
- task testing
- execution monitoring
- realtime task state
- dependency management
- AI-assisted workflow editing

Keep the UI domain model independent from Conductor/BPMN engine formats.
Use adapters for import/export.

Use:
React
TypeScript strict
Vite
@xyflow/react
Zustand
TanStack Query
React Hook Form
Zod
Monaco Editor
Radix UI
dnd-kit
Vitest
Playwright

Never:
- use eval
- expose secrets
- put all logic into one component
- couple React nodes directly to backend DTOs
- mutate published versions
- skip validation
- implement the graph engine from scratch

Follow the architecture and acceptance criteria from this specification.
```

---

## SONUÇ

Bu doküman, Orkes/Conductor ekran görüntülerindeki UX yaklaşımını referans alıp birebir görsel kopya yapmak yerine, aynı ürün sınıfında daha sürdürülebilir bir **enterprise workflow/BPMN design studio** oluşturmak için hazırlanmıştır.

En önemli üç karar:

1. **React Flow tabanlı canvas**
2. **Internal canonical workflow domain model**
3. **Conductor + BPMN adapter katmanı**

Bu üç karar korunursa ürün ileride farklı workflow engine’lerini destekleyebilir ve UI katmanı yeniden yazılmak zorunda kalmaz.


---

# 185. Orkes Developer Guide ile Doğrulanan Çekirdek Davranışlar

Bu bölüm, güncel Orkes Workflow Developer Guide incelenerek önceki tasarımın ürün davranışları açısından sağlamlaştırılmış halidir.

Kaynak ailesi:

```text
https://orkes.io/content/devguide/workflows
https://orkes.io/content/quickstart/workflows
```

Bu bölümdeki davranışlar, UI'ın sadece Orkes'e benzemesini değil, Conductor workflow semantiğine de yakın olmasını amaçlar.

---

# 186. Conductor'ın Temel Workflow Özellikleri

Conductor workflow'larının temel karakteri:

```text
Durable execution
JSON-native definitions
Dynamic workflows
Versioned definitions
Language-agnostic workers
```

Ürün mimarisi bu beş özelliği first-class concept olarak ele almalıdır.

Bunun UI karşılığı:

```text
Definition Editor
Execution Inspector
Version Selector
Code View
Worker Dependency View
```

`Definition` ile `Execution` kesinlikle aynı entity değildir.

---

# 187. Definition vs Execution Ayrımı

## Workflow Definition

Blueprint'tir.

İçerir:

```text
name
description
version
schemaVersion
tasks
inputParameters
outputParameters
timeoutPolicy
timeoutSeconds
restartable
ownerEmail
failureWorkflow
schemas
```

## Workflow Execution

Definition'ın belirli input ile başlatılmış runtime instance'ıdır.

Her execution:

```text
workflowId
workflowName
workflowVersion
status
input
output
variables
tasks[]
startTime
endTime
correlationId
reasonForIncompletion
```

UI store'larında definition ve execution modelleri birbirine karıştırılmamalıdır.

---

# 188. Workflow Definition — Orkes Compatible Model

Canonical model Conductor adapter'ı aşağıdaki alanları desteklemelidir:

```ts
export type ConductorCompatibleWorkflowDefinition = {
  name: string;
  description?: string;

  version: number;
  schemaVersion: 2;

  tasks: unknown[];

  inputParameters?: string[];
  outputParameters?: Record<string, unknown>;

  timeoutPolicy?: "TIME_OUT_WF" | "ALERT_ONLY";
  timeoutSeconds?: number;

  restartable?: boolean;
  ownerEmail?: string;

  failureWorkflow?: string;

  enforceSchema?: boolean;

  inputSchema?: SchemaDef;
  outputSchema?: SchemaDef;
};
```

`schemaVersion` ile `inputSchema/outputSchema.version` karıştırılmamalıdır.

---

# 189. schemaVersion ve enforceSchema Ayrımı

Çok kritik:

```text
schemaVersion = workflow definition format version
```

Conductor tarafında güncel workflow definition formatı:

```text
schemaVersion: 2
```

Bu değer validation schema versiyonu değildir.

Validation kontrolü:

```text
enforceSchema
```

UI'da iki ayrı bölüm olmalı:

```text
Advanced Definition
  Schema Version: 2

Input / Output Contracts
  Enforce Schema: ON/OFF
```

---

# 190. Schema Definition Modeli

Orkes guide'a göre schema attachment hem workflow hem task definition seviyesinde olabilir.

```ts
export type SchemaDef = {
  name: string;
  version?: number;

  type:
    | "JSON"
    | "AVRO"
    | "PROTOBUF";

  data?: unknown;
  externalRef?: string;
};
```

UI:

```text
Schema Source

○ Inline
○ Registered Schema
○ External Reference
```

---

# 191. Schema Enforcement Davranışı

Workflow definition:

```text
inputSchema
outputSchema
enforceSchema
```

Task definition:

```text
inputSchema
outputSchema
enforceSchema
```

UX:

```text
Validate before save
Validate before execute
```

Schema violation mümkünse side-effect başlamadan önce gösterilmelidir.

---

# 192. Task Definition ile Task Configuration Ayrımı

Bu ayrım ürünün domain modelinde zorunludur.

## Task Definition

Worker/SIMPLE task'ın registry kaydıdır.

Örnek:

```text
charge_payment
send_notification
generate_statement
```

Retry, timeout, concurrency gibi worker policy burada tutulabilir.

## Task Configuration

Workflow içinde o task'ın belirli kullanım biçimidir.

Örnek:

```json
{
  "name": "charge_payment",
  "taskReferenceName": "charge_payment_ref",
  "type": "SIMPLE",
  "inputParameters": {}
}
```

UI'da kullanıcıya bu fark açık gösterilmelidir.

---

# 193. Worker Task Dependency Validation

Bir `SIMPLE` task kullanıldığında:

```text
Task Definition mevcut mu?
Worker polling yapıyor mu?
Domain doğru mu?
```

Save-time validation yalnızca task definition varlığını doğrulayabilir.

Worker'ın gerçekten poll ettiğini doğrulamak için runtime/operational health gerekir.

Dependencies tab'a ekle:

```text
Worker Dependencies

charge_payment
Task Definition: Found
Worker Activity: Active / Unknown / Offline
Queue Depth: 14
Last Poll: 8 sec ago
```

---

# 194. Task Definition Alanları

Minimum destek:

```text
name
description
retryCount
retryLogic
retryDelaySeconds
maxRetryDelaySeconds
backoffJitterMs
totalTimeoutSeconds
timeoutPolicy
timeoutSeconds
responseTimeoutSeconds
pollTimeoutSeconds
inputKeys
outputKeys
concurrentExecLimit
rateLimitPerFrequency
rateLimitFrequencyInSeconds
ownerEmail
```

---

# 195. Retry Strategy — Orkes Uyumlu

Enum:

```text
FIXED
EXPONENTIAL_BACKOFF
LINEAR_BACKOFF
```

UI:

```text
Retry Count
Retry Logic
Retry Delay
Maximum Retry Delay
Backoff Jitter
Total Retry Budget
```

Özellikle `backoffJitterMs` desteklenmelidir.

Bu thundering-herd riskini azaltmak için production ortamında önemlidir.

---

# 196. Timeout Semantiklerini Ayır

Task timeout kavramlarını tek bir "Timeout" input'una indirme.

UI ayrı göstermeli:

```text
Execution Timeout
Response Timeout / Heartbeat
Poll Timeout
Total Retry Budget
Timeout Policy
```

Anlam:

```text
timeoutSeconds
  task IN_PROGRESS olduktan sonra maksimum süre

responseTimeoutSeconds
  worker update/heartbeat için maksimum bekleme

pollTimeoutSeconds
  worker task'ı hiç poll etmezse maksimum bekleme

totalTimeoutSeconds
  tüm retry sequence için toplam wall-clock budget
```

---

# 197. Task Status — Exact Runtime Model

```ts
export type TaskExecutionStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "SKIPPED"
  | "TIMED_OUT"
  | "CANCELED"
  | "FAILED"
  | "FAILED_WITH_TERMINAL_ERROR"
  | "COMPLETED_WITH_ERRORS"
  | "COMPLETED";
```

Canvas execution overlay bunu desteklemelidir.

---

# 198. Workflow Status — Exact Runtime Model

```ts
export type WorkflowExecutionStatus =
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "TIMED_OUT"
  | "TERMINATED"
  | "FAILED";
```

Workflow seviyesinde `CANCELLED` kullanma.

---

# 199. Optional Task Semantiği

Task configuration:

```json
{
  "optional": true
}
```

Task tüm retry'leri tüketse bile workflow devam edebilir.

Execution UI:

```text
COMPLETED_WITH_ERRORS
```

şeklini gösterebilmelidir.

Node görünümü:

```text
amber warning
✓ workflow continued
```

---

# 200. Terminal Error Semantiği

Worker deterministic hata tespit ettiğinde:

```text
FAILED_WITH_TERMINAL_ERROR
```

kullanabilir.

Bu durumda retry yapılmamalıdır.

UI error detail:

```text
Terminal Failure
Retries skipped because the task reported a terminal error.
```

---

# 201. failureWorkflow Desteği

Workflow detail altında:

```text
Failure Workflow
```

alanı bulunmalıdır.

Bir workflow başarısız olduğunda compensation/error workflow tetiklenebilmesi canonical modelde temsil edilmelidir.

Dependency panel:

```text
Sub Workflows
Failure Workflows
```

olarak genişletilmelidir.

---

# 202. Dynamic Input Reference Engine

Conductor input wiring syntax:

```text
${type.jsonpath}
```

Expression field aşağıdaki kaynakları autocomplete etmelidir:

```text
${workflow.input}
${workflow.input.orderId}

${workflow.output}
${workflow.output.result}

${workflow.variables}
${workflow.variables.retryCount}

${task_ref.input}
${task_ref.input.someKey}

${task_ref.output}
${task_ref.output.someKey}

${workflow.status}
${workflow.workflowId}
${workflow.parentWorkflowId}
${workflow.parentWorkflowTaskId}
${workflow.workflowType}
${workflow.version}
${workflow.createTime}
${workflow.correlationId}
```

---

# 203. Secrets Expression

Secret reference:

```text
${workflow.secrets.secret_name}
```

JSON secret:

```text
${workflow.secrets.secret_name.field_name}
```

UI secret browser:

```text
Secrets
  payment-api-token
  db-credentials
```

Value asla workflow JSON içine literal olarak yazılmamalıdır.

---

# 204. Environment Variable Expression

Environment reference:

```text
${workflow.env.variable-name}
```

Environment value tipleri:

```text
Plain Text
JSON
```

Expression autocomplete:

```text
workflow.env
```

namespace'ini de bilmelidir.

---

# 205. Input Binding UX

Expression field için popup:

```text
Insert value from...

Workflow Input
Workflow Variables
Previous Task Output
Secrets
Environment Variables
Execution Metadata
```

Kullanıcı JSONPath'i elle ezberlemek zorunda kalmamalıdır.

---

# 206. Built-In System Task Kataloğu

Orkes/Conductor semantiğine yakın minimum system task grubu:

```text
Event
HTTP
HTTP Poll
Human
Inline
No Op
JSON JQ Transform
Kafka Publish
Wait
JDBC / SQL
Wait For Webhook
Update Secret
Get Signed JWT
Update Task
gRPC
Query Processor
```

Enterprise/Orkes özellikleri ayrıca plugin/provider üzerinden genişletilebilir.

---

# 207. Control Flow Operators

Palette'te ayrı kategori:

```text
OPERATORS
```

İçerik:

```text
Switch
Do While
Fork
Dynamic Fork
Join
Exclusive Join
Dynamic
Set Variable
Wait
Human
Sub Workflow
Start Workflow
Terminate
Yield
Get Workflow
```

---

# 208. Task Kategorilerinin UI Ayrımı

Add Task ekranında şu sınıflama kullanılmalı:

```text
System Tasks
Operators
Worker Tasks
Integrations
AI
Human
Connected Apps
```

Bu yapı kullanıcının "task mı yoksa control-flow operator mı?" ayrımını anlamasını kolaylaştırır.

---

# 209. Start Workflow vs Sub Workflow

UI tooltipleri doğru semantik göstermeli.

## Start Workflow

```text
Fire-and-forget / asynchronous child workflow.
Parent waits for neither completion nor output by default.
```

## Sub Workflow

```text
Synchronous child workflow.
Parent waits until child reaches a terminal state.
Child output can be consumed by the parent.
```

Aynı ikon kullanılmamalıdır.

---

# 210. Wait vs Human

## Wait

Zaman veya external signal için blocking state.

## Human

İnsan işi / form / assignment lifecycle.

Bunlar aynı task tipi gibi sunulmamalıdır.

---

# 211. Event vs Kafka Publish

## Kafka Publish

Özelleşmiş doğrudan Kafka publish.

## Event

Daha genel eventing abstraction:

```text
Kafka
AMQP
SQS
NATS
...
```

Task palette açıklaması buna göre yazılmalıdır.

---

# 212. Workflow Oluşturma — UI Davranışı

Orkes guide'a göre temel UI flow:

```text
Definitions
→ Workflow
→ Define workflow
→ Start-to-End empty graph
→ Workflow Details
→ +
→ configure Task panel
→ Save
```

Ayrıca:

```text
Code tab
```

üzerinden tam JSON workflow definition yapıştırılabilmelidir.

Bizim tasarımımız bu davranışla uyumludur.

---

# 213. Code-First Source of Truth

Kurumsal kullanım için önemli:

```text
UI editor = authoring tool
Git repository = deployment source of truth
```

Ürün ileride:

```text
Export JSON
Commit
PR
CI validate
Deploy
```

akışını desteklemelidir.

UI'da optional:

```text
Source Control
Last synced commit
Definition drift
```

bölümü eklenebilir.

---

# 214. Üç Katmanlı Test Modeli

Workflow test deneyimi üç seviyeli olmalıdır.

## Level 1 — Definition Validation

```text
metadata + graph + schema validation
```

Backend eşleniği:

```text
POST /api/metadata/workflow/validate
```

UI action:

```text
Validate
```

## Level 2 — Mock Orchestration Test

Gerçek worker olmadan routing/control-flow test edilir.

Backend eşleniği:

```text
POST /api/workflow/test
```

UI action:

```text
Test Workflow
```

## Level 3 — Real Execution

Gerçek worker ve entegrasyonlarla canary execution.

UI action:

```text
Execute
```

---

# 215. Mock Workflow Test Paneli

Yeni tab önerisi:

```text
Test
```

veya Run içinde:

```text
Mock Test
Real Run
```

Mock yapı:

```text
Task Ref
Attempt #
Mock Status
Mock Output
Execution Time
Queue Wait Time
```

Loops/retries nedeniyle aynı task ref için birden fazla mock output girilebilmelidir.

---

# 216. Test Fixtures

Workflow test fixture kaydedilebilmeli:

```text
happy-path.json
payment-failure.json
timeout.json
retry-success.json
human-rejection.json
```

UI:

```text
Test Cases
```

Bu, regression test özelliğinin temelidir.

---

# 217. Version Snapshot Semantiği

Çok önemli runtime kuralı:

Bir execution başladığında kullandığı workflow definition snapshot'ı execution'a bağlanır.

Sonradan workflow değişse bile mevcut execution otomatik olarak yeni definition'a geçmez.

UI execution detail:

```text
Definition Used
Workflow: order_flow
Version: 3
Definition Snapshot: View
Current Latest Version: 5
```

---

# 218. Safe Version Rollout

Version UI:

```text
Create New Version
Validate
Mock Test
Canary Execute
Compare Metrics
Promote
```

Metrics:

```text
Completion Rate
Failure Rate
P95 Duration
Timeout Rate
Output Differences
```

---

# 219. Execution Inspector — Orkes Uyumlu Tabs

Execution detail ekranı minimum:

```text
Tasks
  Diagram
  Task List
  Timeline

Summary
Workflow Input/Output
JSON
```

Builder içindeki `Run` tab bunların compact halini sunabilir.

---

# 220. Task Execution Detail

Node'a tıklanınca:

```text
Summary
Input
Output
Logs
JSON
Definition
```

Summary:

```text
Task Execution ID
Status
Duration
Worker ID
Retry Count
Reason for Incompletion
Start Time
End Time
```

---

# 221. Executed Path Visualization

Execution diagram:

```text
executed successful path → green
failed path → red
alternative non-executed paths → grey
running path → blue
waiting → amber
```

Bu behavior screenshotlardaki Orkes yaklaşımıyla uyumludur.

---

# 222. reasonForIncompletion

Debugging ekranında first-class alan olmalıdır.

Workflow failure header:

```text
Reason for Incompletion
```

Task detail:

```text
Reason for Incompletion
```

Source:

```text
worker
system task
engine timeout
event handler
termination
```

---

# 223. Retry Attempt Selector

Failed/retried task için:

```text
Attempt 1
Attempt 2
Attempt 3
Attempt 4
```

Her attempt:

```text
Input
Output
Logs
Worker
Duration
reasonForIncompletion
```

ile görülebilmelidir.

---

# 224. Recovery Actions

Failed execution:

```text
Retry from failed task
Restart
Restart using latest definition
Terminate
```

Action öncesi hangi definition snapshot'ının kullanılacağı açıkça gösterilmelidir.

---

# 225. BPMN Import — Orkes Davranışı

Import dialog:

```text
Import BPMN

[Select File]
[Drag & Drop]

or

[Paste XML]
```

Accepted:

```text
.bpmn
XML
```

Workflow name default:

```text
filename
```

Option:

```text
Overwrite workflow
```

---

# 226. BPMN Import Validation

Import fail:

```text
Circular reference
Multiple start events
Malformed/incomplete BPMN
```

Her BPMN process ayrı workflow definition'a dönüşebilir.

Import sonrası zorunlu ekran:

```text
Conversion Review
```

---

# 227. BPMN Conversion Review

İçe aktarılan workflow doğrudan production'a kaydedilmemeli.

Review:

```text
Generated Workflow JSON
Task Reference Names
Retries
Timeouts
Schemas
Dependencies
Warnings
```

CTA:

```text
Validate
Save as Draft
```

---

# 228. Idempotency — Workflow Start

Execute dialog'a production mode'da ekle:

```text
Idempotency Key
Idempotency Strategy
```

Strategies:

```text
FAIL
RETURN_EXISTING
FAIL_ON_RUNNING
```

---

# 229. Idempotency Strategy UX

## FAIL

```text
Duplicate key exists → reject
```

Use:

```text
payments / exactly-once logical operation
```

## RETURN_EXISTING

```text
Duplicate key exists → return existing workflowId
```

Use:

```text
retrying APIs
at-least-once event delivery
```

## FAIL_ON_RUNNING

```text
Reject only while matching workflow is RUNNING/PAUSED.
Terminal workflow allows another execution.
```

Use:

```text
prevent overlapping jobs
```

---

# 230. Idempotency Validation

Execute panel warning:

```text
This workflow performs external side effects but no idempotency key is configured.
```

Bu warning özellikle:

```text
Payment
Create Order
Send Command
Provision Resource
```

gibi task'larda policy olarak etkinleştirilebilir.

---

# 231. Trigger Modeli

Workflow execution'ın nasıl başladığı ayrı bir ürün kavramı olmalıdır.

Trigger types:

```text
Direct Start
Schedule
Event Handler
Parent Workflow
Webhook/Event
```

Existing execution resume:

```text
Signal
Task Update
Human Task Completion
```

Create-new ile resume-existing UI'da karıştırılmamalıdır.

---

# 232. Trigger Tab Önerisi

Right inspector'a opsiyonel yeni tab:

```text
Workflow
Task
Code
Run
Triggers
Dependencies
```

Alternatif olarak Workflow tab altında `Triggers` section.

---

# 233. Schedule Editor

Alanlar:

```text
Schedule Name
Cron Expression
Timezone
Workflow Version
Input
Catch-up
Start Time
End Time
Paused
```

Cron:

```text
Spring 6-field cron
```

Timezone:

```text
IANA timezone
```

---

# 234. Schedule Preview

Editor:

```text
Next runs

2026-09-12 15:00 Europe/Istanbul
2026-09-12 16:00 Europe/Istanbul
...
```

DST warning desteklenmelidir.

---

# 235. Schedule Catch-up Warning

`runCatchupScheduleInstances = true` seçildiğinde:

```text
Warning:
Missed slots may create a burst of workflow executions after downtime.
Ensure the workflow is idempotent and dependencies can absorb the load.
```

---

# 236. Schedule Overlap Warning

Orkes scheduler native overlap policy sağlamaz.

Bu nedenle bizim ürün:

```text
Potential overlap detected
```

uyarısı vermeli.

İstersek product-level guard ekleyebiliriz:

```text
Prevent concurrent execution
```

Bunu Conductor native özellik gibi göstermemeli; wrapper capability olmalıdır.

---

# 237. Scheduler Injected Inputs

Autocomplete scheduler-triggered workflow'larda şunları bilmeli:

```text
${workflow.input._startedByScheduler}
${workflow.input._scheduledTime}
${workflow.input._executedTime}
${workflow.input._executionId}
${workflow.input._schedulerCron}
```

---

# 238. Signal Semantiği

Signal:

```text
new workflow başlatmaz
existing running workflow'u ilerletir
```

Conductor signal davranışı:

```text
first non-terminal WAIT task
```

üzerinden ilerleyebilir.

Signal `HUMAN` task çözmek için kullanılmamalıdır.

---

# 239. Wait Task Inspector

WAIT task editor:

```text
Wait Mode

○ Duration
○ Until Timestamp
○ External Signal
```

External signal seçilirse:

```text
Expose Workflow ID
Expected Payload Schema
Timeout
Failure Behavior
```

---

# 240. Exact Task Targeting

Arbitrary task update gerektiğinde signal endpoint semantiği yerine task update kullanılmalıdır.

UI admin/debug action:

```text
Update Task Status
```

Permission-gated olmalıdır.

---

# 241. Execution Start Modes

Run panel:

```text
Start Async
Execute & Wait
```

`Execute & Wait` için:

```text
Wait Timeout
Return Strategy
```

Return strategy:

```text
TARGET_WORKFLOW
BLOCKING_WORKFLOW
BLOCKING_TASK
BLOCKING_TASK_INPUT
```

İleri seviye ayar olarak saklanabilir.

---

# 242. Debugging Workflow

Failed task bulunduğunda UI şu sırayı teşvik etmeli:

```text
1. reasonForIncompletion
2. Input
3. Output
4. Worker ID
5. Retry attempts
6. Task logs
7. Definition
```

Bu bilgiler tek panel içinde olmalıdır.

---

# 243. Validation Severity Model

```ts
type ValidationSeverity =
  | "ERROR"
  | "WARNING"
  | "INFO";
```

Validation source:

```text
CLIENT_GRAPH
CLIENT_SCHEMA
SERVER_DEFINITION
DEPENDENCY
SECURITY_POLICY
LINT_POLICY
```

---

# 244. Orkes-Compatible Save Pipeline

```text
Graph mutation
↓
Canonical model
↓
Client graph validation
↓
Schema validation
↓
Conductor adapter
↓
Server definition validation
↓
Warnings shown
↓
Save/register
```

---

# 245. Production Publish Pipeline

```text
Draft
↓
Validate
↓
Mock Workflow Tests
↓
Dependency Check
↓
Canary Execution
↓
Review
↓
Publish/Promote
```

Bu akış mevcut dokümandaki `Save` aksiyonundan daha güçlü enterprise davranıştır.

---

# 246. Workflow Studio Ana Navigation

Tam ürün menüsü önerisi:

```text
Definitions
  Workflows
  Task Definitions
  Schemas
  Secrets
  Environment Variables
  Integrations
  User Forms
  Prompts

Executions

Schedules

Human Tasks

Audit

Settings
```

Bu yapı Orkes ekosistemindeki dependency ayrımına çok daha yakındır.

---

# 247. Task Palette Nihai Gruplaması

```text
QUICK ADD

Worker Task
HTTP
HTTP Poll
gRPC
Event
Switch
Fork
Join
Do While
Wait
Sub Workflow
Start Workflow

SYSTEM
Inline
JSON JQ Transform
Kafka Publish
JDBC
Wait For Webhook
Get Signed JWT
Update Task
Set Variable
Terminate
No Op

HUMAN
Human Task

AI
LLM Text Complete
LLM Chat Complete
Generate Embeddings
Store/Search Embeddings
Index Document
Search Index
Chunk Text
Parse Document
Generate Image
Generate Audio
Generate Video
Generate PDF
List MCP Tools
Call MCP Tool

CONNECTED APPS
Provider-driven actions
```

Catalog yine server-driven olmalıdır.

---

# 248. UI'da Orkes ile Aynı Olması Gerekmeyen Noktalar

Hedef davranış uyumluluğudur, piksel kopyası değildir.

Kendi ürünümüzde iyileştirebiliriz:

```text
better auto-layout
better keyboard navigation
stronger version diff
test fixtures
GitOps integration
policy linting
dependency health
better expression autocomplete
BPMN conversion review
safe AI change preview
```

---

# 249. Orkes'ten Bilinçli Olarak Daha Katı Olacağımız Noktalar

```text
Published version overwrite default kapalı
Secrets literal kullanımına hard-block
High-risk workflow için idempotency warning
Schedule catch-up için burst warning
Retry jitter recommendation
BPMN import sonrası mandatory validation
AI mutation için review/apply
Definition validation before every save
```

---

# 250. Nihai Mimari — Guide Sonrası

```text
                         Workflow Studio
                               │
            ┌──────────────────┼───────────────────┐
            │                  │                   │
       Definition IDE     Execution Console    Operations
            │                  │                   │
   ┌────────┼─────────┐   ┌────┼─────┐       ┌────┼─────┐
   │        │         │   │    │     │       │    │     │
 Canvas    Code     Tests Diagram Timeline Debug  Schedule Trigger
   │        │         │
   └────────┴────┬────┘
                 │
        Canonical Workflow Model
                 │
      ┌──────────┼───────────┐
      │          │           │
 Conductor    BPMN Import   Future
 Adapter       Adapter      Adapters
```

---

# 251. Son Karar

Guide incelendikten sonra önceki ana karar **değişmedi**, fakat daha net hale geldi:

> UI'ı bir BPMN çizim aracı olarak değil, durable execution semantiğini anlayan bir **Workflow Studio / Orchestration IDE** olarak geliştirmeliyiz.

BPMN:

```text
compatibility/import concern
```

Conductor JSON:

```text
runtime adapter concern
```

Canonical domain:

```text
our product core
```

Bu ayrım korunursa ürün hem Orkes/Conductor tarzı güçlü bir workflow designer olur hem de gelecekte Flowable, Camunda, Temporal veya özel motorlara adapte edilebilir.

---

# 252. AI Coding Agent — Guide Sonrası Zorunlu Ek Kurallar

```text
1. Definition ve Execution modellerini ayır.
2. Workflow status enum'una CANCELLED ekleme.
3. Task status için CANCELED kullan.
4. Retry enum LINEAR_BACKOFF olmalı.
5. Worker Task Definition ve workflow Task Configuration farklı entity olmalı.
6. schemaVersion daima schema validation version gibi ele alınmamalı.
7. enforceSchema ayrı alan olmalı.
8. Secrets: ${workflow.secrets.*}
9. Environment: ${workflow.env.*}
10. Dynamic input expressions autocomplete desteklemeli.
11. Validate / Mock Test / Real Execute üç ayrı operasyon olmalı.
12. Execution detail Diagram + Task List + Timeline + Summary + I/O + JSON sunmalı.
13. Task detail Summary + Input + Output + Logs + JSON + Definition sunmalı.
14. reasonForIncompletion first-class debug field olmalı.
15. Idempotency: FAIL / RETURN_EXISTING / FAIL_ON_RUNNING.
16. Existing execution definition snapshot'ı korunmalı.
17. BPMN import sonrası conversion review + validation zorunlu olmalı.
18. Schedule editor timezone, catch-up ve bounds desteklemeli.
19. Signal ile Human Task completion semantiğini karıştırma.
20. Start Workflow ve Sub Workflow async/sync farkını UI'da açık göster.
```

---

# 253. Orkes Guide Verification Checklist

Implementation tamamlandığında aşağıdaki checklist çalıştırılmalıdır:

```text
[ ] Workflow definition schemaVersion=2 destekleniyor
[ ] Workflow input/output mapping destekleniyor
[ ] failureWorkflow destekleniyor
[ ] restartable destekleniyor
[ ] workflow timeout destekleniyor
[ ] input/output schema destekleniyor
[ ] enforceSchema destekleniyor

[ ] SIMPLE task definition registry ayrı
[ ] retryCount
[ ] retryLogic
[ ] retryDelaySeconds
[ ] maxRetryDelaySeconds
[ ] backoffJitterMs
[ ] totalTimeoutSeconds
[ ] timeoutSeconds
[ ] responseTimeoutSeconds
[ ] pollTimeoutSeconds

[ ] Switch
[ ] Do While
[ ] Fork
[ ] Dynamic Fork
[ ] Join
[ ] Sub Workflow
[ ] Start Workflow
[ ] Set Variable
[ ] Wait
[ ] Human
[ ] Terminate

[ ] workflow input expressions
[ ] workflow variables
[ ] task input/output expressions
[ ] secrets
[ ] env variables

[ ] definition validate
[ ] mocked workflow test
[ ] real execution

[ ] workflow version selector
[ ] execution snapshot awareness

[ ] RUNNING
[ ] PAUSED
[ ] COMPLETED
[ ] TIMED_OUT
[ ] TERMINATED
[ ] FAILED

[ ] SCHEDULED
[ ] IN_PROGRESS
[ ] SKIPPED
[ ] TIMED_OUT
[ ] CANCELED
[ ] FAILED
[ ] FAILED_WITH_TERMINAL_ERROR
[ ] COMPLETED_WITH_ERRORS
[ ] COMPLETED

[ ] execution diagram
[ ] task list
[ ] timeline
[ ] summary
[ ] workflow I/O
[ ] execution JSON
[ ] task logs
[ ] retry attempts
[ ] worker ID
[ ] reasonForIncompletion

[ ] BPMN file upload
[ ] BPMN drag-drop
[ ] BPMN raw XML
[ ] multi-start validation
[ ] circular reference validation

[ ] idempotency key
[ ] FAIL
[ ] RETURN_EXISTING
[ ] FAIL_ON_RUNNING

[ ] direct start
[ ] schedule
[ ] event-trigger awareness
[ ] signal/resume
```

---

## Guide İnceleme Tarihi

```text
2026-09-12
```

Bu v2 doküman, ekran görüntülerindeki UX analizi ile Orkes'in güncel workflow developer guide semantiğini birleştiren uygulama spesifikasyonudur.
