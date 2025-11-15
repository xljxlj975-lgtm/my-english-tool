# English Mistake Review Tool - v2.0 Upgrade Guide

## 🎉 Welcome to v2.0!

This upgrade brings significant improvements to the review system and adds support for Expression content types.

## 📋 What's New in v2.0

### 1. ✅ Fixed Core Review Logic
**Problem Fixed:** In v1.0, items would automatically progress to the next review stage based on time, even if you never reviewed them. This violated the principles of spaced repetition learning.

**Solution:** v2.0 now tracks actual review behavior with `last_reviewed_at`. Items only progress when you actually review them.

### 2. 🎯 Daily Target System
- Set your daily review goal (default: 50 items)
- Configurable in Settings page: 30 / 50 / 70 / 100
- Prevents review overload
- See progress bar on Dashboard

### 3. 📦 Backlog Management
- Items beyond daily target go into backlog
- Overdue items that weren't reviewed accumulate in backlog
- "Clear Backlog" button on Dashboard
- Never lose track of items you need to review

### 4. 💡 Expression Support
Now supports two types of content:
- **Mistake (❌)**: Error corrections
- **Expression (💡)**: Better ways to express ideas

Each type has customized UI and labels.

### 5. 📊 Enhanced Dashboard
- Daily Target progress bar
- Today's completed count
- Backlog warning
- Separate quick actions for Mistakes and Expressions

---

## 🚀 Migration Steps

### Step 1: Execute Database Migrations

**⚠️ IMPORTANT:** You must run database migrations before using v2.0.

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to your project
3. Go to **SQL Editor**
4. Execute these two migration files in order:

#### Migration 1: Add content_type and last_reviewed_at fields

```sql
-- Copy contents from: migrations/v2.0-add-content-type-and-last-reviewed.sql
```

#### Migration 2: Create user_settings table

```sql
-- Copy contents from: migrations/v2.0-add-user-settings.sql
```

#### Verify Migrations

Run this query to verify:

```sql
-- Check new columns in mistakes table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mistakes'
  AND column_name IN ('content_type', 'last_reviewed_at');

-- Should return 2 rows

-- Check user_settings table
SELECT * FROM user_settings;

-- Should return 1 row with daily_target = 50
```

### Step 2: Restart Development Server

```bash
npm run dev
```

### Step 3: Verify New Features

1. **Check Dashboard**
   - Should see Daily Target progress bar
   - Should see separate "Add Mistake" and "Add Expression" buttons

2. **Add Content**
   - Try adding both a Mistake and an Expression
   - Verify content type selector works

3. **Review Items**
   - Start a review session
   - Verify "Got It" and "Need More Practice" buttons work
   - Check that items don't auto-progress

4. **Configure Settings**
   - Go to Settings page (⚙️ icon)
   - Try changing Daily Target
   - Save and verify changes persist

---

## 🔄 Data Migration

### Existing Data

✅ **All your existing data is safe!**

After running migrations:
- All existing items automatically become `content_type = 'mistake'`
- All existing items have `last_reviewed_at = NULL` (not yet reviewed in v2.0)
- First review after upgrade will use `created_at` as base date (backward compatible)
- Subsequent reviews will use `last_reviewed_at`

### Review Behavior Changes

**Before v2.0:**
```
Day 0: Create item → next_review_at = Day 0
[User doesn't review]
Day 3: Item automatically moves to next stage (❌ BUG)
```

**After v2.0:**
```
Day 0: Create item → next_review_at = Day 0
[User doesn't review]
Day 3: Item stays in backlog (✅ CORRECT)
[User reviews on Day 5]
Day 5: Item moves to next stage → next_review_at = Day 5 + 3 = Day 8
```

---

## 📖 Feature Guide

### Daily Target

**How it works:**
1. Set your target in Settings (e.g., 50)
2. Each day, up to 50 items scheduled for review
3. Items 51+ go to backlog
4. Backlog items can be reviewed separately

**Why it's useful:**
- Prevents overwhelming review sessions
- Maintains consistent daily practice
- You control the pace

### Backlog

**What goes into backlog:**
- Items beyond daily target
- Overdue items from previous days
- Items you haven't reviewed yet

**How to clear backlog:**
- Click "Clear Backlog" button on Dashboard
- Review additional items when you have time
- System shows how many items in backlog

### Content Types

**Mistake Example:**
```
Error Sentence: "I have went to school"
Correct Sentence: "I have gone to school"
Explanation: Use past participle "gone" with "have"
```

**Expression Example:**
```
Original Expression: "I think that's good"
Improved Expression: "I believe that's an excellent approach"
Explanation: More formal and emphatic
```

---

## 🛠️ Troubleshooting

### Issue: Migrations fail

**Solution:**
- Check Supabase connection
- Verify you're using the service role key
- Try running migrations one statement at a time

### Issue: Dashboard shows errors

**Solution:**
1. Clear browser cache
2. Restart dev server
3. Check browser console for errors
4. Verify migrations completed successfully

### Issue: Old items don't appear in reviews

**Solution:**
- This is expected! Items are now filtered by actual review status
- Check backlog for overdue items
- Review items will appear when `next_review_at` date arrives

### Issue: Settings page doesn't save

**Solution:**
1. Check network tab for API errors
2. Verify `user_settings` table exists
3. Ensure at least one row exists in `user_settings`

---

## 🔍 Technical Changes Summary

### Database Schema Changes

**New Fields in `mistakes` table:**
- `content_type` (enum: 'mistake' | 'expression') - Default: 'mistake'
- `last_reviewed_at` (timestamptz, nullable) - Records actual review time

**New Table:**
- `user_settings` - Stores daily_target configuration

### API Changes

**Modified Endpoints:**
- `POST /api/mistakes` - Now accepts `content_type` parameter
- `POST /api/mistakes/batch` - Now accepts `content_type` parameter
- `PUT /api/mistakes/[id]` - Now records `last_reviewed_at`
- `GET /api/dashboard` - Returns new fields: `todayCompletedCount`, `backlogCount`, `dailyTarget`

**New Endpoints:**
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings
- `GET /api/review-queue` - Get review queue with Daily Target filtering

### Core Logic Changes

**spaced-repetition.ts:**
```typescript
// v1.0 (Bug)
calculateNextReviewDate(stage, isCorrect, createdAt)

// v2.0 (Fixed)
calculateNextReviewDate(stage, isCorrect, lastReviewedAt, createdAt)
```

**Review filtering:**
```typescript
// v2.0: Only show items that truly need review
const needsReview = items.filter(item => {
  if (!item.last_reviewed_at) return true; // Never reviewed
  return new Date(item.last_reviewed_at) < new Date(item.next_review_at);
});
```

---

## 📚 Additional Resources

- **Migration Files:** `/migrations/v2.0-*.sql`
- **API Documentation:** `/src/app/api/README.md`
- **Content Type Config:** `/src/lib/content-type.ts`
- **Settings Helper:** `/src/lib/settings.ts`

---

## ✅ Upgrade Checklist

- [ ] Executed migration 1 (content_type and last_reviewed_at)
- [ ] Executed migration 2 (user_settings table)
- [ ] Verified migrations with SQL queries
- [ ] Restarted development server
- [ ] Tested Dashboard (see new UI)
- [ ] Added a Mistake
- [ ] Added an Expression
- [ ] Completed a review session
- [ ] Configured Daily Target in Settings
- [ ] Checked that old data still works

---

## 🎊 You're Done!

Welcome to English Mistake Review Tool v2.0! Enjoy the improved review system and new features.

**Questions or Issues?**
- Check the troubleshooting section above
- Review migration logs in Supabase
- Check browser console for errors

Happy learning! 📚✨
