# Caddy 反向代理 Workflow

## 配置驗證

```bash
caddy validate --config /etc/caddy/Caddyfile
```

## 重載配置

```bash
caddy reload --config /etc/caddy/Caddyfile
```

## Caddyfile 範例

```caddyfile
# 基本反向代理
example.com {
    reverse_proxy localhost:8080
}

# 負載均衡
api.example.com {
    reverse_proxy {
        to backend1:8080 backend2:8080
        lb_policy round_robin
        health_uri /health
        health_interval 10s
    }
}

# 整合 Consul
service.example.com {
    reverse_proxy {
        dynamic consul {
            service my-service
        }
    }
}
```

## 常用操作

- **新增站點**：編輯 Caddyfile，執行 reload
- **檢查日誌**：`journalctl -u caddy -f`
- **測試 HTTPS**：`curl -v https://example.com`
