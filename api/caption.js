export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { audioBase64, mimeType, language, format } = req.body;

    if (!audioBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing audio data' });
    }

    const langPrompt =
      language === 'km' ? 'The audio is in Khmer (Cambodian).' :
      language === 'en' ? 'The audio is in English.' :
      language === 'zh' ? 'The audio is in Chinese.' :
      language === 'th' ? 'The audio is in Thai.' : '';

    const formatPrompt = format === 'srt'
      ? 'Return ONLY a valid SRT subtitle file. Example format:\n1\n00:00:00,000 --> 00:00:05,000\nText here\n\n2\n00:00:05,000 --> 00:00:10,000\nMore text'
      : 'Return ONLY a plain text transcript. No timestamps, no formatting, just the spoken words.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: `You are a professional audio transcription AI. ${langPrompt} ${formatPrompt} Do not add any explanation or extra text.`,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: mimeType, data: audioBase64 }
            },
            {
              type: 'text',
              text: `Transcribe this audio in ${format === 'srt' ? 'SRT format' : 'plain text'}.`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content?.map(b => b.text || '').join('') || '';
    return res.status(200).json({ result: text.trim() });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
}
