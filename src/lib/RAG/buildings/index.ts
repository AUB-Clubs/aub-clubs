/* eslint-disable no-useless-escape */
import { openai, supabase } from '../config'
import fs from "fs"

const data: string = fs.readFileSync("./buildings.md", "utf8")

function markdownSplitter(markdownText: string) {
  const regex = /^## (.+?)(?:\n([\s\S]*?))(?=^## |\Z)/gm
  let matches
  const entities: string[] = []

  while ((matches = regex.exec(markdownText)) !== null) {
    const [, title, content] = matches

    const cleanedContent = content
      .split("\n")
      .map(line => {
        // If it's a list item (starts with "- "), leave as is
        if (/^\s*-\s/.test(line)) {
          return line.replace(/^\s{3,}/, "  ") // collapse 3+ spaces → 2 spaces
        }
        return line.trimEnd() // just strip trailing spaces
      })
      .join("\n")

    entities.push(`${title}:\n${cleanedContent}`)
  }

  return entities
}


function splitDocument(data: string) {
  const spilt_data = markdownSplitter(data)
  return spilt_data
}

/* Create an embedding from each text chunk.
Store all embeddings and corresponding text in Supabase. */
async function createAndStoreEmbeddings() {
  const chunkData = splitDocument(data)
  console.log(chunkData)
  const finalData = await Promise.all(chunkData.map(async (d) => {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small", 
      input: d,
    })
    
    return {
      content: d,
      embedding: embedding.data[0].embedding
    }
  }))
  console.log(finalData)
  console.log("Saving to DB")
  console.log( await supabase.from("buildings").insert(finalData))
}

await createAndStoreEmbeddings()
console.log("done")
