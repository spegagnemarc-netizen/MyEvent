export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'La clé IA du serveur n’est pas configurée (OPENAI_API_KEY).'
    });
  }

  try {
    const body = req.body || {};

    const people = Math.max(
      1,
      Math.min(5000, Number(body.people) || 1)
    );

    const meal = String(body.meal || '').trim();
    const details = String(body.details || '').trim();
    const eventName = String(body.event_name || '').trim();
    const eventType = String(body.event_type || '').trim();

    const hall =
      body.hall && typeof body.hall === 'object'
        ? body.hall
        : null;

    const hallText = hall
      ? `Salle sélectionnée: ${hall.name || 'inconnue'}; capacité: ${hall.capacity || 'non indiquée'}; équipements: ${hall.equipment || 'non indiqués'}.`
      : 'Aucune salle sélectionnée.';

    const prompt = `Tu es l’assistant d’organisation de MyEvent. Génère une liste pratique de matériel et consommables à prévoir pour un événement.

Événement: ${eventName || 'non précisé'}
Type: ${eventType || 'non précisé'}
Nombre de personnes: ${people}
Repas/type de réception: ${meal || 'non précisé'}
Précisions: ${details || 'aucune'}
${hallText}

Règles:
- Réponds uniquement en JSON valide sous la forme {"items":[{"title":"...","quantity":1,"note":"..."}]}.
- 8 à 30 éléments utiles, pas de doublons.
- Adapte les quantités au nombre de personnes et au contexte.
- Pense aux éléments réellement utiles: vaisselle, verres, couverts, service, tables/chaises si pertinent, sacs poubelle, nappes, glacières, boissons/consommables seulement si le contexte les implique, etc.
- Si un élément dépend du lieu, mets-le en note plutôt que de l’inventer.
- Les quantités doivent être des entiers positifs.
- Ne propose pas d’alcool, d’armes, de médicaments ou de produits dangereux.
- N’inclus pas les personnes responsables: MyEvent s’en chargera après ajout.`;

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
          max_output_tokens: 3000
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
          Array.isArray(o.content) ? o.content : []
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

    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map(x => ({
            title: String(x.title || '').trim(),
            quantity: Math.max(
              1,
              Math.round(Number(x.quantity) || 1)
            ),
            note: String(x.note || '').trim()
          }))
          .filter(x => x.title)
          .slice(0, 30)
      : [];

    return res.status(200).json({ items });

  } catch (e) {
    return res.status(500).json({
      error:
        e?.message ||
        'Impossible de générer la liste.'
    });
  }
}
