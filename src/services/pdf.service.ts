import puppeteer from "puppeteer";
import { ICourse } from "../models/course.model.js";

function generateCourseHtml(course: ICourse): string {
  const modulesHtml = course.modules
    .map(
      (module, index) => `
    <div class="module">
      <h2>Module ${index + 1}: ${module.title}</h2>
      ${module.overview ? `<p class="overview">${module.overview}</p>` : ""}
      <div class="content">
        ${module.generatedContent || "Content not generated yet."}
      </div>
    </div>
  `
    )
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
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 {
      color: #1a1a2e;
      border-bottom: 2px solid #1a1a2e;
      padding-bottom: 10px;
    }
    h2 {
      color: #16213e;
      margin-top: 40px;
    }
    h3 {
      color: #0f3460;
    }
    .description {
      font-style: italic;
      color: #666;
      margin-bottom: 30px;
    }
    .module {
      margin-bottom: 50px;
      page-break-inside: avoid;
    }
    .overview {
      background: #f5f5f5;
      padding: 15px;
      border-left: 4px solid #1a1a2e;
      margin-bottom: 20px;
    }
    .content {
      text-align: justify;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      overflow-x: auto;
      border-radius: 4px;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
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
