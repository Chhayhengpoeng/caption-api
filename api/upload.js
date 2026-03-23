export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64 || !mimeType) return res.status(400).json({ error: 'Missing audio data' });

    const assemblyKey = process.env.ASSEMBLYAI_API_KEY;
    if (!assemblyKey) return res.status(500).json({ error: 'API key not configured.' });

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { 'authorization': assemblyKey, 'content-type': 'application/octet-stream' },
      body: audioBuffer
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.upload_url) return res.status(500).json({ error: 'Upload failed', detail: uploadData });

    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'authorization': assemblyKey, 'content-type': 'application/json' },
      body: JSON.stringify({ audio_url: uploadData.upload_url })
    });
    const transcriptData = await transcriptRes.json();

    if (!transcriptData.id) {
      return res.status(500).json({ error: 'Transcription failed', detail: transcriptData });
    }

    return res.status(200).json({ transcriptId: transcriptData.id });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
