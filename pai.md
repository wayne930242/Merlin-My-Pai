# 個人 AI 基礎設施規格書

**Personal AI Infrastructure (PAI) Specification**

基於 Daniel Miessler PAI v2 架構設計  
適用於 WayDoSoft 全端工程環境

版本 1.0 | 2025 年 12 月

---

## 目錄

1. [概述](#1-概述)
2. [核心設計原則](#2-核心設計原則)
3. [系統架構](#3-系統架構)
4. [Skills 系統（核心）](#4-skills-系統核心)
5. [輔助系統](#5-輔助系統)
6. [實施計畫](#6-實施計畫)
7. [技術規格](#7-技術規格)

---

## 1. 概述

### 1.1 什麼是 Personal AI Infrastructure

Personal AI Infrastructure（PAI）是一個統一的、模組化的 AI 系統架構，旨在將 AI 工具從零散的聊天介面轉變為個人認知基礎設施。PAI 的核心理念是：**系統架構與上下文管理比模型智能更重要**。

本規格書基於 Daniel Miessler 的 PAI v2 架構，針對全端工程師的工作流程進行客製化設計，整合現有的 Nomad、Consul、Caddy 基礎設施，實現 AI 能力的系統性擴展。

### 1.2 設計目標

- 將 Claude Code 個人化為專屬的數位助理系統
- 建立可複用、可組合的 Skills 系統，**一次解決問題，永久成為模組**
- 實現上下文的智慧路由，讓正確的知識在正確的時間到達正確的 Agent
- 整合現有 WayDoSoft 基礎設施（Nomad/Consul/Caddy）
- 支援 ERP/MES/APS 領域的 AI 輔助開發與維護

### 1.3 AI 成熟度模型

PAI 採用五階段 AI 成熟度模型來衡量系統能力：

| Level | 名稱 | 說明 |
|-------|------|------|
| 0 | Natural | 無 AI 使用，純人工作業 |
| 1 | Chatbots | 使用 ChatGPT、Claude 等聊天介面 |
| **2** | **Agentic** | **AI Agent 可使用工具、呼叫 API、執行動作（本系統目標）** |
| 3 | Workflows | 自動化流水線，AI 串聯多個操作 |
| 4 | Managed | AI 持續監控、調整、優化系統 |

---

## 2. 核心設計原則

PAI 系統遵循以下 **13 項核心原則**，這些原則來自實際建構 AI 系統的經驗：

| # | 原則 | 說明 |
|---|------|------|
| 1 | **Clear Thinking + Prompting is King** | 清晰思考優先於 Prompt 撰寫 |
| 2 | **Scaffolding > Model** | 系統架構比模型智能更重要 |
| 3 | **As Deterministic as Possible** | 盡可能確定性，減少隨機性 |
| 4 | **Code Before Prompts** | 能用程式碼解決就不用 AI |
| 5 | **Spec / Test / Evals First** | 先定義規格和測試 |
| 6 | **UNIX Philosophy** | 單一職責，可組合工具 |
| 7 | **ENG / SRE Principles** | 版本控制、自動部署、監控 |
| 8 | **CLI as Interface** | 命令列介面優先 |
| 9 | **Goal → Code → CLI → Prompts → Agents** | 決策階層 |
| 10 | **Meta / Self Update System** | 系統可自我更新 |
| 11 | **Custom Skill Management** | 客製化技能管理 |
| 12 | **Custom History System** | 客製化歷史系統 |
| 13 | **Custom Agent Personalities** | 客製化 Agent 人格 |

### 決策階層詳解

解決問題時的優先順序：

```
1. Goal    → 先釐清目標是什麼
2. Code    → 能寫腳本解決嗎？（確定性方案）
3. CLI     → 有現成工具嗎？（使用既有工具）
4. Prompts → 需要 AI 嗎？（使用模板/patterns）
5. Agents  → 需要專業 AI 嗎？（生成客製 Agent）
```

---

## 3. 系統架構

### 3.1 整體架構概覽

PAI 系統由六大核心組件構成：

| 組件 | 說明 |
|------|------|
| **Skills 系統** | 領域專業知識的容器，定義「做什麼」和「怎麼做」 |
| **Context 管理** | 知識如何在系統中流動，讓正確的上下文到達正確的地方 |
| **History 系統** | 自動記錄所有工作，保存學習成果和決策過程 |
| **Hook 系統** | 事件驅動自動化，在特定時機自動執行動作 |
| **Agent 系統** | 專業化的 AI 人格，不同任務使用不同專家 |
| **Security 系統** | 多層防禦機制，保護資料和工作流程安全 |

### 3.2 目錄結構

```
~/.claude/
├── Skills/                 # 技能模組
│   ├── Development/        # 開發相關
│   │   ├── SKILL.md
│   │   ├── Workflows/
│   │   │   ├── TDD.md
│   │   │   └── CodeReview.md
│   │   └── Tools/
│   ├── Infrastructure/     # 基礎設施
│   │   ├── SKILL.md
│   │   ├── Workflows/
│   │   │   ├── NomadDeploy.md
│   │   │   ├── ConsulService.md
│   │   │   └── CaddyProxy.md
│   │   └── Tools/
│   ├── Research/           # 研究調查
│   ├── ERP-Domain/         # ERP/MES/APS 領域
│   └── Documentation/      # 文件撰寫
├── History/                # 歷史紀錄
│   ├── Sessions/           # 會話紀錄
│   ├── Learnings/          # 學習成果
│   ├── Research/           # 研究發現
│   └── Decisions/          # 決策紀錄
├── Agents/                 # Agent 定義
│   ├── Engineer.md
│   ├── Architect.md
│   ├── Researcher.md
│   └── QATester.md
├── Hooks/                  # 事件鉤子
│   ├── session-start/
│   ├── pre-tool-use/
│   ├── post-tool-use/
│   └── stop/
├── Context/                # 核心上下文
│   ├── Identity.md         # 身份定義
│   ├── Principles.md       # 核心原則
│   └── Contacts.md         # 聯絡人資訊
└── .mcp.json               # MCP 設定
```

### 3.3 資料流

```
使用者輸入
    ↓
┌─────────────────────────────────┐
│  Context Management             │
│  (載入相關 Skills + History)     │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Skill Routing                  │
│  (根據觸發詞路由到對應 Skill)     │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Workflow Execution             │
│  (執行 Skill 中的 Workflows)     │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Hook System                    │
│  (PostToolUse → 記錄到 History)  │
└─────────────────────────────────┘
    ↓
輸出結果
```

---

## 4. Skills 系統（核心）

> ⚠️ **這是整個 PAI 最重要的組件。**

一個 Skill 是一個自包含的領域專業知識包，教導 AI 你在特定領域的工作方式。

### 4.1 Skill 結構

每個 Skill 包含三個核心部分：

```
Skills/[SkillName]/
├── SKILL.md          # 定義何時使用此 Skill 及領域知識
├── Workflows/        # 特定操作的步驟流程
│   ├── Workflow1.md
│   └── Workflow2.md
└── Tools/            # CLI 腳本和工具程式
    ├── tool1.ts
    └── tool2.sh
```

### 4.2 SKILL.md 格式

```markdown
---
name: SkillName
description: 簡短描述。USE WHEN 使用者提到 [觸發詞列表]。
---

## Workflow Routing

- 操作A → Workflows/WorkflowA.md
- 操作B → Workflows/WorkflowB.md

## Domain Knowledge

- 領域知識點 1
- 領域知識點 2

## Tools Available

- `tool1` - 工具說明
- `tool2` - 工具說明
```

### 4.3 建議的初始 Skills

| Skill 名稱 | 用途 | 觸發詞 |
|-----------|------|--------|
| **Infrastructure** | Nomad/Consul/Caddy 管理 | deploy, nomad, consul, caddy, 部署 |
| **Development** | TypeScript/Vue/React 開發 | code, develop, 開發, 程式, component |
| **ERP-Domain** | ERP/MES/APS 領域知識 | erp, mes, aps, 工單, 排程, 物料 |
| **Research** | 技術調研、資料收集 | research, 調查, 研究, 比較, 評估 |
| **Documentation** | 文件撰寫、API 文件 | document, 文件, readme, api doc |
| **Database** | 資料庫設計、查詢優化 | database, sql, 資料庫, query, schema |

### 4.4 Skill 範例：Infrastructure

**SKILL.md**

```markdown
---
name: Infrastructure
description: Nomad/Consul/Caddy 基礎設施管理。
  USE WHEN 使用者提到 deploy, nomad, consul, caddy,
  service, 部署, 基礎設施, 服務發現, 反向代理。
---

## Workflow Routing

- Nomad Job 部署 → Workflows/NomadDeploy.md
- Consul 服務註冊 → Workflows/ConsulService.md
- Caddy 反向代理設定 → Workflows/CaddyProxy.md
- 服務健康檢查 → Workflows/HealthCheck.md

## Domain Knowledge

### Nomad
- Job spec 使用 HCL 格式
- 支援 Docker、exec、raw_exec driver
- 使用 constraint 控制部署目標
- template stanza 整合 Consul Template

### Consul
- 服務發現透過 DNS 或 HTTP API
- 健康檢查支援 HTTP、TCP、Script、gRPC
- KV Store 用於動態配置

### Caddy
- 自動 HTTPS（Let's Encrypt / ZeroSSL）
- Caddyfile 或 JSON 配置
- 整合 Consul 進行動態 upstream

## Tools Available

- `nomad job run` - 部署 Job
- `consul services` - 查看服務列表
- `caddy reload` - 重載配置
```

**Workflows/NomadDeploy.md**

```markdown
# Nomad 部署 Workflow

## 前置檢查

1. 確認 Job spec 語法正確：`nomad job validate <job.hcl>`
2. 執行 Plan 檢視變更：`nomad job plan <job.hcl>`
3. 確認 Consul 連線正常

## 部署流程

1. 執行部署：`nomad job run <job.hcl>`
2. 監控部署狀態：`nomad job status <job-name>`
3. 檢查 allocation 日誌：`nomad alloc logs <alloc-id>`

## 回滾

如部署失敗：
1. 查看版本歷史：`nomad job history <job-name>`
2. 回滾到指定版本：`nomad job revert <job-name> <version>`

## 常見問題

- 如果 allocation pending，檢查資源約束
- 如果 health check 失敗，檢查服務埠和路徑
```

### 4.5 Skill 的威力：組合

Skills 不是孤立運作，它們可以互相呼叫：

```
使用者：「部署新版本的 ERP 模組」
    ↓
Infrastructure Skill 接收請求
    ↓
呼叫 Development Skill → 確認建置成功
    ↓
呼叫 Database Skill → 執行 migration
    ↓
執行 NomadDeploy Workflow
    ↓
呼叫 Documentation Skill → 更新 changelog
```

**一個指令，多個 Skills 協作，零手動步驟。**

---

## 5. 輔助系統

### 5.1 History 系統（UOCS）

**Universal Output Capture System（UOCS）** 自動記錄所有工作內容。

#### 記錄內容

| 類型 | 說明 | 儲存位置 |
|------|------|----------|
| Sessions | 完整會話紀錄 | `History/Sessions/YYYY-MM-DD-HHMM-topic/` |
| Learnings | 學習到的新知識 | `History/Learnings/[Category]/` |
| Research | 調查研究結果 | `History/Research/[Topic]/` |
| Decisions | 決策及理由 | `History/Decisions/[Category]/` |

#### 儲存格式

- **Markdown**：人類可讀
- **JSONL**：機器可解析
- **時間戳記**：支援時序瀏覽

### 5.2 Hook 系統

Hooks 是事件驅動的自動化機制：

| Hook | 觸發時機 | 用途 |
|------|----------|------|
| **SessionStart** | 開始新會話 | 載入 Context、檢查待辦任務 |
| **PreToolUse** | 工具執行前 | 安全驗證、注入攻擊檢測 |
| **PostToolUse** | 工具執行後 | 記錄結果、更新 History |
| **Stop** | 結束會話 | 生成摘要、保存會話、TTS 播報 |
| **SubagentStop** | Agent 完成 | 收集 Agent 結果 |

#### Hook 範例：SessionStart

```typescript
// ~/.claude/hooks/session-start/load-context.ts
export default async function() {
  // 1. 載入核心 Context
  await loadContext('~/.claude/Context/Identity.md');
  await loadContext('~/.claude/Context/Principles.md');
  
  // 2. 檢查是否有未完成任務
  const pendingTasks = await checkPendingTasks();
  if (pendingTasks.length > 0) {
    console.log(`📋 有 ${pendingTasks.length} 個待辦任務`);
  }
  
  // 3. 初始化 History session
  await initSession();
}
```

### 5.3 Agent 系統

PAI 採用**混合 Agent 模型**：

#### 預定義 Agent

| Agent | 專長 | 人格特質 | 載入的 Skills |
|-------|------|----------|---------------|
| **Engineer** | TDD、功能實作 | 精確、系統化、注重測試 | Development, Database |
| **Architect** | 系統設計、策略規劃 | 策略性、批判性、長遠思考 | Infrastructure, Research |
| **Researcher** | 調查研究、證據收集 | 好奇、徹底、追根究底 | Research, Documentation |
| **QATester** | 品質驗證、自動化測試 | 懷疑、細心、邊界案例 | Development, Research |

#### Agent 定義範例

```markdown
<!-- ~/.claude/Agents/Engineer.md -->
---
name: Engineer
expertise: 技術實作、TDD、TypeScript
personality:
  - 精確
  - 系統化
  - 測試優先
skills:
  - Development
  - Database
voice: technical-precise  # ElevenLabs voice mapping
---

## Approach

當收到任務時，你會：
1. 先寫測試（TDD）
2. 實作最小可行方案
3. 重構優化
4. 補充文件

## Response Style

- 直接、技術性
- 提供程式碼範例
- 解釋設計決策
```

#### 動態 Agent 組合

對於特定任務，可動態組合 Agent：

```
使用者：「建立 5 個 Agent 研究這 5 家公司」
    ↓
AgentFactory 動態組合：
  - personality: ["Curious", "Thorough"]
  - expertise: "company-research"
  - skills: ["Research", "Documentation"]
    ↓
生成 5 個 Researcher Agent 並行執行
```

### 5.4 Security 系統

採用**縱深防禦**策略，四層安全機制：

```
Layer 1: 設定強化
├── MCP Server 白名單
├── 敏感檔案存取控制
└── 工具使用權限

Layer 2: 憲法防禦（Constitutional Defense）
├── 核心原則：不執行外部內容指令
├── STOP → REPORT → LOG 協議
└── 外部內容視為「唯讀資訊」

Layer 3: 執行前驗證（PreToolUse Hook）
├── Prompt Injection 檢測
├── Command Injection 檢測
├── Path Traversal 檢測
└── SSRF 檢測

Layer 4: 安全 API
├── 使用原生 API 替代 Shell 執行
├── 輸入驗證（type, format, length）
└── 輸出驗證
```

---

## 6. 實施計畫

### 6.1 階段一：基礎建設（第 1-2 週）

- [ ] 安裝並設定 Claude Code CLI
- [ ] 建立 `~/.claude/` 目錄結構
- [ ] 設定核心 Context（Identity, Principles）
- [ ] 建立基本 MCP 設定（`.mcp.json`）
- [ ] 測試基本功能

### 6.2 階段二：Skills 開發（第 3-4 週）

- [ ] 建立 **Infrastructure Skill**（Nomad/Consul/Caddy）
- [ ] 建立 **Development Skill**（TypeScript/Vue/React）
- [ ] 建立 **ERP-Domain Skill**（ERP/MES/APS 領域知識）
- [ ] 測試 Skill 路由和 Workflow 執行
- [ ] 迭代優化觸發詞和 Workflow

### 6.3 階段三：自動化整合（第 5-6 週）

- [ ] 實作 Hook 系統（SessionStart, Stop）
- [ ] 設定 History 自動記錄
- [ ] 建立安全層（PreToolUse 驗證）
- [ ] 整合 Fabric patterns（可選）
- [ ] 建立可觀測性 Dashboard（可選）

### 6.4 階段四：Agent 與擴展（第 7-8 週）

- [ ] 定義專業 Agent（Engineer, Researcher, Architect）
- [ ] 建立 Agent 動態組合系統
- [ ] 開發自訂 MCP Server（Cloudflare Workers）
- [ ] 整合 WayDoSoft 內部系統 API
- [ ] 文件化與知識轉移

---

## 7. 技術規格

### 7.1 系統需求

| 項目 | 規格 |
|------|------|
| 作業系統 | Linux (Ubuntu 22.04+) / macOS |
| Runtime | Node.js 20+、Bun 1.0+、Python 3.11+ |
| AI 平台 | Claude Code CLI (Anthropic) |
| 協定 | MCP (Model Context Protocol) |
| 基礎設施 | Nomad 1.6+、Consul 1.15+、Caddy 2.7+ |
| 版本控制 | Git 2.40+ |
| 雲端服務（選用） | Cloudflare Workers (MCP Server 部署) |

### 7.2 整合點

| 系統 | 整合方式 | 用途 |
|------|----------|------|
| **Nomad** | CLI / HTTP API | Job 部署、服務調度、自動擴展 |
| **Consul** | CLI / HTTP API | 服務發現、健康檢查、KV 存儲 |
| **Caddy** | Admin API | 反向代理、自動 HTTPS、負載均衡 |
| **Git** | CLI | 版本控制、Skill 管理、History 備份 |
| **ElevenLabs**（選用） | REST API | TTS 語音輸出 |

### 7.3 MCP 設定範例

```json
{
  "mcpServers": {
    "waydosoft-internal": {
      "type": "http",
      "description": "WayDoSoft 內部 API",
      "url": "https://mcp.internal.waydosoft.com",
      "headers": {
        "Authorization": "Bearer ${WAYDOSOFT_API_TOKEN}"
      }
    },
    "nomad": {
      "command": "nomad-mcp-server",
      "args": ["--address", "http://nomad.service.consul:4646"]
    },
    "fabric": {
      "command": "fabric",
      "args": ["--mcp"]
    }
  }
}
```

---

## 附錄 A：參考資源

- [Daniel Miessler PAI v2](https://danielmiessler.com/blog/personal-ai-infrastructure) - 原始架構設計
- [Fabric Project](https://github.com/danielmiessler/fabric) - AI Pattern 框架
- [Claude Code](https://claude.ai/code) - AI CLI 工具
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP 協定文件
- [n8n Self-hosted AI Starter Kit](https://github.com/n8n-io/self-hosted-ai-starter-kit) - Self-hosted AI 參考

---

## 附錄 B：YouTube 影片摘要

**影片**：Building a Personal AI Infrastructure (PAI) - December 2025 Update  
**講者**：Daniel Miessler  
**長度**：約 40 分鐘

### 核心訊息

1. **What > How**：思考「我們在建什麼」比「怎麼建」更重要
2. **System > Model**：好的系統架構 + 普通模型 > 普通架構 + 頂級模型
3. **Personalization > Prompting**：建立不需要完美 Prompt 的系統
4. **Solve Once, Reuse Forever**：問題只解決一次，然後成為永久模組

### 關鍵概念

- **Kai**：Miessler 的個人化 Claude Code 系統
- **Skills**：領域專業知識的容器（最重要的組件）
- **Meta-Prompting**：用模板生成 Prompt，而非手寫
- **UOCS**：自動記錄所有工作的歷史系統
- **Hooks**：事件驅動的自動化機制

### 實際應用案例

- 18 分鐘建立客製化 Analytics Dashboard（取代 Chartbeat）
- Newsletter 自動化處理
- Intel 報告系統（解析 OSINT 專家的內容）
- Threshold：AI 內容篩選產品

---

*文件結束*