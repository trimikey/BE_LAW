import fs from "fs";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const vectors = JSON.parse(
  fs.readFileSync("./rag/vectorStore.json", "utf8")
);

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB);
}

export async function searchLegalContext(query, topK = 3) {
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  const queryEmbedding = embeddingRes.data[0].embedding;

  const scored = vectors.map(v => ({
    ...v,
    score: cosineSimilarity(queryEmbedding, v.embedding),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
