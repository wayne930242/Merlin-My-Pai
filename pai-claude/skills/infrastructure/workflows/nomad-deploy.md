# Nomad 部署 Workflow

## 前置檢查

1. 確認 Job spec 語法正確
   ```bash
   nomad job validate <job.hcl>
   ```

2. 執行 Plan 檢視變更
   ```bash
   nomad job plan <job.hcl>
   ```

3. 確認 Consul 連線正常

## 部署流程

1. 執行部署
   ```bash
   nomad job run <job.hcl>
   ```

2. 監控部署狀態
   ```bash
   nomad job status <job-name>
   ```

3. 檢查 allocation 日誌
   ```bash
   nomad alloc logs <alloc-id>
   ```

## 回滾

如部署失敗：

1. 查看版本歷史
   ```bash
   nomad job history <job-name>
   ```

2. 回滾到指定版本
   ```bash
   nomad job revert <job-name> <version>
   ```

## 常見問題

- **Allocation pending**：檢查資源約束（memory, cpu）
- **Health check 失敗**：檢查服務埠和健康檢查路徑
- **Constraint 不符**：檢查 node 標籤和約束條件
