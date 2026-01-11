# Predictions App - SvelteKit Edition

Modern rewrite of the Predictions application using SvelteKit, TypeScript, and SQLite.

## Quick Start

### 1. Install Dependencies

```bash
cd app
npm install
```

### 2. Set up the Database

```bash
# Generate the database schema
npm run db:push
```

This will create `predictions.db` in the app directory.

### 3. Start Development Server

```bash
npm run dev
```

Visit http://localhost:5173

## Project Structure

```
app/
├── src/
│   ├── lib/
│   │   ├── db/                 # Database (Drizzle ORM)
│   │   │   ├── schema.ts       # Database schema
│   │   │   ├── index.ts        # DB connection
│   │   │   └── migrations/     # SQL migrations
│   │   ├── server/             # Server-only code
│   │   │   └── auth.ts         # Authentication
│   │   ├── components/         # Reusable Svelte components
│   │   └── utils/              # Utilities
│   │
│   ├── routes/                 # Pages & API routes
│   │   ├── (auth)/             # Auth pages (login, register)
│   │   ├── +layout.svelte      # Root layout
│   │   ├── +page.svelte        # Homepage
│   │   └── +page.server.ts     # Server load function
│   │
│   ├── hooks.server.ts         # Server hooks (auth middleware)
│   ├── app.html                # HTML template
│   ├── app.css                 # Global styles (Tailwind)
│   └── app.d.ts                # TypeScript types
│
├── static/                     # Static assets
├── drizzle.config.ts           # Drizzle configuration
├── svelte.config.js            # SvelteKit config
├── tailwind.config.js          # Tailwind CSS config
└── package.json
```

## Technology Stack

- **Framework**: SvelteKit 2.x
- **Language**: TypeScript
- **Database**: SQLite (via better-sqlite3)
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS
- **Authentication**: Custom (bcrypt + cookies)

## Features Implemented

### ✅ Phase 1: Foundation
- [x] SvelteKit project setup
- [x] TypeScript configuration
- [x] Tailwind CSS
- [x] Database schema (Drizzle ORM)
- [x] Authentication system
  - [x] Password hashing (bcrypt)
  - [x] Login page
  - [x] Registration page
  - [x] Session management
  - [x] Auth middleware

### 🚧 Phase 2: Coming Next
- [ ] Group management
- [ ] Game creation & management
- [ ] Predictions submission
- [ ] Leaderboards
- [ ] Email notifications
- [ ] SMS integration (Twilio)
- [ ] Data migration from old SQLite DB

## Database Schema

The new schema improves on the original:

### Key Improvements
1. **Security**: Passwords are hashed with bcrypt
2. **Timestamps**: All tables have created/updated timestamps
3. **Constraints**: Unique constraints prevent duplicate predictions
4. **Indexes**: Better query performance
5. **Soft Deletes**: Can mark users as deleted without losing data
6. **Structured Data**: Odds stored as separate fields, not HTML

### Tables
- `users` - User accounts (replaces `people`)
- `groups` - Groups/leagues (replaces `groupplay`)
- `memberships` - User group memberships
- `games` - Football games
- `group_games` - Which games belong to which groups
- `predictions` - User predictions
- `in_game_scores` - Live score updates & commentary

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Database commands
npm run db:generate   # Generate migration SQL
npm run db:push       # Push schema to database
npm run db:studio     # Open Drizzle Studio (GUI)
```

## Authentication

### How it Works

1. **Registration**: `/register`
   - User provides name, email, password
   - Password is hashed with bcrypt
   - Session created and stored in cookie

2. **Login**: `/login`
   - User provides email & password
   - Password verified against hash
   - Session created

3. **Session Management**:
   - Session token stored in HTTP-only cookie
   - `hooks.server.ts` checks auth on every request
   - User info added to `event.locals.user`

4. **Logout**: `/logout`
   - Session cookie deleted
   - Redirects to login

### Accessing Current User

In any server file (+page.server.ts, +server.ts):
```typescript
export const load = async ({ locals }) => {
  const user = locals.user;  // User object or undefined
  // ...
};
```

In Svelte components:
```svelte
<script lang="ts">
  export let data;
  const user = data.user;  // From page data
</script>

{#if user}
  Welcome, {user.name}!
{/if}
```

## Next Steps

### 1. Create Your First User

Visit http://localhost:5173/register and create an account.

### 2. Explore the Database

```bash
npm run db:studio
```

This opens Drizzle Studio in your browser to view/edit data.

### 3. Build Features

Follow the [MIGRATION_PLAN.md](../MIGRATION_PLAN.md) to add:
- Group management
- Game creation
- Predictions
- Leaderboards

## Migrating Data from Old App

A migration script will be provided to:
1. Read data from `../predictions.sqlite`
2. Hash existing passwords
3. Map old schema to new schema
4. Import into new database

## Production Deployment

### Building

```bash
npm run build
```

This creates a `build/` directory with the production app.

### Running

```bash
node build
```

Or use a process manager:
```bash
npm install -g pm2
pm2 start build/index.js --name predictions-app
```

### Environment Variables

Create `.env` for production:
```bash
NODE_ENV=production
DATABASE_URL=file:./predictions.db
```

## Troubleshooting

### Database Issues

If you need to reset the database:
```bash
rm predictions.db
npm run db:push
```

### Type Errors

Regenerate types:
```bash
npm run check
```

### Port Already in Use

Change the dev port:
```bash
npm run dev -- --port 3000
```

## Contributing

This is a migration from the legacy Python app. See:
- [MIGRATION_PLAN.md](../MIGRATION_PLAN.md) - Full migration roadmap
- [DATABASE_ANALYSIS.md](../DATABASE_ANALYSIS.md) - Schema improvements
- [SVELTEKIT_DETAILED.md](../SVELTEKIT_DETAILED.md) - SvelteKit guide

## License

Same as the original Predictions app.
