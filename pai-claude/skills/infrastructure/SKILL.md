---
name: infrastructure
description: Nomad/Consul/Caddy 基礎設施管理。USE WHEN 使用者提到 deploy, nomad, consul, caddy, service, 部署, 基礎設施, 服務發現, 反向代理, job, allocation。
---

# Infrastructure Skill

管理 Nomad/Consul/Caddy 基礎設施的專業技能。

## Workflow Routing

- Nomad Job 部署 → [workflows/nomad-deploy.md](workflows/nomad-deploy.md)
- Consul 服務註冊 → [workflows/consul-service.md](workflows/consul-service.md)
- Caddy 反向代理 → [workflows/caddy-proxy.md](workflows/caddy-proxy.md)

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

## Common Commands

```bash
# Nomad
nomad job run <job.hcl>
nomad job status <job-name>
nomad alloc logs <alloc-id>

# Consul
consul services
consul catalog services
consul kv get <key>

# Caddy
caddy reload --config /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
```
