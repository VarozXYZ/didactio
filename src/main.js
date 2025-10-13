import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const syllabusSchema = {
  type: 'object',
  properties: {
    topic: { type: 'string'},
    title: { type: 'string' },
    keywords: { type: 'string'},
    description: { type: 'string' },
    total_duration_hours: { type: 'number' },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          overview: { type: 'string' },
          estimated_duration_hours: { type: 'number' },
          lessons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                content_outline: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['title', 'content_outline']
            }
          }
        },
        required: ['title', 'lessons']
      }
    }
  },
  required: [
    'topic',
    'title',
    'keywords',
    'description',
    'total_duration_hours',
    'modules'
  ]
};

const topic = "Prompt engineering"
const level = "beginner"
const num_lessons = 4;
const hours = 10;

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: (
          `You are a curriculum designer. RETURN ONLY a single valid JSON object that exactly matches the provided JSON schema. ` +
          `DO NOT output any explanations, commentary, <think> blocks, citations, or text outside the JSON. ` +
          `Do not include markdown, code fences, or any other content.\n\n` +
          `Beware of unrealistic hour estimations, try to be realistic to the time expected for a student to learn about this particular topic` +
          `JSON schema (strictly follow types, required fields, and structure; no extra keys):\n` +
          `${JSON.stringify(syllabusSchema, null, 2)}`
        ),
      },
      {
        role: 'user',
        content: `Create a complete syllabus on the following topic: ${topic}. The students have the following level: ${level}. For that reason, the syllabus must have at least ${num_modules} lessons and the maximum duration must be less than ${hours}`
      }
    ],
    model: "deepseek-reasoner",
    response_format: { type: 'json_object' }
  });

  console.log(completion.choices[0].message.content);
}

main();
