export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, book, chapters } = req.body;
  if (!apiKey || !book || !chapters) return res.status(400).json({ error: 'Missing params' });

  const chList = chapters.map(c => `${book} ${c}장`).join(', ');

  const prompt = `한국어 성경 개역개정 전문가입니다. 오늘 말씀: ${chList}

아래 형식으로만 응답하세요:

${chapters.map(c => `[CH_${c}]
FULLTEXT: ${book} ${c}장 전체 본문을 개역개정 그대로. 모든 절 빠짐없이. 절번호 포함.
EXPLAIN: 이 장을 누구나 이해할 수 있게 쉽게 2문장으로.`).join('\n\n')}

[TAKEAWAY]
오늘 말씀 핵심 한 문장.`;

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
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const raw = data.content.map(i => i.text || '').join('');
    const result = { chapters: [], takeaway: '' };

    chapters.forEach(c => {
      const block = raw.match(new RegExp('\\[CH_' + c + '\\]([\\s\\S]*?)(?=\\[CH_|\\[TAKEAWAY\\]|$)'));
      if (block) {
        const fulltextMatch = block[1].match(/FULLTEXT:\s*([\s\S]*?)(?=EXPLAIN:)/);
        const explainMatch = block[1].match(/EXPLAIN:\s*([\s\S]*?)$/);
        result.chapters.push({
          num: c,
          fulltext: fulltextMatch ? fulltextMatch[1].trim() : '',
          explain: explainMatch ? explainMatch[1].trim() : ''
        });
      }
    });

    const takeawayMatch = raw.match(/\[TAKEAWAY\]\s*([\s\S]+)$/);
    result.takeaway = takeawayMatch ? takeawayMatch[1].trim() : '';

    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
