# 数据库Migrations执行说明

## v2.0 Migrations

本次升级需要执行2个migration文件，按以下顺序执行：

### 1. v2.0-add-content-type-and-last-reviewed.sql

**作用**：添加 `content_type` 和 `last_reviewed_at` 字段

**如何执行**：
1. 打开 Supabase Dashboard: https://mymwjgngokvxrmxqqvxd.supabase.co
2. 进入左侧菜单 **SQL Editor**
3. 点击 **New Query**
4. 复制 `migrations/v2.0-add-content-type-and-last-reviewed.sql` 的全部内容
5. 粘贴到编辑器中
6. 点击 **Run** 按钮执行
7. 确认执行成功（没有错误提示）

### 2. v2.0-add-user-settings.sql

**作用**：创建 `user_settings` 表用于存储Daily Target配置

**如何执行**：
1. 同样在 **SQL Editor** 中
2. 创建新查询
3. 复制 `migrations/v2.0-add-user-settings.sql` 的全部内容
4. 粘贴并执行
5. 确认执行成功

## 验证Migrations是否成功

执行以下SQL查询来验证：

```sql
-- 检查 mistakes 表是否有新字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mistakes'
  AND column_name IN ('content_type', 'last_reviewed_at');

-- 应该返回2行：
-- content_type    | USER-DEFINED
-- last_reviewed_at | timestamp with time zone

-- 检查 user_settings 表是否创建成功
SELECT * FROM user_settings;

-- 应该返回1行，daily_target = 50
```

## 注意事项

- ✅ 这些migrations是安全的，不会删除任何现有数据
- ✅ 所有现有数据会自动设置 `content_type = 'mistake'`
- ✅ `last_reviewed_at` 默认为 NULL（表示未复习过）
- ✅ 可以重复执行这些migrations（使用了 IF NOT EXISTS）

## 如果执行失败

如果看到"already exists"错误，说明该对象已经存在，可以忽略。

如果遇到其他错误，请检查：
1. Supabase是否在线
2. 是否有足够的权限
3. 是否在正确的数据库中执行
