
const { generateFutureLetterEmail } = require('../src/services/emailTemplates');

try {
  const html = generateFutureLetterEmail(
    "Test Content\nWith Newlines",
    new Date(),
    "AI Reply Content"
  );
  console.log("Template generation successful. Length:", html.length);
} catch (error) {
  console.error("Template generation failed:", error);
  process.exit(1);
}
