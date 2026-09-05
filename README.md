# NEXA_nodejs

Node.js migration of the NEXA Discord bot. The Go version remains the reference implementation at `D:\FILES\project\NEXA`.

## Requirements

- Node.js 18+ (for native fetch and test runner)
- npm

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```env
DISCORD_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_GUILD_ID=  # optional, for guild-scoped commands
```

**Never commit `.env` files containing real tokens.** Use your hosting platform's secure environment configuration (e.g., Quaxly environment variables).

## Start

```bash
npm start
```

## Test

```bash
npm test
```

## Features

### 001 Discord Foundation
- Discord Gateway connection
- Slash command registration
- NEXA presence
- Graceful shutdown (SIGINT/SIGTERM)

### 002 Identity + XP
- SQLite persistence with WAL mode
- Member profiles with XP, levels, reputation
- 2 XP per eligible message (60s cooldown)
- `/profile` command

### 002A Message Activity Fix
- DM/bot filtering
- First-seen tracking

### 003 Quest Engine
- Quest definitions seeded per guild
- Progress tracking per member
- Quest rewards (XP + collectibles)
- `/quests`, `/quest` commands

### 004 Collectibles
- Collectible definitions and ownership
- Quest-reward integration
- `/collectibles`, `/collectible` commands

### 005 Achievements
- Achievement definitions and progress
- Achievement rewards (XP)
- `/achievements`, `/achievement` commands

### 006 Economy
- NEXA Coin currency
- Wallet/balance system
- Transaction ledger
- `/balance` command

## Quaxly Deployment

**Runtime:** Node.js
**Entry point:** `src/index.js`
**Start command:** `npm start`
**Database:** SQLite (auto-created)
**Environment variables required:**
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID` (optional)

The application automatically:
- Creates the `data/` directory if missing
- Initializes the SQLite database with all required tables
- Seeds default quests, collectibles, and achievements
- Connects to Discord and registers commands

## Milestones

| Milestone | Status |
|-----------|--------|
| 001 Discord Foundation | Complete |
| 002 Identity + XP | Complete |
| 002A Message Activity Fix | Complete |
| 003 Quest Engine | Complete |
| 004 Collectibles | Complete |
| 005 Achievements | Complete |
| 006 Economy | Complete |
