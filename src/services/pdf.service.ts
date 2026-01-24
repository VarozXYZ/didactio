import puppeteer from "puppeteer";
import { marked } from "marked";
import { ICourse } from "../models/course.model.js";

function generateCourseHtml(course: ICourse): string {
  const modulesHtml = course.modules
    .map((module, index) => {
      const contentHtml = module.generatedContent 
        ? marked.parse(module.generatedContent) 
        : "<p>Content not generated yet.</p>";
      
      return `
    <div class="module">
      <h2>Module ${index + 1}: ${module.title}</h2>
      ${module.overview ? `<p class="overview">${module.overview}</p>` : ""}
      <div class="content">
        ${contentHtml}
      </div>
    </div>
  `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${course.syllabus?.title || "Course"}</title>
  <style>
    body {
      font-family: 'Georgia', serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 {
      color: #1a1a2e;
      border-bottom: 2px solid #1a1a2e;
      padding-bottom: 10px;
      font-size: 2em;
    }
    h2 {
      color: #16213e;
      margin-top: 50px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 8px;
      font-size: 1.6em;
    }
    h3 {
      color: #0f3460;
      margin-top: 30px;
      font-size: 1.3em;
    }
    h4 {
      color: #1a1a2e;
      margin-top: 20px;
      font-size: 1.1em;
    }
    .description {
      font-style: italic;
      color: #666;
      margin-bottom: 30px;
      font-size: 1.1em;
    }
    .module {
      margin-bottom: 60px;
      page-break-before: always;
    }
    .module:first-of-type {
      page-break-before: avoid;
    }
    .overview {
      background: #f5f5f5;
      padding: 15px 20px;
      border-left: 4px solid #1a1a2e;
      margin-bottom: 25px;
      font-style: italic;
    }
    .content {
      text-align: justify;
    }
    .content p {
      margin-bottom: 15px;
    }
    .content ul, .content ol {
      margin-bottom: 15px;
      padding-left: 30px;
    }
    .content li {
      margin-bottom: 8px;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      overflow-x: auto;
      border-radius: 4px;
      font-size: 0.9em;
      margin: 20px 0;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ccc;
      margin: 20px 0;
      padding: 10px 20px;
      background: #fafafa;
      font-style: italic;
    }
    strong {
      color: #1a1a2e;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 30px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background: #f5f5f5;
    }
  </style>
</head>
<body>
  <h1>${course.syllabus?.title || "Course"}</h1>
  <p class="description">${course.syllabus?.description || ""}</p>
  <p><strong>Topic:</strong> ${course.syllabus?.topic || course.originalPrompt}</p>
  <p><strong>Level:</strong> ${course.level}</p>
  <p><strong>Duration:</strong> ${course.syllabus?.total_duration_minutes || 0} minutes</p>
  
  ${modulesHtml}
</body>
</html>
  `;
}

export async function exportCourseToPdf(course: ICourse): Promise<Buffer> {
  const html = generateCourseHtml(course);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
