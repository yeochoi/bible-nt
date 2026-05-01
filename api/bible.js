export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, book, chapter } = req.body;
  if (!apiKey || !book || !chapter) return res.status(400).json({ error: 'Missing params' });

  const prompt = `한국어 성경 개역개정 전문가입니다.

${book} ${chapter}장 전체 본문을 개역개정 그대로 출력하세요.
그 다음 쉬운 설명 2문장.
그 다음 오늘의 한 문장.

형식:
[FULLTEXT]
(전체 본문, 절번호 포함, 생략 없이)

[EXPLAIN]
(쉬운 설명 2문장)

[TAKEAWAY]
(핵심 한 문장)`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const raw = data.content.map(i => i.text || '').join('');

    const fulltextMatch = raw.match(/\[FULLTEXT\]\s*([\s\S]*?)(?=\[EXPLAIN\])/);
    const explainMatch = raw.match(/\[EXPLAIN\]\s*([\s\S]*?)(?=\[TAKEAWAY\])/);
    const takeawayMatch = raw.match(/\[TAKEAWAY\]\s*([\s\S]+)$/);

    res.status(200).json({
      fulltext: fulltextMatch ? fulltextMatch[1].trim() : '',
      explain: explainMatch ? explainMatch[1].trim() : '',
      takeaway: takeawayMatch ? takeawayMatch[1].trim() : ''
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
