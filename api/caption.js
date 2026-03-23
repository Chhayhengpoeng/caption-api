export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { audioBase64, mimeType, language, format } = req.body;
    if (!audioBase64 || !mimeType) return res.status(400).json({ error: 'Missing audio data' });

    const assemblyKey = process.env.ASSEMBLYAI_API_KEY;

    // Convert base64 to buffer and upload to AssemblyAI
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': assemblyKey,
        'content-type': mimeType,
      },
      body: audioBuffer
    });
    const uploadData = await uploadRes.json();
    const audioUrl = uploadData.upload_url;

    // Request transcription
    const langCode = language === 'km' ? null : language === 'zh' ? 'zh' : language === 'th' ? 'th' : 'en';
    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        ...(langCode ? { language_code: langCode } : {}),
        language_detection: !langCode
      })
    });
    const transcriptData = await transcriptRes.json();
    const transcriptId = transcriptData.id;

    // Poll until done
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
      result.words?.forEach((word, i) => {
        const start = msToSrt(word.start);
        const end = msToSrt(word.end);
        output += `${i + 1}\n${start} --> ${end}\n${word.text}\n\n`;
      });
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
