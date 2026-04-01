package main

import (
	"ai_ide_gql/graph"
	"database/sql"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/rs/cors"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	_ "github.com/joho/godotenv/autoload"
	"github.com/vektah/gqlparser/v2/ast"
)

func main() {
	port := os.Getenv("AI_IDE_GQL_PORT")
	if port == "" {
		port = "10100"
	}

	// Base path for the GraphQL endpoints (e.g., "/api/ai-ide" when behind ingress)
	basePath := strings.TrimSuffix(os.Getenv("AI_IDE_GQL_BASE_PATH"), "/")

	url := os.Getenv("AI_IDE_DB_URL")

	var aiIdeDB *sql.DB
	var err error
	var i int

	for aiIdeDB, err = graph.ConnectAIIDEDatabase(url); err != nil && i < 10; i++ {
		log.Printf("failed to connect to AI IDE database: %v", err)
		time.Sleep(2 * time.Second)
		aiIdeDB, err = graph.ConnectAIIDEDatabase(url)
	}

	if err != nil && i == 10 {
		log.Fatalf("could not connect to AI IDE database: %v", err)
	}

	i = 0
	for err = setupDB(aiIdeDB); err != nil && i < 10; i++ {
		log.Printf("failed to setup AI IDE database: %v", err)
		time.Sleep(2 * time.Second)
		err = setupDB(aiIdeDB)
	}

	if err != nil && i == 10 {
		log.Fatalf("could not setup AI IDE database: %v", err)
	}

	resolver := graph.NewResolver(
		aiIdeDB,
	)

	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolver}))

	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})

	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))

	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})

	// Setup routes with configurable base path
	playgroundPath := basePath + "/"
	queryPath := basePath + "/query"

	http.Handle(playgroundPath, playground.Handler("GraphQL playground", queryPath))
	http.Handle(queryPath, srv)

	// Also handle root paths for backward compatibility (local dev)
	if basePath != "" {
		http.Handle("/", playground.Handler("GraphQL playground", "/query"))
		http.Handle("/query", srv)
	}

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization", "X-Requested-With"},
	})

	log.Printf("connect to http://localhost:%s/ for GraphQL playground", port)
	log.Fatal(http.ListenAndServe(":"+port, c.Handler(http.DefaultServeMux)))
}

func setupDB(aiIdeDB *sql.DB) error {
	_, err := aiIdeDB.Exec(createAIIDETableSQL)
	return err
}

const createAIIDETableSQL = `
-- =========================
-- ENUMS
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectType') THEN
        CREATE TYPE "public"."ProjectType" AS ENUM ('PROVISIONING', 'NORMAL', 'UNSET');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageRole') THEN
        CREATE TYPE "public"."MessageRole" AS ENUM ('USER', 'ASSISTANT');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageType') THEN
        CREATE TYPE "public"."MessageType" AS ENUM ('RESULT', 'ERROR');
    END IF;
END$$;

-- =========================
-- TABLES
-- =========================
CREATE TABLE IF NOT EXISTS "public"."AIIDEMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" "public"."MessageRole" NOT NULL,
    "type" "public"."MessageType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "AIIDEMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."AIIDEMessageChunk" (
    "id" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "messageId" TEXT NOT NULL,
    CONSTRAINT "AIIDEMessageChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."AIIDEFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "AIIDEFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."AIIDEProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scriptName" TEXT,
	"scriptDescription" TEXT,
	"isAIProject" BOOLEAN NOT NULL DEFAULT FALSE,
    "isAwaitingScriptActivation" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectType" "public"."ProjectType" NOT NULL DEFAULT 'UNSET',
    CONSTRAINT "AIIDEProject_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'AIIDEProject' 
        AND column_name = 'isAwaitingScriptActivation'
    ) THEN
        ALTER TABLE "public"."AIIDEProject" ADD COLUMN "isAwaitingScriptActivation" BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "public"."AIIDEAIScript" (
    "id" TEXT NOT NULL,
    "scriptConfigId" TEXT NOT NULL,
    "created" BIGINT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "AIIDEAIScript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."AIIDEAgentStep" (
    "id" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepStatus" TEXT NOT NULL,
    "stepOutput" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "runId" TEXT NOT NULL,

    CONSTRAINT "AIIDEAgentStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."AIIDEAgentRun" (
    "id" TEXT NOT NULL,
    "runStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "AIIDEAgentRun_pkey" PRIMARY KEY ("id")
);

-- =========================
-- FOREIGN KEYS
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AIIDEMessage_projectId_fkey'
    ) THEN
        ALTER TABLE "public"."AIIDEMessage"
        ADD CONSTRAINT "AIIDEMessage_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "public"."AIIDEProject"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AIIDEMessageChunk_messageId_fkey'
    ) THEN
        ALTER TABLE "public"."AIIDEMessageChunk"
        ADD CONSTRAINT "AIIDEMessageChunk_messageId_fkey"
        FOREIGN KEY ("messageId") REFERENCES "public"."AIIDEMessage"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AIIDEFile_projectId_fkey'
    ) THEN
        ALTER TABLE "public"."AIIDEFile"
        ADD CONSTRAINT "AIIDEFile_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "public"."AIIDEProject"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AIIDEAIScript_projectId_fkey'
    ) THEN
        ALTER TABLE "public"."AIIDEAIScript"
        ADD CONSTRAINT "AIIDEAIScript_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "public"."AIIDEProject"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AIIDEAgentStep_runId_fkey'
    ) THEN
        ALTER TABLE "public"."AIIDEAgentStep" ADD CONSTRAINT "AIIDEAgentStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."AIIDEAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'AIIDEAgentRun_projectId_fkey'
    ) THEN
        ALTER TABLE "public"."AIIDEAgentRun" ADD CONSTRAINT "AIIDEAgentRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."AIIDEProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- =========================
-- INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS "AIIDEMessage_projectId_idx" ON "public"."AIIDEMessage"("projectId");
CREATE INDEX IF NOT EXISTS "AIIDEMessageChunk_messageId_idx" ON "public"."AIIDEMessageChunk"("messageId");

CREATE INDEX IF NOT EXISTS "AIIDEAgentStep_runId_idx" ON "public"."AIIDEAgentStep"("runId");
CREATE INDEX IF NOT EXISTS "AIIDEAgentRun_projectId_idx" ON "public"."AIIDEAgentRun"("projectId");
CREATE INDEX IF NOT EXISTS "AIIDEAIScript_projectId_idx" ON "public"."AIIDEAIScript"("projectId");
CREATE INDEX IF NOT EXISTS "AIIDEFile_projectId_idx" ON "public"."AIIDEFile"("projectId");

-- =========================
-- PGVECTOR EXTENSION
-- =========================
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================
-- EMBEDDING TABLES
-- =========================
CREATE TABLE IF NOT EXISTS "public"."EmbeddingProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."EmbeddingFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."EmbeddingExample" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "codeChunk" TEXT,
    "vector" vector(3072),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingExample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."GoPluginDoc" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "embedding" vector(3072),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoPluginDoc_pkey" PRIMARY KEY ("id")
);

-- =========================
-- EMBEDDING INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS "EmbeddingFile_projectId_idx" ON "public"."EmbeddingFile"("projectId");
CREATE INDEX IF NOT EXISTS "EmbeddingExample_projectId_idx" ON "public"."EmbeddingExample"("projectId");
CREATE INDEX IF NOT EXISTS "EmbeddingExample_fileId_idx" ON "public"."EmbeddingExample"("fileId");

-- =========================
-- EMBEDDING FOREIGN KEYS
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'EmbeddingFile_projectId_fkey'
    ) THEN
        ALTER TABLE "public"."EmbeddingFile" ADD CONSTRAINT "EmbeddingFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."EmbeddingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'EmbeddingExample_projectId_fkey'
    ) THEN
        ALTER TABLE "public"."EmbeddingExample" ADD CONSTRAINT "EmbeddingExample_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."EmbeddingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'EmbeddingExample_fileId_fkey'
    ) THEN
        ALTER TABLE "public"."EmbeddingExample" ADD CONSTRAINT "EmbeddingExample_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."EmbeddingFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;
`
