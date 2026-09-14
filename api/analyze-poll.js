export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Méthode non autorisée.'
    });
  }

  try {
    const body = req.body || {};
    const eventName = String(body.eventName || 'Événement').slice(0, 180);

    const incomingPolls = Array.isArray(body.polls)
      ? body.polls
      : (body.poll ? [body.poll] : []);

    if (!incomingPolls.length) {
      return res.status(400).json({
        error: 'Aucun sondage à analyser.'
      });
    }

    const polls = incomingPolls.slice(0, 30).map((p, i) => ({
      question: String(
        p.question || `Sondage ${i + 1}`
      ).slice(0, 500),

      allow_multiple: !!p.allow_multiple,

      voterCount: Math.max(
        0,
        Number(p.voterCount) || 0
      ),

      totalVotes: Math.max(
        0,
        Number(p.totalVotes) || 0
      ),

      results: Array.isArray(p.results)
        ? p.results
            .slice(0, 30)
            .map(r => ({
              text: String(r.text || '').slice(0, 300),
              votes: Math.max(
                0,
                Number(r.votes) || 0
              )
            }))
            .filter(r => r.text)
        : []
    }));

    const prompt = `
Tu es l'assistant de décision de MyEvent.

Événement : ${eventName}

Tu dois analyser les sondages ci-dessous UNIQUEMENT à partir des votes fournis.

Ne prétends jamais qu'un résultat est certain si les données sont faibles ou ex æquo.

Pour chaque sondage :
- identifie le choix majoritaire quand il existe ;
- sinon indique qu'il n'y a pas de consensus fiable ;
- prends en compte le nombre de participants ayant voté ;
- pour les sondages à réponses multiples, tiens compte du fait que plusieurs choix peuvent être sélectionnés.

OBJECTIFS :

- produire une synthèse très claire des préférences du groupe ;
- déterminer le meilleur choix pour chaque sondage quand les données le permettent ;
- faire ressortir les préférences fortes et les incertitudes ;
- proposer une action concrète et prudente pour l'organisateur ;
- ne jamais effectuer cette action automatiquement.

IMPORTANT :

L'IA conseille, l'organisateur valide.

Ne réserve rien.
Ne modifie rien.
Ne décide pas à la place du groupe.

RÉPONSE JSON STRICTE :

{
  "summary": "synthèse en 2 à 5 phrases",
  "decisions": [
    {
      "question": "question exacte",
      "best_choice": "meilleur choix ou Aucun consensus",
      "reason": "raison courte basée sur les votes",
      "action": "action proposée à l'organisateur"
    }
  ]
}

SONDAGES :

${JSON.stringify(polls)}
`;

    const response = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model:
            process.env.OPENAI_MATERIAL_MODEL ||
            'gpt-5.6-luna',

          input: prompt,

          max_output_tokens: 5000
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          'Erreur du service IA.'
      });
    }

    let text = data.output_text || '';

    if (!text && Array.isArray(data.output)) {
      text = data.output
        .flatMap(o =>
          Array.isArray(o.content)
            ? o.content
            : []
        )
        .map(c => c.text || '')
        .join('');
    }

    text = String(text)
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(text);

    /*
     * Compatibilité avec l'ancien fonctionnement
     * d'analyse d'un seul sondage.
     */
    if (body.poll && !body.polls) {
      const first =
        Array.isArray(parsed.decisions)
          ? parsed.decisions[0]
          : null;

      return res.status(200).json({
        analysis:
          parsed.summary ||
          (first?.reason ||
            'Analyse terminée.'),

        decision:
          first?.action
            ? `${first.best_choice || 'Choix recommandé
