# Step Zero

A local, single-user pre-PR code review tool for engineers working with AI coding assistants. Review AI-generated changes in a GitHub-like diff interface, leave line-level comments, dispatch them to AI tools for resolution, and iterate through review rounds before creating a real PR.

## Install

```bash
# Clone and install dependencies
git clone <repo-url> && cd step-zero
bun install

# Install the `step-zero` CLI globally
npm link
```

Once linked, `step-zero` is available from any directory on your system.

## Quick Start

From any git repository:

```bash
# Start a review of the current branch vs main
step-zero review

# Review against a specific base branch
step-zero review --base develop

# Check status of all reviews
step-zero status
```

Or run locally without global install:

```bash
bun run step-zero review
bun run step-zero status
```

## How It Works

Step Zero sits between your AI coding tool and GitHub, giving you a structured review loop:

```
1. AI writes code on a branch
2. You run `step-zero review` to start a review session
3. Step Zero shows a full diff viewer (split or unified) with file tree
4. You leave line-level comments on the diff
5. "Send to AI" dispatches your comments + diff context to Claude Code, Codex, or a custom tool
6. AI applies fixes, you re-review — repeat until satisfied
7. "Approve" creates a GitHub PR via `gh` CLI
```

## Features

- **Git-native** — works with your existing branches and commits, no special workflow required
- **Split + unified diff views** — toggle between GitHub-style split view and traditional unified view
- **Word-level diff highlighting** — inline token-level change highlighting within modified lines
- **Line-level comments** — click any line to leave a comment, threaded conversations with resolve/unresolve
- **AI dispatch** — send review comments (with surrounding diff context) to Claude Code, Codex, or custom CLI tools
- **Multiple review rounds** — iterate through rounds, track what changed between dispatches
- **File tree with search** — directory-grouped, filterable, with viewed checkboxes
- **Markdown in comments** — full GFM support (code blocks, links, lists, etc.)
- **Edit/delete comments** — modify or remove your comments after posting
- **Binary file detection** — graceful handling of non-text files
- **Keyboard shortcuts** — navigate files, toggle views, all without touching the mouse
- **GitHub PR creation** — approve and create a PR directly via `gh` CLI
- **Dark-first design** — engineering cockpit aesthetic, easy on the eyes

## Keyboard Shortcuts

| Key | Action            |
| --- | ----------------- |
| `j` | Next file         |
| `k` | Previous file     |
| `s` | Split diff view   |
| `u` | Unified diff view |

Shortcuts are disabled when typing in text inputs or textareas.

## CLI Reference

```
step-zero review [options]     Start a new review session
  --base <branch>        Base branch to diff against (default: main)
  --title <title>        Review session title

step-zero status               List all review sessions with their status

step-zero config               Show current configuration
  --set <key=value>      Set a configuration value
```

## AI Tool Configuration

Step Zero can dispatch review comments to different AI tools. Configure via the web UI or CLI:

| Tool            | How it works                                                   |
| --------------- | -------------------------------------------------------------- |
| **Claude Code** | Invokes `claude` CLI with comments as prompt + diff context    |
| **Codex**       | Invokes `codex` CLI with comments as prompt + diff context     |
| **Custom**      | Runs any CLI command you configure, passing comments via stdin |

The dispatch payload includes:

- All unresolved comment threads
- The surrounding diff context for each comment
- File paths and line numbers

## Architecture

```
src/
  app/                      # Next.js App Router pages + API routes
    api/reviews/            # REST API for reviews, comments, threads, dispatch, approve
    review/[id]/            # Review detail page
    page.tsx                # Dashboard
  components/
    review/                 # ReviewHeader, ReviewActions
    diff-viewer/            # DiffViewer (split+unified), FileTree, CommentThread
    ui/                     # shadcn/ui components (base-nova style)
  lib/
    db.ts                   # SQLite database init + migrations
    store.ts                # Data access layer (reviews, comments, threads)
    git.ts                  # Git operations via simple-git
    diff-parser.ts          # Unified diff parser (with binary detection, rename support)
    ai-dispatcher.ts        # AI tool dispatch adapters
    utils.ts                # Shared utilities (cn, timeAgo)
  types/
    index.ts                # TypeScript type definitions
  cli/
    index.ts                # CLI entry point
    commands/               # review, status, config commands
bin/
  step-zero                 # CLI executable
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (base-nova style with @base-ui/react)
- **Database**: SQLite via bun:sqlite
- **Git**: simple-git
- **Fonts**: DM Sans (UI), JetBrains Mono (code)
- **Runtime**: Bun

## Data Storage

All data is stored locally in a `.step-zero/` directory at the project root:

- `.step-zero/reviews.db` — SQLite database with reviews, comments, threads
- No external services, no accounts, no telemetry

Existing `.itl/` data directories are still recognized automatically.

## API Routes

| Method | Route                                    | Description                      |
| ------ | ---------------------------------------- | -------------------------------- |
| GET    | `/api/reviews`                           | List all review sessions         |
| POST   | `/api/reviews`                           | Create a new review session      |
| GET    | `/api/reviews/[id]`                      | Get review session details       |
| PATCH  | `/api/reviews/[id]`                      | Update review session            |
| DELETE | `/api/reviews/[id]`                      | Delete review session            |
| GET    | `/api/reviews/[id]/diff`                 | Get parsed diff for a review     |
| POST   | `/api/reviews/[id]/comments`             | Add a comment                    |
| PATCH  | `/api/reviews/[id]/comments/[commentId]` | Edit a comment                   |
| DELETE | `/api/reviews/[id]/comments/[commentId]` | Delete a comment                 |
| POST   | `/api/reviews/[id]/threads`              | Create a comment thread          |
| PATCH  | `/api/reviews/[id]/threads/[threadId]`   | Resolve/unresolve a thread       |
| POST   | `/api/reviews/[id]/dispatch`             | Dispatch comments to AI tool     |
| POST   | `/api/reviews/[id]/approve`              | Approve and optionally create PR |

## Development

```bash
# Start dev server
bun dev

# Build for production
bun run build

# Run CLI commands
bun run step-zero review
bun run step-zero status
bun run step-zero config
```

## Requirements

- [Bun](https://bun.sh/) v1.0+
- [Git](https://git-scm.com/) installed and available in PATH
- [GitHub CLI](https://cli.github.com/) (`gh`) — required only for PR creation
- One of: [Claude Code](https://claude.ai/code), [Codex](https://openai.com/codex), or a custom CLI tool — required only for AI dispatch
