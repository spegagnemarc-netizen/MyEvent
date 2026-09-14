module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Méthode non autorisée.'
    });
  }

  try {
    const body = req.body || {};

    const apiKey = String(
      process.env.OPENAI_API_KEY || ''
    ).trim();

    const model = String(
      process.env.OPENAI_MATERIAL_MODEL || 'gpt-5.6-luna'
    ).trim();

    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY est absente.'
      });
    }

    const eventName = String(
      body.eventName || 'Événement'
    ).trim().slice(0, 180);

    const incomingPolls = Array.isArray(body.polls)
      ? body.polls
      : (body.poll ? [body.poll] : []);

    if (!incomingPolls.length) {
      return res.status(400).json({
        error: 'Aucun sondage à analyser.'
      });
    }

    const polls = incomingPolls
      .slice(0, 30)
      .map((p, i) => ({
        question: String(
          p.question || `Sondage ${i + 1}`
        ).trim().slice(0, 500),

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
                text: String(
                  r.text || ''
                ).trim().slice(0, 300),

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

Analyse uniquement les résultats des sondages fournis.

Pour chaque sondage :
- identifie le choix majoritaire lorsqu'il existe ;
- indique "Aucun consensus" en cas d'égalité ou de données insuffisantes ;
- tiens compte du nombre de participants ;
- pour les sondages à réponses multiples, tiens compte du fait que plusieurs choix peuvent être sélectionnés.

Objectifs :
- résumer clairement les préférences du groupe ;
- déterminer les meilleurs choix lorsque les données le permettent ;
- signaler les incertitudes ;
- proposer une action concrète à l'organisateur.

IMPORTANT :
L'IA conseille.
L'organisateur valide.
Ne réserve rien.
Ne modifie rien.
Ne décide jamais automatiquement à la place du groupe.

Retourne UNIQUEMENT un JSON valide sous cette forme :

{
  "summary": "synthèse en 2 à 5 phrases",
  "decisions": [
    {
      "question": "question du sondage",
      "best_choice": "meilleur choix ou Aucun consensus",
      "reason": "raison basée sur les votes",
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
          'Authorization': `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model,
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
        .flatMap(item =>
          Array.isArray(item.content)
            ? item.content
            : []
        )
        .map(content => content.text || '')
        .join('');
    }

    text = String(text)
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (jsonError) {
      console.error(
        'Réponse IA non JSON :',
        text
      );

      return res.status(500).json({
        error: 'La réponse de l’IA n’est pas un JSON valide.'
      });
    }

    // Compatibilité avec l'analyse individuelle
    if (body.poll && !body.polls) {
      const first =
        Array.isArray(parsed.decisions)
          ? parsed.decisions[0]
          : null;

      return res.status(200).json({
        analysis:
          parsed.summary ||
          first?.reason ||
          'Analyse terminée.',

        decision:
          first?.action
            ? `${first.best_choice || 'Choix recommandé'} — ${first.action}`
            : (first?.best_choice || '')
      });
    }

    // Analyse globale
    return res.status(200).json({
      summary: String(
        parsed.summary || ''
      ).slice(0, 1500),

      decisions:
        Array.isArray(parsed.decisions)
          ? parsed.decisions.slice(0, 30)
          : []
    });

  } catch (error) {
    console.error(
      'analyze-poll:',
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        'Impossible d’analyser les sondages.'
    });
  }
};
