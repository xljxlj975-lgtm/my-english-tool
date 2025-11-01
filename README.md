# English Mistake Review Tool

A web application designed to help English learners systematically review and master their common mistakes using spaced repetition learning.

## Features

### 🎯 Core Functionality
- **Mistake Entry**: Add individual mistakes or batch import multiple mistakes
- **Flashcard Review**: Interactive flashcard system with error→correct→explanation workflow
- **Spaced Repetition**: Automatic scheduling based on simplified Ebbinghaus forgetting curve
- **Progress Tracking**: Dashboard with statistics and learning metrics
- **Calendar View**: Visual overview of upcoming review sessions
- **Mistake Library**: Browse, search, and manage all stored mistakes

### 📊 Dashboard & Analytics
- Today's review count and completion status
- Total mistakes, learned vs. in-progress statistics
- Learning streak tracking
- Mistakes categorized by type (grammar, vocabulary, collocation, etc.)
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

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd english-mistake-review
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
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Adding Mistakes

1. **Single Entry**: Go to "Add Mistake" and fill in the form
2. **Batch Entry**: Use the batch mode to import multiple mistakes at once
   - Format: `error sentence | correct sentence | explanation (optional)`
   - One mistake per line

### Reviewing Mistakes

1. Check the dashboard for today's review count
2. Click "Start Review" to begin the flashcard session
3. Review each mistake and mark as "Learned" or "Needs More Practice"
4. Track your progress with the built-in progress bar

### Managing Mistakes

- Browse all mistakes in the Library
- Search and filter by type, status, or keywords
- Delete mistakes you no longer need
- View detailed information including review history

### Calendar View

- Visual overview of upcoming review sessions
- Click on dates with reviews to see detailed mistake lists
- Navigate between months to plan ahead

## API Endpoints

### Mistakes
- `GET /api/mistakes` - Get all mistakes (with optional filters)
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
create type mistake_type as enum ('grammar', 'vocabulary', 'collocation', 'tense', 'pronunciation', 'uncategorized');
create type mistake_status as enum ('unlearned', 'learned');

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  error_sentence text not null,
  correct_sentence text not null,
  explanation text,
  type mistake_type not null default 'uncategorized',
  status mistake_status not null default 'unlearned',
  next_review_at timestamptz not null,
  review_stage integer not null default 0,
  review_count integer not null default 0
);
```

> ℹ️ If you prefer not to create custom enum types, you can use `text` columns with check constraints instead. Ensure Row Level Security is disabled or policies allow your service role key to read/write.

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

## Key Features Implemented

✅ **MVP 1.0 Features:**
- ✅ Error entry (single + batch)
- ✅ Error storage and management
- ✅ Flashcard review interface
- ✅ Memory curve scheduling (simplified Ebbinghaus)
- ✅ Dashboard with task overview
- ✅ Calendar display for review tasks
- ✅ Search and filter functionality
- ✅ Responsive design with Tailwind CSS

## Future Enhancements

Potential features for future versions:
- Email/notification reminders
- Advanced statistics and charts
- Multiple choice quiz mode
- Data export functionality
- User authentication
- Mobile app version
- Audio pronunciation support
- Integration with external learning platforms

## License

This project is created for educational purposes to help English learners improve their language skills through systematic mistake review.

## Contributing

Feel free to submit issues and enhancement requests!
