import OpenAI from "openai";
import 'dotenv/config'

const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
});

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Tell me about the different roles on AI completitions"}
    ],
    model: "deepseek-chat",
  });

  console.log(completion.choices[0].message.content);
}

main();