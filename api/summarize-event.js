export const config = {
  api: { bodyParser: { sizeLimit: '200kb' } }
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
    const { eventName, context } = req.body || {};

    if (!context || typeof context !== 'object') {
      return res.status(400).json({
        error: 'Données de contexte invalides.'
      });
    }

    const messages = Array.isArray(context.messages)
      ? context.messages.slice(0, 20)
      : [];

    const polls = Array.isArray(context.polls)
      ? context.polls.slice(0, 10)
      : [];

    const members = Array.isArray(context.members)
      ? context.members.slice(0, 10)
      : [];

    const mediaCount = Math.max(
      0,
      Math.min(Number(context.mediaCount) || 0, 50)
    );

    const payload = {
      event: String(eventName || 'Événement').slice(0, 120),

      messages: messages.map(x => ({
        content: String(x.content || '').slice(0, 500),
        created_at: x.created_at
      })),

      polls: polls.map(x => ({
        question: String(x.question || '').slice(0, 250),
        created_at: x.created_at,
        kind: x.kind || 'new',
        results: Array.isArray(x.results)
          ? x.results.slice(0, 20).map(r => ({
              text: String(r.text || '').slice(0, 150),
              votes: Math.max(0, Number(r.votes) || 0)
            }))
          : []
      })),

      new_media_count: mediaCount,
      new_members_count: members.length
    };

    const prompt = `Tu es l’assistant de MyEvent.
Résume très brièvement ce qu’une personne a manqué dans son événement de groupe.

Événement : ${payload.event}

Données depuis sa dernière visite :
${JSON.stringify(payload, null, 2)}

Règles importantes :
- Réponds en français.
- 3 à 5 puces maximum.
- Commence chaque puce par un emoji adapté.
- Mentionne uniquement ce qui est présent dans les données.
- Pour un sondage, utilise les résultats fournis dans "results".
- Si un résultat de sondage existe, indique clairement le ou les choix qui ont le plus de votes.
- Pour un sondage à réponses multiples, plusieurs choix peuvent être gagnants.
- Si tous les choix ont 0 vote, indique que le sondage n’a pas encore de résultat.
- Ne fabrique jamais de vote, de pourcentage, de date, de lieu ou d’information absente.
- Pour les messages, cite seulement les éléments réellement utiles à rattraper.
- Pour les médias, indique simplement combien de nouveaux médias ont été ajoutés.
- Si rien n’est nouveau, réponds uniquement : « ✅ Rien de nouveau à rattraper. »
- Ton naturel, clair et adapté à une application mobile.
- Ne parle pas de toi et ne mentionne pas l’IA.`;

    const response = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          input: prompt,
          reasoning: { effort: 'minimal' },
          text: { verbosity: 'low' },
          max_output_tokens: 350
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Erreur OpenAI.'
      });
    }

    const summary =
      data?.output_text ||
      data?.output
        ?.flatMap(x => x.content || [])
        .find(x => x.type === 'output_text')?.text;

    if (!summary) {
      return res.status(502).json({
        error: 'OpenAI n’a pas retourné de résumé.'
      });
    }

    return res.status(200).json({
      summary: summary.trim()
    });

  } catch (e) {
    console.error(e);

    return res.status(500).json({
      error: 'Erreur serveur pendant le résumé.'
    });
  }
}
