export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { audioBase64, mimeType, language } = req.body;
    if (!audioBase64 || !mimeType) return res.status(400).json({ error: 'Missing audio data' });

    const assemblyKey = process.env.ASSEMBLYAI_API_KEY;
    if (!assemblyKey) return res.status(500).json({ error: 'API key not configured.' });

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { 'authorization': assemblyKey, 'content-type': mimeType },
      body: audioBuffer
    });
    const uploadData = await uploadRes.json();
    const audioUrl = uploadData.upload_url;
    if (!audioUrl) throw new Error('Upload failed.');

    const langCode = language === 'en' ? 'en' : language === 'zh' ? 'zh' : language === 'th' ? 'th' : null;
    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'authorization': assemblyKey, 'content-type': 'application/json' },
      body: JSON.stringify({
  audio_url: audioUrl,
  language_detection: true
})
    });
    const transcriptData = await transcriptRes.json();
    if (!transcriptData.id) throw new Error('Transcription request failed.');

    return res.status(200).json({ transcriptId: transcriptData.id });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
}
