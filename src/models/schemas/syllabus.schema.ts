export const syllabusSchema = {
  type: "object",
  properties: {
    topic: { type: "string" },
    title: { type: "string" },
    keywords: { type: "string" },
    description: { type: "string" },
    total_duration_minutes: { type: "number" },
    modules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          overview: { type: "string" },
          estimated_duration_minutes: { type: "number" },
          lessons: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                content_outline: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["title", "content_outline"],
            },
          },
        },
        required: ["title", "lessons"],
      },
    },
  },
  required: [
    "topic",
    "title",
    "keywords",
    "description",
    "total_duration_minutes",
    "modules",
  ],
};

export interface Lesson {
  title: string;
  content_outline: string[];
  content?: string;
}

export interface Module {
  title: string;
  overview?: string;
  estimated_duration_minutes?: number;
  lessons: Lesson[];
  content?: string;
  summary?: string;
}

export interface Syllabus {
  topic: string;
  title: string;
  keywords: string;
  description: string;
  total_duration_minutes: number;
  modules: Module[];
}
