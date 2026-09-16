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

### 007 Premium Membership
- User-scoped Premium memberships, stored in the `user_premium` table
- Three plans (prices centralized in `src/config/economy.js`):
  - **Monthly** — ₱49 / 30 days
  - **Quarterly** — ₱129 / 90 days
  - **Yearly** — ₱399 / 365 days
- Entitlement is expiration-driven: a membership is active while `expires_at` is in the future (checked on every read, no background timers)
- Renewal while active extends the entitlement from its current expiry date; renewal after expiry starts from now
- Each payment can grant Premium exactly once (idempotent activation); activation always derives plan and duration from the server-side plan catalog, never from client-supplied values
- Benefits:
  - **1.25× message XP** (XP = base × 1.25, rounded up)
  - **1.25× reputation gain**
  - **Daily Premium claim** — once per UTC day, `+100` NEXA Coins via `/premium claim`
- Commands: `/premium` with subcommands `status`, `plans`, `buy`, `payment-status`, `test-activate`, `claim`
- Payment lifecycle: `pending → paid → entitlement activated`. **Real-money payment processing is NOT connected** — set `NEXA_PAYMENT_TEST_MODE=true` to allow test activations only.

## Quaxly Deployment

**Runtime:** Node.js
**Entry point:** `src/index.js`
**Start command:** `npm start`
**Database:** SQLite (in-memory at runtime; persists via Discord snapshot backups, see `BACKUP_CHANNEL_ID`)
**Environment variables required:**
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID` (optional)
- `BACKUP_CHANNEL_ID` (optional, enables snapshot persistence)
- `NEXA_PAYMENT_TEST_MODE` (optional, `true` enables payment test mode)
- `PORT` (optional, health-check port, default `10000`)

The application automatically:
- Runs the SQLite schema migration on startup
- Seeds default quests, collectibles, and achievements
- Restores the latest `nexa_cloud.db` snapshot from the backup channel (if configured)
- Connects to Discord and registers commands
- Periodically uploads a database snapshot to the backup channel

## Wispbyte Deployment (GitHub Auto-Update)

NEXA is deployed on Wispbyte from the canonical GitHub repository using the `main` branch.

| Setting | Value |
|---------|-------|
| Repository | `https://github.com/mikkkoyy/NEXA-repository` |
| Branch | `main` |
| Runtime | Node.js |
| Startup | `npm start` |
| AUTO UPDATE | `1` |

**Environment variables** (set in the Wispbyte panel, never in the repository):

- `DISCORD_TOKEN` — required, Discord bot token
- `DISCORD_CLIENT_ID` — required, Discord application client ID
- `DISCORD_GUILD_ID` — optional, restrict slash commands to a single guild
- `BACKUP_CHANNEL_ID` — optional, text channel used to persist the SQLite snapshot
- `NEXA_PAYMENT_TEST_MODE` — optional, `true` enables payment test mode
- `PORT` — optional, health-check port (default `10000`)

Copy `.env.example` to `.env` for local development. Never commit a real `.env`; only placeholder values are allowed in `.env.example`.

**Database persistence:** NEXA runs SQLite in-memory at runtime (`:memory:`). There is no on-disk database file and nothing database-related is committed to Git (`.gitignore` excludes `*.db`, `data/`, and `*.log`). Persistence is handled by the application itself: it restores the newest `nexa_cloud.db` snapshot from `BACKUP_CHANNEL_ID` on startup and uploads a fresh snapshot every 10 minutes. Deployment updates never touch, reset, or overwrite the database.

**Dependencies / native modules:** Wispbyte must run the dependency install inside its own environment (via `package.json` + `package-lock.json`) so native modules such as `better-sqlite3` are built/downloaded for the Wispbyte platform. Do not upload the local `node_modules/` directory. Recommended Wispbyte install command: `npm ci` (or `npm install`).

**Workflow:**

```text
Local development -> git commit -> git push origin main
        -> Wispbyte auto-update pulls main (AUTO UPDATE=1)
        -> npm ci / npm install -> restart NEXA -> latest GitHub version runs
```

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
