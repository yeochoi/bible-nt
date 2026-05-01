export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, book, bookEn, chapters } = req.body;
  if (!apiKey || !book || !bookEn || !chapters) return res.status(400).json({ error: 'Missing params' });

  // 1. Fetch full Bible text from bible-api.com
  const bibleTexts = await Promise.all(
    chapters.map(async c => {
      try {
        const r = await fetch(`https://bible-api.com/${bookEn}+${c}?translation=korean`);
        const d = await r.json();
        // Format verses
        if (d.verses && d.verses.length > 0) {
          const text = d.verses.map(v => `${v.verse} ${v.text.trim()}`).join(' ');
          return { num: c, fulltext: text };
        }
        return { num: c, fulltext: d.text || '' };
      } catch(e) {
        return { num: c, fulltext: '' };
      }
    })
  );

  // 2. Claude only generates explanation + takeaway (fast & short)
  const chList = chapters.map(c => `${book} ${c}장`).join(', ');
  const prompt = `한국어 성경 묵상 전문가입니다. 오늘 말씀: ${chList}

아래 형식으로만 응답:

${chapters.map(c => `[CH_${c}]
EXPLAIN: ${book} ${c}장을 쉽고 간결하게 2문장.`).join('\n\n')}

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const raw = data.content.map(i => i.text || '').join('');
    const result = { chapters: [], takeaway: '' };

    chapters.forEach((c, i) => {
      const block = raw.match(new RegExp('\\[CH_' + c + '\\]([\\s\\S]*?)(?=\\[CH_|\\[TAKEAWAY\\]|$)'));
      const explainMatch = block ? block[1].match(/EXPLAIN:\s*([\s\S]*?)$/) : null;
      result.chapters.push({
        num: c,
        fulltext: bibleTexts[i].fulltext,
        explain: explainMatch ? explainMatch[1].trim() : ''
      });
    });

    const takeawayMatch = raw.match(/\[TAKEAWAY\]\s*([\s\S]+)$/);
    result.takeaway = takeawayMatch ? takeawayMatch[1].trim() : '';

    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
