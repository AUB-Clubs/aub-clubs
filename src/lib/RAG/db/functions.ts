import { prisma } from "@/lib/prisma";

interface MatchedDocument {
  id: string;
  content: string | null;
  similarity: number;
}

export async function matchBuildingDocuments(
  queryEmbedding: number[],
  matchThreshold: number,
  matchCount: number
): Promise<MatchedDocument[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  return prisma.$queryRaw<MatchedDocument[]>`
    SELECT
      id,
      content,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM "building_documents"
    WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${matchCount}
  `;
}

export async function matchSponsorDocuments(
  queryEmbedding: number[],
  matchThreshold: number,
  matchCount: number
): Promise<MatchedDocument[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  return prisma.$queryRaw<MatchedDocument[]>`
    SELECT
      id,
      content,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM "sponsor_documents"
    WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${matchCount}
  `;
}

export async function matchSpeakerDocuments(
  queryEmbedding: number[],
  matchThreshold: number,
  matchCount: number
): Promise<MatchedDocument[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  return prisma.$queryRaw<MatchedDocument[]>`
    SELECT
      id,
      content,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM "speaker_documents"
    WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${matchCount}
  `;
}
