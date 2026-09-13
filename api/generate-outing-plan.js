export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Méthode non autorisée.'
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'La clé IA du serveur n’est pas configurée.'
    });
  }

  try {
    const body = req.body || {};

    const people = Math.max(
      1,
      Math.min(5000, Number(body.people) || 1)
    );

    const budget =
      body.budget_per_person == null
        ? null
        : Math.max(0, Number(body.budget_per_person) || 0);

    const requestedSteps = Math.max(
      2,
      Math.min(5, Number(body.requested_steps) || 3)
    );

    const request = String(body.request || '').trim();
    const eventName = String(body.event_name || '').trim();
    const eventDate = String(body.event_date || '').trim();
    const eventLocation = String(body.event_location || '').trim();

    const startTime =
      /^\d{2}:\d{2}$/.test(String(body.start_time || ''))
        ? String(body.start_time)
        : null;

    const mealType = ['lunch', 'dinner', 'none'].includes(
      String(body.meal_type || '')
    )
      ? String(body.meal_type)
      : 'none';

    const mealTime =
      /^\d{2}:\d{2}$/.test(String(body.meal_time || ''))
        ? String(body.meal_time)
        : null;

    const mealInstruction =
      mealType === 'lunch'
        ? `déjeuner${mealTime ? ' vers ' + mealTime : ' entre 12h00 et 14h00'}`
        : mealType === 'dinner'
          ? `dîner${mealTime ? ' vers ' + mealTime : ' entre 19h00 et 21h00'}`
          : 'repas à placer à une heure naturelle selon le déroulé';

    const candidates = Array.isArray(body.candidates)
      ? body.candidates.slice(0, 120)
      : [];

    const safeCandidates = candidates
      .map((c, i) => ({
        id: String(c.id || `c${i}`),
        name: String(c.name || '').slice(0, 180),
        type: String(c.type || 'activity'),
        address: String(c.address || '').slice(0, 240),
        lat: Number(c.lat),
        lon: Number(c.lon),

        price_per_person:
          c.price_per_person == null
            ? null
            : Number(c.price_per_person),

        distance_km:
          c.distance_km == null
            ? null
            : Number(c.distance_km),

        website: c.website
          ? String(c.website).slice(0, 500)
          : null,

        phone: c.phone
          ? String(c.phone).slice(0, 80)
          : null
      }))
      .filter(
        c =>
          c.name &&
          Number.isFinite(c.lat) &&
          Number.isFinite(c.lon)
      );

    const prompt = `
Tu es l'organisateur IA de MyEvent.

Construis une sortie complète multi-étapes à partir UNIQUEMENT
des lieux candidats fournis.

Événement :
${eventName || 'Événement'}

Date :
${eventDate || 'non précisée'}

Lieu :
${eventLocation || 'non précisé'}

Participants :
${people}

Budget maximum par personne :
${budget == null ? 'non précisé' : budget + ' €'}

Nombre d'étapes souhaité :
${requestedSteps}

Heure de début souhaitée :
${startTime || 'non précisée'}

Repas :
${mealInstruction}

Demande de l'utilisateur :
${request || 'sortie conviviale et équilibrée'}

OBJECTIF :

- Combiner obligatoirement un restaurant ET une ou plusieurs activités.
- Produire entre 2 et 5 étapes.
- Une étape doit être un restaurant.
- Les autres étapes doivent être des activités, culture ou nature.
- Éviter les trajets absurdes.
- Privilégier les lieux proches les uns des autres.
- Proposer des horaires cohérents et chronologiques.
- Respecter l'heure de début souhaitée lorsqu'elle est fournie.
- Proposer des durées réalistes.
- Si le repas est un déjeuner, placer le restaurant autour de 12h00-14h00.
- Si le repas est un dîner, placer le restaurant autour de 19h00-21h00.
- Si une heure de repas est fournie, placer le restaurant aussi près que possible de cette heure.
- Ne jamais placer automatiquement un déjeuner ou un dîner à 16h00 ou à une heure manifestement peu naturelle.
- Ne jamais inventer un lieu.
- Ne jamais inventer une adresse.
- Ne jamais inventer un lieu, une adresse ou des coordonnées.
- Utiliser uniquement les candidats fournis.

PRIX :

- Utiliser en priorité le prix fourni par le candidat.
- Si le prix du candidat est inconnu (null), tu peux fournir une ESTIMATION raisonnable du prix par personne uniquement si le type et le nom du lieu permettent une estimation crédible.
- Une estimation doit être marquée avec price_is_estimate=true.
- Une estimation doit utiliser source="ai_estimate".
- Ne présente jamais une estimation comme un tarif vérifié.
- Si aucune estimation crédible n'est possible, conserver price_per_person=null et price_is_estimate=false.
- Le total_estimated_per_person peut additionner les prix connus et les estimations.
- Le total doit rester présenté comme une estimation lorsqu'une ou plusieurs étapes utilisent une estimation.

PROPOSITIONS :

- Proposer 6 parcours complets réellement différents dès que les candidats permettent 6 combinaisons distinctes.
- IMPORTANT : ne pas limiter volontairement la réponse à 3 propositions.
- Si 6 combinaisons distinctes sont possibles, retourner EXACTEMENT 6 propositions.
- Chaque parcours doit respecter EXACTEMENT le nombre d'étapes demandé.
- Varier les activités, ambiances et combinaisons entre les parcours autant que possible.
- Ne pas répéter exactement le même parcours sous des titres différents.

Exemples :

Restaurant → Bowling

Restaurant → Bowling → Bar

Restaurant → Cinéma → Dessert

Restaurant → Activité sportive → Restaurant

Restaurant → Musée → Activité

La sortie doit être pratique pour le groupe.

RÉPONSE JSON STRICTE UNIQUEMENT :

Retourne 6 objets dans "options" lorsque 6 parcours distincts sont possibles.
Ne retourne pas seulement 3 propositions par défaut.

{
  "people": ${people},
  "budget_per_person": ${
    budget == null ? 'null' : budget
  },
  "request": ${JSON.stringify(request)},
  "options": [
    {
      "title": "string",
      "summary": "string",
      "total_estimated_per_person": 0,
      "steps": [
        {
          "candidate_id": "id exact",
          "type": "restaurant|activity|culture|nature",
          "name": "nom exact du candidat",
          "address": "adresse exacte",
          "lat": 0,
          "lon": 0,
          "price_per_person": null,
          "price_is_estimate": false,
          "start_time": "HH:MM",
          "duration_minutes": 90,
          "website": null,
          "phone": null,
          "source": "openstreetmap"
        }
      ]
    }
  ]
}

CANDIDATS :

${JSON.stringify(safeCandidates)}
`;

    const response = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Authorization':
            `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model:
            process.env.OPENAI_MATERIAL_MODEL ||
            'gpt-5.6-luna',

          input: prompt,

          max_output_tokens: 9000
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

    const candidateMap = new Map(
      safeCandidates.map(c => [c.id, c])
    );

    const options = Array.isArray(parsed.options)
      ? parsed.options
          .slice(0, 6)
          .map(option => {

            const steps =
              Array.isArray(option.steps)
                ? option.steps
                    .slice(0, 5)
                    .map(step => {

                      const candidate =
                        candidateMap.get(
                          String(
                            step.candidate_id || ''
                          )
                        );

                      if (!candidate) {
                        return null;
                      }

                      const aiPrice =
                        Number.isFinite(
                          Number(step.price_per_person)
                        ) &&
                        Number(step.price_per_person) > 0
                          ? Number(step.price_per_person)
                          : null;

                      const candidatePrice =
                        Number.isFinite(
                          Number(candidate.price_per_person)
                        ) &&
                        Number(candidate.price_per_person) > 0
                          ? Number(candidate.price_per_person)
                          : null;

                      const finalPrice =
                        candidatePrice != null
                          ? candidatePrice
                          : aiPrice;

                      const isEstimate =
                        candidatePrice == null &&
                        aiPrice != null;

                      return {
                        candidate_id: candidate.id,

                        type: [
                          'restaurant',
                          'activity',
                          'culture',
                          'nature'
                        ].includes(
                          String(step.type)
                        )
                          ? String(step.type)
                          : candidate.type,

                        name: candidate.name,

                        address:
                          candidate.address,

                        lat: candidate.lat,

                        lon: candidate.lon,

                        price_per_person:
                          finalPrice,

                        price_is_estimate:
                          isEstimate,

                        start_time:
                          /^\d{2}:\d{2}$/.test(
                            String(
                              step.start_time || ''
                            )
                          )
                            ? String(
                                step.start_time
                              )
                            : null,

                        duration_minutes:
                          Math.max(
                            30,
                            Math.min(
                              360,
                              Math.round(
                                Number(
                                  step.duration_minutes
                                ) || 90
                              )
                            )
                          ),

                        website:
                          candidate.website,

                        phone:
                          candidate.phone,

                        source:
                          isEstimate
                            ? 'ai_estimate'
                            : 'openstreetmap'
                      };
                    })
                    .filter(Boolean)
                : [];

            const hasRestaurant =
              steps.some(
                s => s.type === 'restaurant'
              );

            const hasActivity =
              steps.some(
                s => s.type !== 'restaurant'
              );

            if (
              steps.length !== requestedSteps ||
              !hasRestaurant ||
              !hasActivity
            ) {
              return null;
            }

            const total =
              steps.reduce(
                (sum, step) =>
                  sum +
                  (
                    Number.isFinite(
                      Number(
                        step.price_per_person
                      )
                    )
                      ? Number(
                          step.price_per_person
                        )
                      : 0
                  ),
                0
              );

            return {
              title:
                String(
                  option.title ||
                  'Proposition'
                ).slice(0, 180),

              summary:
                String(
                  option.summary ||
                  'Sortie complète'
                ).slice(0, 400),

              total_estimated_per_person:
                total > 0
                  ? Math.round(
                      total * 100
                    ) / 100
                  : null,

              steps
            };
          })
          .filter(Boolean)
      : [];

    return res.status(200).json({
      people,
      budget_per_person: budget,
      request,
      start_time: startTime,
      meal_type: mealType,
      meal_time: mealTime,
      options
    });

  } catch (error) {

    console.error(
      'generate-outing-plan:',
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        'Impossible de générer le planning.'
    });
  }
}
