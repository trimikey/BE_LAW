import OpenAI from "openai";
import { searchLegalContext } from "../rag/search.js";
import { LEGAL_ASSISTANT_PROMPT } from "../prompts/legalAssistant.prompt.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const chatWithAI = async ({ message }) => {
  const legalContexts = await searchLegalContext(message);

  const lawContextText = legalContexts
    .map(
      (c, i) =>
        `(${i + 1}) Trích từ ${c.source}:\n${c.text}`
    )
    .join("\n\n");

  // 2️⃣ Build prompt có RAG
  const messages = [
    {
      role: "system",
      content: LEGAL_ASSISTANT_PROMPT,
    },
    {
      role: "system",
      content: `
DƯỚI ĐÂY LÀ NGỮ CẢNH PHÁP LUẬT LIÊN QUAN.
CHỈ DÙNG THÔNG TIN NÀY ĐỂ TRẢ LỜI.
NẾU KHÔNG CÓ → NÓI KHÔNG ĐỦ CƠ SỞ.

${lawContextText}
      `,
    },
    {
      role: "user",
      content: message,
    },
  ];

  // 3️⃣ Gọi GPT
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.1,
  });

  return completion.choices[0].message.content;
};
