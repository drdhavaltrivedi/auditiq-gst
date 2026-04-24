import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, auditContext } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages are required.' });
  }

  // System instruction to provide context
  const systemInstruction = `You are AuditIQ AI, a professional GST compliance assistant. 
You have just performed an audit on the user's GST data. 
Here is the context of that audit:
Total Records: ${auditContext.total}
Flagged Count: ${auditContext.flagged_count}
Clean Count: ${auditContext.clean_count}

Flagged Transactions Details:
${JSON.stringify(auditContext.flagged_transactions, null, 2)}

Original AI Explanation:
${auditContext.ai_explanation}

Answer the user's follow-up questions based on this data. Be precise, professional, and helpful. 
If the user asks about specific rows or vendors, refer to the data provided.`;

  // Map messages to Gemini format
  const contents = messages.map((msg: any) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  // Insert system context as the first message or use systemInstruction if supported
  // For simplicity with v1, we can prepend a system message or use the system_instruction field
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
             parts: [{ text: systemInstruction }]
          },
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          },
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: `Gemini API error: ${err}` });
    }

    const data: any = await resp.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No reply generated.';

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
