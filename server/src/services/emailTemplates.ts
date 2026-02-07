export const generateFutureLetterEmail = (
  content: string,
  createdAt: Date,
  aiReply?: string | null
) => {
  const dateStr = createdAt.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Convert newlines to HTML line breaks for better compatibility
  const formattedContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>来自过去的信</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #000000; /* Pure Black for max contrast */
      color: #ffffff;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #111111; /* Very dark gray, almost black */
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #333333;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); /* Indigo to Violet, slightly darker */
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.05em;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .header p {
      margin: 10px 0 0;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
    }
    .content {
      padding: 20px;
      background-color: #111111;
    }
    .metadata {
      display: inline-block;
      padding: 4px 10px;
      background-color: #1f2937;
      border-radius: 20px;
      margin-bottom: 20px;
      font-size: 12px;
      color: #9ca3af;
      font-weight: 500;
    }
    .letter-body {
      font-family: 'Georgia', serif;
      font-size: 15px;
      line-height: 1.6;
      color: #ffffff; /* Pure white for max contrast */
      margin-bottom: 30px;
    }
    .ai-reply {
      background-color: #18181b; /* Zinc 900 */
      border-left: 4px solid #8b5cf6;
      padding: 25px;
      border-radius: 0 12px 12px 0;
      margin-top: 40px;
    }
    .ai-reply h3 {
      margin: 0 0 15px;
      font-size: 14px;
      color: #a78bfa;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 700;
    }
    .ai-reply p {
      margin: 0;
      font-size: 16px;
      line-height: 1.7;
      color: #e2e8f0;
      font-style: italic;
    }
    .footer {
      background-color: #000000;
      padding: 30px 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #1f2937;
    }
    .logo {
      font-weight: 700;
      color: #9ca3af;
    }
    
    /* Dark mode specific overrides for clients that support it */
    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; }
      .container { background-color: #111111 !important; }
      .letter-body { color: #ffffff !important; }
    }
  </style>
</head>
<body>
  <div style="background-color: #000000; padding: 20px; min-height: 100vh;">
    <div class="container">
      <div class="header">
        <h1>LUCID JOURNAL</h1>
        <p>A Message from Your Past Self</p>
      </div>
      
      <div class="content">
        <div class="metadata">
          <span>📅 封存日期：${dateStr}</span>
        </div>
        
        <div class="letter-body">
          ${formattedContent}
        </div>

        ${/* AI Reply section disabled by user request
        aiReply ? `
        <div class="ai-reply">
          <h3>Resonance / 回响</h3>
          <p>${aiReply.replace(/\n/g, '<br/>')}</p>
        </div>
        ` : ''*/ ''}
      </div>

      <div class="footer">
        <p>此邮件由 <span class="logo">LUCID Journal</span> 自动发送</p>
        <p>时刻保持觉察 · 连接过去未来</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};
