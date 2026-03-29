import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const LAW_DIR = "./rag/laws";
const OUTPUT = "./rag/vectorStore.json";

async function embedText(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

async function buildVectorStore() {
  const files = fs.readdirSync(LAW_DIR);
  const vectors = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(LAW_DIR, file), "utf8");

    const chunks = content.match(/(.|\n){1,800}/g); // chia nhỏ

    for (const chunk of chunks) {
      const embedding = await embedText(chunk);
      vectors.push({
        text: chunk,
        embedding,
        source: file,
      });
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(vectors, null, 2));
  console.log("✅ Embedded legal documents successfully");
}

buildVectorStore();
