/* eslint-disable no-useless-escape */
import { openai } from '../config';
import { prisma } from '@/lib/prisma';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data: string = fs.readFileSync(path.join(__dirname, "speakers.md"), "utf8");

function markdownSplitter(markdownText: string) {
  const regex = /^## (.+?)(?:\n([\s\S]*?))(?=^## |\Z)/gm;
  let matches;
  const entities: string[] = [];

  while ((matches = regex.exec(markdownText)) !== null) {
    const [, title, content] = matches;

    const cleanedContent = content
      .split("\n")
      .map(line => {
        if (/^\s*-\s/.test(line)) {
          return line.replace(/^\s{3,}/, "  ");
        }
        return line.trimEnd();
      })
      .join("\n");

    entities.push(`${title}:\n${cleanedContent}`);
  }

  return entities;
}

function splitDocument(data: string) {
  return markdownSplitter(data);
}

async function createAndStoreEmbeddings() {
  const chunkData = splitDocument(data);
  console.log(chunkData);

  const finalData = await Promise.all(chunkData.map(async (d) => {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: d,
    });

    return {
      content: d,
      embedding: embedding.data[0].embedding,
    };
  }));

  console.log("Saving to DB");

  for (const row of finalData) {
    const embeddingStr = `[${row.embedding.join(",")}]`;
    await prisma.$executeRaw`
      INSERT INTO "speaker_documents" (id, content, embedding)
      VALUES (${crypto.randomUUID()}, ${row.content}, ${embeddingStr}::vector)
    `;
  }

  console.log("Inserted to speaker_documents");
}

await createAndStoreEmbeddings();
console.log("done");
