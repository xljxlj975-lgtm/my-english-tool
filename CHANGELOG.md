# Changelog

All notable changes to the English Mistake Review Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-12-14

### 🎉 Major Release: Enhanced SRS System

Complete rewrite of the spaced repetition system, solving review limit and load fluctuation issues.

### ✨ New Features

#### 4-Level Scoring System
- **Score 0 (Forgot)** 😰 - Drop 3 stages, quick relearning
- **Score 1 (Hard)** 🤔 - Stay at current stage, 50% shorter interval
- **Score 2 (Good)** ✅ - Normal progression (+1 stage)
- **Score 3 (Perfect)** 🚀 - Skip levels, accelerated learning

#### Progressive Stable Growth Algorithm
- Basic stages: 1→3→7→14→21→35→50→70→100→140 days
- Advanced stages: Progressive growth, capped at 120 days
- No more "review in several years" scenarios

#### Intelligent Scheduling System
- Priority calculation based on score, overdue days, and stage
- Difficult cards reviewed first
- Well-learned cards have longer intervals

### 🗄️ Database Changes

**⚠️ Manual migration required**

New fields added to `mistakes` table:
- `last_score` INTEGER - Last score (0-3)
- `consecutive_hard_count` INTEGER - Consecutive hard count
- `health_check_at` TIMESTAMP - Health check time
- `previous_interval` INTEGER - Previous interval in days
- `reappear_count` INTEGER - Reappearance count

**Migration**: Run `migrations/v3.0-enhanced-srs.sql` in Supabase Dashboard

### 📦 Updated Components

**Core Algorithm**:
- `src/lib/spaced-repetition.ts` - Complete rewrite with v3.0 system

**API**:
- `src/app/api/mistakes/[id]/route.ts` - Supports new scoring, backward compatible

**UI Components**:
- `src/components/MistakeCard.tsx` - 4 scoring buttons
- `src/components/ExpressionCard.tsx` - 4 scoring buttons
- `src/app/review/page.tsx` - Integrated new scoring system

### 📚 Documentation

- `docs/NEW_SRS_IMPLEMENTATION_PLAN.md` - Complete technical design (60+ pages)
- `V3_QUICK_START.md` - Quick start guide
- `V3_IMPLEMENTATION_SUMMARY.md` - Implementation summary

### 🔧 Migration Guide

**Required Steps**:

1. **Execute database migration**:
   - Open Supabase Dashboard → SQL Editor
   - Run `migrations/v3.0-enhanced-srs.sql`

2. **Validate migration**:
   ```bash
   node scripts/validate-migration.js
   ```

3. **Start application**:
   ```bash
   npm run dev
   ```

### ✅ Backward Compatibility

- 100% backward compatible with existing code
- Old `isCorrect` parameter still works
- Legacy functions preserved and mapped to new system

### 🐛 Fixed Issues

- ✅ Expression type limited to 4 reviews
- ✅ Mistake intervals growing infinitely (review in years)
- ✅ Large daily review load fluctuations
- ✅ Lack of fine-grained scoring mechanism

### 📊 Performance

- Build status: ✅ Passed (no errors)
- Build time: ~2 seconds
- Runtime performance: No impact

### 🔮 Future Plans (Optional)

- Phase 4: Same-day reappearance (difficult cards repeat in session)
- Phase 5: Smart load balancing (dashboard shows future load forecast)

### 👥 Contributors

- Claude Sonnet 4.5 (AI Assistant)

---

## [2.0.0] - 2025-01-15

### 🏗️ Architecture

- **Separated Mistake and Expression Systems**: Completely decoupled error correction and expression upgrade into two independent learning systems
  - **Independent UI Components**: Created `MistakeCard` (red ❌) for error correction and `ExpressionCard` (purple 💡/✨) for expression upgrades
  - **Extended SRS Algorithms with Infinite Ladder**:
    - Mistakes: 8-stage infinite ladder [1, 3, 7, 14, 30, 60, 120, 240] days
    - Expressions: 4-stage lightweight system [1, 7, 21, 60] days
  - **Intelligent Decay Mechanism**: Mistakes that are overdue beyond `interval × 2` automatically drop one stage to reinforce learning
  - **Different Interaction Flows**:
    - Mistakes: User marks correct/incorrect, can retry immediately if wrong, subject to decay
    - Expressions: User only acknowledges, always advances to next stage, no decay
  - **Cognitive Optimization**: Appropriate cues for each learning goal - error correction vs. expression improvement
  - **API Smart Routing**: Dynamic SRS logic selection based on `content_type` with decay calculation for mistakes

### 🔧 Fixed

- **Critical Bug**: Fixed auto-progression issue where items would advance to the next review stage automatically based on time, even if not reviewed
- Review logic now correctly tracks actual review behavior using `last_reviewed_at` field
- Items only progress when user explicitly reviews them

### ✨ Added

- **Daily Target System**: Configurable daily review goals (30/50/70/100 items)
- **Backlog Management**: Separate queue for overdue and overflow items
- **Expression Content Type**: Support for learning better expressions, not just error corrections
- **Settings Page**: User interface to configure Daily Target preference
- **Progress Visualization**: Daily Target progress bar on Dashboard
- **Enhanced Dashboard**: Shows completed count, backlog count, and Daily Target progress
- **Type-Specific UI**: Different prompts and icons for Mistakes (❌) vs Expressions (💡)
- **Separate Quick Actions**: Dedicated buttons for "Add Mistake" and "Add Expression"

### 🗄️ Changed

- Modified `calculateNextReviewDate()` to accept `lastReviewedAt` parameter
- Updated all API endpoints to support `content_type` field
- Enhanced Dashboard API to return `todayCompletedCount`, `backlogCount`, and `dailyTarget`
- Review page now adapts UI based on content type
- Add page now includes content type selector

### 🗃️ Database

- Added `content_type` enum field to `mistakes` table (default: 'mistake')
- Added `last_reviewed_at` timestamptz field to `mistakes` table (nullable)
- Created `user_settings` table for Daily Target configuration
- Added indexes on `content_type` and `last_reviewed_at` for performance

### 📚 Documentation

- Created comprehensive upgrade guide (`UPGRADE_TO_V2.0.md`)
- Updated README with v2.0 features and migration steps
- Added migration instructions in `migrations/README.md`

### 🔄 Migration

- All existing data automatically migrates to `content_type = 'mistake'`
- Existing items have `last_reviewed_at = NULL` until first review in v2.0
- Backward compatible: first review uses `created_at`, subsequent reviews use `last_reviewed_at`

## [1.0.0] - 2024-12-01

### ✨ Added

- Initial release
- Single and batch mistake entry
- Flashcard-style review interface
- Spaced repetition algorithm based on simplified Ebbinghaus forgetting curve
- Dashboard with statistics and metrics
- Calendar view for scheduled reviews
- Mistake library with search and filter
- Support for mistake types: Grammar, Vocabulary, Collocation, Tense, Pronunciation
- Responsive design with Tailwind CSS
- Next.js 15 with React 19
- Supabase PostgreSQL database integration

### Review Stages (v1.0)
- Day 0: Initial review
- Day 3: First follow-up
- Day 7: Second follow-up
- Day 14: Third follow-up
- Day 30: Final review

---

## Migration Guides

- [Upgrading from v1.0 to v2.0](UPGRADE_TO_V2.0.md)

## Version Comparison

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Behavior-driven review | ❌ | ✅ |
| Daily Target | ❌ | ✅ |
| Backlog management | ❌ | ✅ |
| Expression support | ❌ | ✅ |
| Settings page | ❌ | ✅ |
| Auto-progress bug | ⚠️ Present | ✅ Fixed |
| Basic review | ✅ | ✅ |
| Dashboard | ✅ | ✅ Enhanced |
| Calendar view | ✅ | ✅ |
| Library | ✅ | ✅ |

[2.0.0]: https://github.com/yourusername/my-english-tool/releases/tag/v2.0.0
[1.0.0]: https://github.com/yourusername/my-english-tool/releases/tag/v1.0.0
