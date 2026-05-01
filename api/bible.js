export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, book, chapters } = req.body;
  if (!apiKey || !book || !chapters) return res.status(400).json({ error: 'Missing params' });

  const chList = chapters.map(c => book + ' ' + c + '장').join(', ');

  const prompt = '한국어 성경 개역개정 묵상 전문가입니다.\n오늘 말씀: ' + chList + '\n\n아래 형식으로 정확히 응답하세요:\n\n[CHAPTER_' + chapters[0] + ']\nVERSES: 대표 구절 1~2절 본문\nSUMMARY: 핵심 메시지 한 문장\n\n' + (chapters.length > 1 ? '[CHAPTER_' + chapters[1] + ']\nVERSES: 대표 구절 1~2절 본문\nSUMMARY: 핵심 메시지 한 문장\n\n' : '') + (chapters.length > 2 ? '[CHAPTER_' + chapters[2] + ']\nVERSES: 대표 구절 1~2절 본문\nSUMMARY: 핵심 메시지 한 문장\n\n' : '') + '[TAKEAWAY]\n오늘 말씀 전체 핵심 한 문장';

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const raw = data.content.map(i => i.text || '').join('');

    // Parse text format instead of JSON
    const result = { chapters: [], takeaway: '' };

    chapters.forEach(c => {
      const block = raw.match(new RegExp('\\[CHAPTER_' + c + '\\]([\\s\\S]*?)(?=\\[CHAPTER_|\\[TAKEAWAY\\]|$)'));
      if (block) {
        const versesMatch = block[1].match(/VERSES:\s*(.+)/);
        const summaryMatch = block[1].match(/SUMMARY:\s*(.+)/);
        result.chapters.push({
          num: c,
          verses: versesMatch ? versesMatch[1].trim() : '',
          summary: summaryMatch ? summaryMatch[1].trim() : ''
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
