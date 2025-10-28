# Vercel 部署指南

## ⚠️ 重要提示：better-sqlite3 在 Vercel 上的限制

`better-sqlite3` 是一个原生 Node.js 库，在 Vercel 无服务器环境中存在以下问题：

1. **文件系统只读**：Vercel 的无服务器函数只能写入 `/tmp` 目录，且数据在函数调用后会丢失
2. **原生模块编译**：可能在构建时失败
3. **无状态环境**：每次函数调用都是独立的，不适合本地数据库

## 当前修复（临时方案）

已应用以下修复：

1. ✅ 修复了 `crypto.randomUUID()` 导入问题
2. ✅ 在 `next.config.ts` 中添加了 `better-sqlite3` 外部包配置
3. ✅ 移除构建命令中的 `--turbopack` 标志
4. ✅ 添加了详细的错误日志

## 部署步骤

### 1. 提交代码更改

```bash
git add .
git commit -m "fix: 修复批量添加功能，添加 Vercel 配置"
git push origin main
```

### 2. 在 Vercel 中重新部署

访问 Vercel 控制台，触发重新部署。

### 3. 查看部署日志

在 Vercel 的 Functions 日志中查看详细的错误信息（现在有 `[Batch API]` 和 `[Database]` 标签）。

## 长期解决方案（推荐）

如果当前修复仍然无法解决问题，建议迁移到以下方案之一：

### 方案 1: Turso（推荐，仍然使用 SQLite）

[Turso](https://turso.tech) 是基于 libSQL 的云原生 SQLite 数据库，完美适配无服务器环境。

```bash
# 安装依赖
npm install @libsql/client

# 注册 Turso 并创建数据库
# https://turso.tech
```

### 方案 2: Vercel Postgres

```bash
# 在 Vercel 项目中启用 Postgres
# 安装依赖
npm install @vercel/postgres
```

### 方案 3: Vercel KV (Redis)

适合简单的键值存储场景。

```bash
npm install @vercel/kv
```

## 调试步骤

如果批量添加仍然失败：

1. **查看 Vercel 函数日志**
   - 访问 Vercel Dashboard > 你的项目 > Deployments > 选择最新部署 > Functions
   - 查找包含 `[Batch API]` 和 `[Database]` 的日志条目

2. **检查错误详情**
   - 前端现在会返回详细的错误信息
   - 在浏览器控制台查看完整的错误响应

3. **本地测试**
   ```bash
   npm run build
   npm run start
   ```
   访问 http://localhost:3000/add 测试批量添加功能

## 临时解决方案

如果需要立即使用批量添加功能，可以：

1. **使用单个添加**：一次添加一条记录
2. **在本地运行**：`npm run dev` 然后访问 http://localhost:3000
3. **等待迁移到云数据库**

## 需要帮助？

如果问题仍然存在，请提供：
- Vercel 函数日志截图
- 浏览器控制台错误信息
- 批量添加时使用的文本格式示例

