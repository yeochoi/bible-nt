export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, book, chapters } = req.body;
  if (!apiKey || !book || !chapters) return res.status(400).json({ error: 'Missing params' });

  const chList = chapters.map(c => `${book} ${c}장`).join(', ');
  const prompt = `한국어 성경 개역개정 묵상 전문가입니다. 오늘 말씀: ${chList}

순수 JSON만 출력. 마크다운 없이:
{"chapters":[${chapters.map(c => `{"num":${c},"verses":"${book} ${c}장 대표 2절 개역개정 본문","summary":"${book} ${c}장 핵심 1문장"}`).join(',')}],"takeaway":"오늘 핵심 1문장"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const raw = data.content.map(i => i.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
