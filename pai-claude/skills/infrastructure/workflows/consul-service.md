# Consul 服務管理 Workflow

## 服務查詢

```bash
# 列出所有服務
consul catalog services

# 查看服務實例
consul catalog nodes -service=<service-name>

# 健康檢查狀態
consul health checks <service-name>
```

## 服務註冊

服務通常透過 Nomad job 自動註冊，但也可以手動註冊：

```bash
consul services register <service.json>
```

## KV Store 操作

```bash
# 讀取
consul kv get <key>
consul kv get -recurse <prefix>

# 寫入
consul kv put <key> <value>

# 刪除
consul kv delete <key>
```

## DNS 查詢

```bash
# 查詢服務
dig @127.0.0.1 -p 8600 <service-name>.service.consul

# 查詢特定 tag
dig @127.0.0.1 -p 8600 <tag>.<service-name>.service.consul
```
