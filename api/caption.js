export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { audioBase64, mimeType, language, format, wordsPerLine } = req.body;
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

    const langCode = language === 'km' ? null : language === 'zh' ? 'zh' : language === 'th' ? 'th' : 'en';
    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'authorization': assemblyKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url: audioUrl,
        ...(langCode ? { language_code: langCode } : {}),
        language_detection: !langCode
      })
    });
    const transcriptData = await transcriptRes.json();
    const transcriptId = transcriptData.id;

    let result;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'authorization': assemblyKey }
      });
      result = await pollRes.json();
      if (result.status === 'completed') break;
      if (result.status === 'error') throw new Error(result.error);
    }

    if (!result || result.status !== 'completed') throw new Error('Transcription timed out.');

    let output = '';
    if (format === 'srt') {
      const words = result.words || [];
      const groupSize = parseInt(wordsPerLine) || 3;
      let index = 1;
      for (let i = 0; i < words.length; i += groupSize) {
        const group = words.slice(i, i + groupSize);
        const start = msToSrt(group[0].start);
        const end = msToSrt(group[group.length - 1].end);
        const text = group.map(w => w.text).join(' ');
        output += `${index}\n${start} --> ${end}\n${text}\n\n`;
        index++;
      }
    } else {
      output = result.text || '';
    }

    return res.status(200).json({ result: output.trim() });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
}

function msToSrt(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ms2 = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms2, 3)}`;
}

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}
