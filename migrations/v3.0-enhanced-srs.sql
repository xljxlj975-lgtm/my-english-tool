-- ================================================
-- Migration: v3.0 Enhanced SRS System
-- Description: 添加新字段支持4级评分和智能负载均衡
-- Date: 2025-12-14
-- ================================================

BEGIN;

-- 1. 添加新字段
ALTER TABLE mistakes
  ADD COLUMN IF NOT EXISTS last_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consecutive_hard_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_check_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS previous_interval INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reappear_count INTEGER DEFAULT 0;

-- 2. 为现有数据设置默认值
-- 推断last_score：如果status='learned'，设为3；否则设为2
UPDATE mistakes
SET last_score = CASE
  WHEN status = 'learned' THEN 3
  ELSE 2
END
WHERE last_score IS NULL;

-- 推断previous_interval：从review_stage计算
UPDATE mistakes
SET previous_interval = CASE
  WHEN review_stage = 0 THEN 1
  WHEN review_stage = 1 THEN 3
  WHEN review_stage = 2 THEN 7
  WHEN review_stage = 3 THEN 14
  WHEN review_stage = 4 THEN 21
  WHEN review_stage = 5 THEN 35
  WHEN review_stage = 6 THEN 50
  WHEN review_stage = 7 THEN 70
  WHEN review_stage = 8 THEN 100
  WHEN review_stage = 9 THEN 140
  ELSE 140
END
WHERE previous_interval IS NULL;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_mistakes_health_check
  ON mistakes(health_check_at)
  WHERE health_check_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mistakes_next_review_score
  ON mistakes(next_review_at, last_score);

CREATE INDEX IF NOT EXISTS idx_mistakes_priority
  ON mistakes(last_score, next_review_at, review_stage)
  WHERE status != 'learned';

-- 4. 验证数据完整性
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM mistakes
  WHERE last_score IS NULL OR previous_interval IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % rows have NULL values in new columns', null_count;
  END IF;
END $$;

COMMIT;

-- ================================================
-- 回滚脚本（如需要）
-- ================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_mistakes_priority;
-- DROP INDEX IF EXISTS idx_mistakes_next_review_score;
-- DROP INDEX IF EXISTS idx_mistakes_health_check;
-- ALTER TABLE mistakes
--   DROP COLUMN IF EXISTS last_score,
--   DROP COLUMN IF EXISTS consecutive_hard_count,
--   DROP COLUMN IF EXISTS health_check_at,
--   DROP COLUMN IF EXISTS previous_interval,
--   DROP COLUMN IF EXISTS reappear_count;
-- COMMIT;
