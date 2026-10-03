const fs = require('node:fs/promises');
const path = require('node:path');
const { Document, HeadingLevel, Packer, Paragraph, TextRun } = require('docx');

const sourcePath = path.join(__dirname, '..', 'docs', 'acceptable-use-policy.md');
const outputPath = path.join(__dirname, '..', 'docs', 'acceptable-use-policy.docx');

function inlineRuns(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    if (part.startsWith('**')) return new TextRun({ text: part.slice(2, -2), bold: true });
    return new TextRun(part);
  });
}

async function generate() {
  const markdown = await fs.readFile(sourcePath, 'utf8');
  const paragraphs = markdown.split(/\r?\n/).flatMap((line) => {
    const text = line.trim();
    if (!text) return [];
    if (text.startsWith('# ')) return [new Paragraph({ text: text.slice(2), heading: HeadingLevel.TITLE })];
    if (text.startsWith('## ')) return [new Paragraph({ text: text.slice(3), heading: HeadingLevel.HEADING_1 })];
    if (text.startsWith('- ')) return [new Paragraph({ children: inlineRuns(text.slice(2)), bullet: { indent: 360 }, spacing: { after: 100 } })];
    return [new Paragraph({ children: inlineRuns(text), spacing: { after: 140 } })];
  });
  const document = new Document({
    creator: 'SinglePoint',
    title: 'Acceptable Use Policy',
    subject: 'SinglePoint account, training, incident and data-handling rules',
    sections: [{ properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children: paragraphs }]
  });
  await fs.writeFile(outputPath, await Packer.toBuffer(document));
}

generate().catch((error) => {
  console.error(`Failed to generate the AUP document: ${error.message}`);
  process.exitCode = 1;
});