# Vercel 部署指南（Supabase 版本）

## ✅ 当前架构

- 数据持久化：Supabase（PostgreSQL）
- API 托管：Vercel 无服务器函数
- Server Side 环境变量：`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Client Side 环境变量（可选）：`SUPABASE_ANON_KEY`（目前前端未直接使用）

## 部署前准备

1. 在 Supabase 控制台创建项目。
2. 创建 `mistakes` 表（见 `README.md` 中的 Schema）。
3. 确认已关闭 Row Level Security（或为 service role key 配置了读写策略）。
4. 在项目根目录创建 `.env.local`，填入 Supabase 相关变量。
5. 在 Vercel 项目设置中添加同样的环境变量（`Production`、`Preview`、`Development` 环境一致）。

## 部署步骤

### 1. 提交代码更改

```bash
git add .
git commit -m "feat: migrate storage to Supabase"
git push origin main
```

### 2. 在 Vercel 中重新部署

访问 Vercel 控制台，触发重新部署。构建完成后无须额外配置即可连接 Supabase。

### 3. 验证部署

1. 打开部署好的站点。
2. 录入一条错题并刷新页面验证是否持久化。
3. 在 Supabase Table Editor 中检查数据是否写入。

## 常见问题排查

1. **Missing SUPABASE_URL / KEY**
   - 检查 Vercel 环境变量是否配置。
   - 确保 `.env.local` 中变量名称与代码一致。

2. **数据库无数据写入**
   - 检查 Supabase 表是否存在并开启插入权限。
   - 使用 Supabase SQL 编辑器确认 `mistakes` 表结构与 Schema 一致。

3. **RLS 导致 401/403**
   - 关闭 RLS 或为 service role key 编写允许所有操作的策略。

4. **函数日志调试**
   - Vercel Dashboard > Deployments > 选择部署 > Functions 查看日志。
   - 代码中保留了 `[Batch API]` 等日志标签，方便定位。

## 本地开发

1. 确保 `.env.local` 内填有 Supabase 项目信息。
2. 运行 `npm install` 安装依赖。
3. 执行 `npm run dev`，访问 `http://localhost:3000` 即可。

## 需要帮助？

如需进一步支持，请准备以下信息：
- Supabase 项目 ID（或匿名处理后的 URL）
- Vercel 部署日志（截图或关键报错）
- API 响应错误详情（浏览器 Network 面板）
