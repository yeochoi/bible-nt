export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, book, chapters } = req.body;
  if (!apiKey || !book || !chapters) return res.status(400).json({ error: 'Missing params' });

  const chList = chapters.map(c => `${book} ${c}장`).join(', ');
  const prompt = `한국어 성경 개역개정 묵상 전문가입니다. 오늘 읽을 말씀: ${chList}

다음 JSON만 응답하세요 (마크다운 없이):
{"chapters":[${chapters.map(c => `{"num":${c},"verses":"${book} ${c}장 핵심 5~7절을 개역개정 본문 그대로. 각 절 앞에 절번호 숫자만.","summary":"${book} ${c}장 핵심 메시지 2~3문장."}`).join(',')}],"takeaway":"오늘 세 챕터의 핵심 메시지 한 문장. 삶에 적용 가능하게.","audio":"자연스럽게 읽히는 전체 낭독 텍스트. 챕터명과 본문 포함."}`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const raw = data.content.map(i => i.text || '').join('');
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
