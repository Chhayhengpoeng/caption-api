export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing transcript ID' });

    const assemblyKey = process.env.ASSEMBLYAI_API_KEY;
    if (!assemblyKey) return res.status(500).json({ error: 'API key not configured.' });

    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { 'authorization': assemblyKey }
    });
    const result = await pollRes.json();

    if (result.status === 'error') throw new Error(result.error);

    return res.status(200).json({
      status: result.status,
      text: result.text || '',
      words: result.words || []
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
}
