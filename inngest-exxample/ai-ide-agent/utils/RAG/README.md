# RAG (Retrieval-Augmented Generation)

Embeddings-based retrieval system for the AI IDE agent. Provides two knowledge sources:

1. **Examples** — Go plugin project code from `cmd/script/go_plugin/plugins`
2. **Go Plugin Docs** — Documentation from `docs.md` and `SCRIPTING_GUIDE.md`

## Directory Structure

```
RAG/
├── scripts/
│   └── update_pipeline.sh    # Main pipeline entry point
├── Examples/
│   ├── index.ts               # Embedding generation + diff detection for examples
│   ├── rag-utils.ts           # findNearestMatchingProject() — query function
│   └── data/
│       ├── plugin-projects.json       # Generated from source plugin files
│       ├── descriptions.json          # Project descriptions (manual)
│       ├── update_plugin_projects.sh  # Regenerates plugin-projects.json
│       └── examples_embeddings.csv    # Generated embeddings (gitignored)
├── Go Plugin Docs/
│   ├── index.ts               # Embedding generation + diff detection for docs
│   ├── rag-utils.ts           # findNearestMatchGoPluginDocs() — query function
│   └── data/
│       ├── docs.md                    # Go plugin overview documentation
│       ├── SCRIPTING_GUIDE.md         # Scripting guide documentation
│       ├── docs_embeddings.csv        # Generated embeddings (gitignored)
│       └── docs_hashes.json           # SHA256 hashes for diff detection (gitignored)
├── db/
│   ├── functions.ts           # Prisma DB functions (create, match, query)
│   └── clean.ts               # Delete all embedding data from DB
├── config.ts                  # OpenAI client config
└── utils.ts                   # Shared embedding creation helper
```

## Usage

### Update Pipeline

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."

# CSV-only mode: detect diffs, regenerate only changed embeddings, update CSV
./scripts/update_pipeline.sh

# DB mode: also clean DB and publish CSV data to PostgreSQL
./scripts/update_pipeline.sh -db
```

### How It Works

**Without `-db`** (default):
1. Regenerates `plugin-projects.json` from source Go files
2. Compares current project files against the CSV to detect new/modified/removed projects
3. Regenerates embeddings **only for changed projects** (saves OpenAI API calls)
4. Compares doc file hashes — if any doc changed, regenerates **all** doc embeddings (chunk overlap makes partial updates unreliable)
5. Updates CSV files with new embeddings

**With `-db`**:
- Runs all the above steps first
- Then cleans all embedding data from the database
- Publishes the full CSV contents to PostgreSQL via Prisma

### Individual Scripts

```bash
# Regenerate example embeddings for specific projects only
cd Examples && npx tsx index.ts --projects=charging,noop

# Force regenerate all doc embeddings regardless of diffs
cd "Go Plugin Docs" && npx tsx index.ts --force

# Publish existing CSV data to DB (no embedding regeneration)
cd Examples && npx tsx index.ts --db
cd "Go Plugin Docs" && npx tsx index.ts --db

# Clean all embedding data from DB
cd db && npx tsx clean.ts
```

## Query Functions

Used by the AI IDE agent at runtime:

```typescript
// Find the nearest matching project example for a query
import { findNearestMatchingProject } from './Examples/rag-utils.ts'
const match = await findNearestMatchingProject(queryEmbedding)
// Returns: { project_description, files: Record<string, string> }

// Find relevant Go plugin documentation chunks
import { findNearestMatchGoPluginDocs } from './Go Plugin Docs/rag-utils.ts'
const docs = await findNearestMatchGoPluginDocs(queryEmbedding)
// Returns: string (concatenated matching doc chunks)
```

## Requirements

- **OpenAI API key** — for generating embeddings (`text-embedding-3-large`, 3072 dimensions)
- **PostgreSQL with pgvector** — for vector similarity search (only needed with `-db` or at query time)
- **Node.js + tsx** — for running TypeScript scripts
