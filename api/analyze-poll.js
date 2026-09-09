export const config = {
  api: { bodyParser: { sizeLimit: '100kb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY n’est pas configurée sur Vercel.'
    });
  }

  try {
    const { eventName, poll } = req.body || {};

    if (!poll || typeof poll !== 'object') {
      return res.status(400).json({
        error: 'Données du sondage invalides.'
      });
    }

    const question = String(poll.question || '').slice(0, 300);

    const options = Array.isArray(poll.options)
      ? poll.options.slice(0, 20).map(option => ({
          text: String(
            option.text || option.option_text || ''
          ).slice(0, 200),
          votes: Math.max(0, Number(option.votes) || 0)
        }))
      : [];

    if (!question || !options.length) {
      return res.status(400).json({
        error: 'Question ou choix du sondage manquant.'
      });
    }

    const totalVotes = options.reduce(
      (sum, option) => sum + option.votes,
      0
    );

    const maxVotes = Math.max(
      ...options.map(option => option.votes)
    );

    const winners = options
      .filter(option => option.votes === maxVotes && maxVotes > 0)
      .map(option => option.text);

    const payload = {
      event: String(eventName || 'Événement').slice(0, 120),
      question,
      options,
      total_votes: totalVotes,
      winner_options: winners
    };

    const prompt = `Tu es l’assistant de MyEvent.

Analyse uniquement le sondage fourni.

Événement : ${payload.event}

Données :
${JSON.stringify(payload, null, 2)}

Règles :
- Réponds en français.
- 3 à 5 lignes maximum.
- Utilise des emojis adaptés.
- Donne le ou les choix ayant le plus de votes.
- Indique le nombre de votes du ou des gagnants.
- S’il y a égalité, indique clairement l’égalité.
- S’il n’y a aucun vote, dis qu’aucun choix n’est encore retenu.
- N’invente aucune information.
- Ne recommande pas encore d’établissement.
- Ton naturel et adapté à une application mobile.
- Ne parle pas de toi et ne mentionne pas l’IA.`;

    const response = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          input: prompt,
          reasoning: { effort: 'minimal' },
          text: { verbosity: 'low' },
          max_output_tokens: 220
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Erreur OpenAI.'
      });
    }

    const analysis =
      data?.output_text ||
      data?.output
        ?.flatMap(item => item.content || [])
        ?.find(item => item.type === 'output_text')
        ?.text;

    if (!analysis) {
      return res.status(502).json({
        error: 'OpenAI n’a pas retourné d’analyse.'
      });
    }

    return res.status(200).json({
      analysis: analysis.trim(),
      winners,
      totalVotes
    });

  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Erreur serveur.'
    });
  }
}
