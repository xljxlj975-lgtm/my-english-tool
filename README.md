# English Mistake Review Tool

**Version 2.0** - A web application designed to help English learners systematically review and master their common mistakes using spaced repetition learning.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

## ✨ What's New in v2.0

### 🔧 Fixed Core Review Logic
- **Behavior-Driven Learning**: Items only progress when you actually review them (not automatically by time)
- **Real Review Tracking**: Records `last_reviewed_at` to track actual learning behavior
- **No More Auto-Progress Bug**: Fixed the critical bug where items would advance even if not reviewed

### 🎯 Daily Target System
- **Configurable Daily Goals**: Set your target (30/50/70/100 items per day)
- **Progress Visualization**: See your daily progress with an intuitive progress bar
- **Balanced Learning**: Prevents review overload and maintains consistent practice

### 📦 Backlog Management
- **Smart Queue**: Items beyond daily target go to backlog
- **Overdue Tracking**: Never lose track of items you need to review
- **Flexible Clearing**: Clear backlog items when you have extra time

### 💡 Dual Content Types
- **Mistakes (❌)**: Traditional error corrections
- **Expressions (💡)**: Learn better ways to express ideas
- **Type-Specific UI**: Customized prompts and labels for each content type

## Features

### 🎯 Core Functionality
- **Mistake Entry**: Add individual mistakes or batch import multiple items
- **Flashcard Review**: Interactive flashcard system with error→correct→explanation workflow
- **Spaced Repetition**: Behavior-driven scheduling based on actual review performance
- **Progress Tracking**: Enhanced dashboard with Daily Target progress and backlog stats
- **Calendar View**: Visual overview of upcoming review sessions
- **Mistake Library**: Browse, search, and manage all stored mistakes
- **Settings**: Configure your Daily Target and preferences

### 📊 Dashboard & Analytics
- Today's review count and completion status
- Total mistakes, learned vs. in-progress statistics
- Learning streak tracking
- Recent activity overview

### 🗓️ Spaced Repetition Algorithm
The app uses a simplified version of the Ebbinghaus forgetting curve:
- Day 0: Initial review (same day)
- Day 3: First follow-up
- Day 7: Second follow-up
- Day 14: Third follow-up
- Day 30: Final review

If a mistake is marked as "learned", it progresses to the next stage. If marked as "needs more practice", it resets to Day 0.

## Tech Stack

- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes + Supabase (PostgreSQL)
- **Database**: Supabase (hosted PostgreSQL)
- **Date Handling**: date-fns

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier available)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/my-english-tool.git
cd my-english-tool
```

2. Install dependencies:
```bash
npm install
```

3. Configure Supabase credentials by creating a `.env.local` file:
```bash
cp .env.example .env.local
```

Fill in the following variables using your Supabase project settings:
```env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

4. **Execute Database Migrations** (Important for v2.0):

Go to your Supabase Dashboard → SQL Editor, and run these migrations in order:
- `migrations/v2.0-add-content-type-and-last-reviewed.sql`
- `migrations/v2.0-add-user-settings.sql`
- `migrations/v2.1-remove-mistake-type.sql`

See `migrations/README.md` for detailed instructions.

5. Start the development server:
```bash
npm run dev
```

6. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Adding Content

1. **Mistakes (❌)**:
   - Click "Add Mistake" on the dashboard
   - Choose "Mistake" type
   - Enter error sentence, correct sentence, and explanation

2. **Expressions (💡)**:
   - Click "Add Expression" on the dashboard
   - Choose "Expression" type
   - Enter original expression, improved version, and why it's better

3. **Batch Import**:
   - Switch to "Batch" mode
   - Select content type (Mistake or Expression)
   - Format: `error/original | correct/improved | explanation (optional)`
   - One item per line

### Reviewing Content

1. **Daily Review**:
   - Check Dashboard for today's progress (e.g., "15/50 completed")
   - Click "Start Review" to begin
   - For each item:
     - See the error/original expression
     - Click "Show Answer" to reveal the correct version
     - Click "🔄 Need More Practice" (resets to Day 0) or "✅ Got It!" (advances)

2. **Clearing Backlog**:
   - If you have backlog items, click "Clear Backlog" on Dashboard
   - Review additional items when you have time
   - Backlog won't grow if you maintain daily practice

### Configuring Settings

- Click the "⚙️ Settings" icon on Dashboard
- Set your Daily Target: 30 / 50 / 70 / 100
- Save changes
- Your new target takes effect immediately

### Managing Content

- Browse all items in the Library
- Search and filter by type, status, or keywords
- Delete items you no longer need
- View detailed information including review history

### Calendar View

- Visual overview of upcoming review sessions
- Click on dates with reviews to see detailed lists
- Navigate between months to plan ahead

## API Endpoints

### Mistakes
- `GET /api/mistakes` - Get all mistakes (supports status + search filters)
- `POST /api/mistakes` - Create a new mistake
- `PUT /api/mistakes/[id]` - Update mistake (for review responses)
- `DELETE /api/mistakes/[id]` - Delete a mistake
- `POST /api/mistakes/batch` - Create multiple mistakes

### Dashboard
- `GET /api/dashboard` - Get dashboard statistics

### Calendar
- `GET /api/calendar` - Get calendar data and review counts

## Database Schema

```sql
create type mistake_status as enum ('unlearned', 'learned');

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  error_sentence text not null,
  correct_sentence text not null,
  explanation text,
  status mistake_status not null default 'unlearned',
  next_review_at timestamptz not null,
  review_stage integer not null default 0,
  review_count integer not null default 0,
  content_type content_type not null default 'mistake',
  last_reviewed_at timestamptz
);
```

> ℹ️ If you prefer not to create custom enum types (like `mistake_status` or `content_type`), you can use `text` columns with check constraints instead. Ensure Row Level Security is disabled or policies allow your service role key to read/write.

## Project Structure

```
english-mistake-review/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes
│   │   ├── add/               # Add mistake page
│   │   ├── calendar/          # Calendar view page
│   │   ├── library/           # Mistake library page
│   │   ├── review/            # Review session page
│   │   ├── layout.tsx         # Root layout with navigation
│   │   └── page.tsx           # Dashboard page
│   ├── components/            # Reusable components
│   │   └── Navigation.tsx     # Main navigation component
│   └── lib/                   # Utility libraries
│       ├── calendar.ts        # Calendar utilities
│       ├── database.ts        # Database connection and types
│       └── spaced-repetition.ts # Spaced repetition algorithm
├── data/                      # SQLite database (auto-created)
└── test-api.js               # API testing script
```

## Development

### Running Tests
```bash
node test-api.js
```

### Building for Production
```bash
npm run build
npm start
```

### Code Style
The project uses ESLint for code linting. Run:
```bash
npm run lint
```

## Screenshots

### Dashboard v2.0
Shows Daily Target progress, backlog count, and quick actions for both Mistakes and Expressions.

### Review Interface
Adaptive UI that changes based on content type (Mistake vs Expression).

### Settings Page
Simple configuration for Daily Target (30/50/70/100 items per day).

## Key Features Implemented

✅ **v2.0 Features:**
- ✅ Behavior-driven spaced repetition (fixed auto-progress bug)
- ✅ Daily Target system with configurable goals
- ✅ Backlog management for overdue items
- ✅ Dual content types (Mistake + Expression)
- ✅ Enhanced Dashboard with progress visualization
- ✅ Settings page for user preferences
- ✅ Type-specific UI and prompts

✅ **v1.0 Features:**
- ✅ Error entry (single + batch)
- ✅ Error storage and management
- ✅ Flashcard review interface
- ✅ Simplified Ebbinghaus forgetting curve
- ✅ Dashboard with task overview
- ✅ Calendar display for review tasks
- ✅ Search and filter functionality
- ✅ Responsive design with Tailwind CSS

## Roadmap

### v2.1 (Planned)
- [ ] Email/notification reminders for reviews
- [ ] Advanced statistics and learning analytics
- [ ] Data export functionality (CSV/JSON)
- [ ] Mobile-responsive improvements

### v3.0 (Future)
- [ ] User authentication and multi-user support
- [ ] Multiple choice quiz mode
- [ ] Audio pronunciation support
- [ ] AI-powered mistake analysis
- [ ] Mobile app version
- [ ] Integration with external learning platforms

## Version History

### v2.0 (Current) - 2025-01
**Major Update: Behavior-Driven Learning**
- ✅ Fixed core review logic (behavior-driven, not time-driven)
- ✅ Added Daily Target system with configurable goals
- ✅ Implemented Backlog management
- ✅ Added Expression content type support
- ✅ Enhanced Dashboard with progress tracking
- ✅ Created Settings page
- See `UPGRADE_TO_V2.0.md` for migration guide

### v1.0 - 2024
**Initial Release**
- Basic mistake entry and review
- Spaced repetition algorithm
- Dashboard and calendar views
- Search and filter functionality

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. Follow the existing code style (TypeScript + ESLint)
2. Test your changes thoroughly
3. Update documentation as needed
4. For major changes, open an issue first to discuss

### Reporting Issues

If you find a bug or have a feature request:
1. Check if it's already reported in [Issues](https://github.com/yourusername/my-english-tool/issues)
2. If not, create a new issue with:
   - Clear description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Screenshots if applicable

## License

MIT License - see LICENSE file for details

This project is created for educational purposes to help English learners improve their language skills through systematic mistake review.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Database powered by [Supabase](https://supabase.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Inspired by spaced repetition learning research

## Support

If you find this tool helpful, please give it a ⭐️ on GitHub!

For questions or support:
- Open an [Issue](https://github.com/yourusername/my-english-tool/issues)
- Check the [Upgrade Guide](UPGRADE_TO_V2.0.md) for v2.0 migration help
