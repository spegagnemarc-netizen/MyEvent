export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  try {
    const { eventName, poll } = req.body || {};

    if (!poll || !poll.question || !Array.isArray(poll.results)) {
      return res.status(400).json({
        error: "Données du sondage manquantes."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY manquante."
      });
    }

    const results = poll.results.map((r) => ({
      choix: String(r.text || ""),
      votes: Number(r.votes || 0)
    }));

    const prompt = `
Tu analyses les résultats d'un sondage pour un groupe.

Événement : ${eventName || "Événement"}

Question :
${poll.question}

Réponses :
${results.map((r) => `- ${r.choix} : ${r.votes} vote(s)`).join("\n")}

Nombre total de votes : ${poll.totalVotes || 0}

Donne une analyse courte en français, en 2 à 4 phrases.

Indique clairement :
- le choix gagnant ;
- son nombre de votes ;
- s'il y a égalité ;
- éventuellement une observation simple sur la répartition.

N'invente aucune information.
Ne parle pas de toi ni d'intelligence artificielle.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erreur OpenAI."
      });
    }

    const analysis =
      data?.output_text ||
      data?.output?.flatMap((item) => item.content || [])
        ?.map((item) => item.text || "")
        ?.join(" ")
        ?.trim();

    if (!analysis) {
      return res.status(500).json({
        error: "Aucune analyse générée."
      });
    }

    const maxVotes = Math.max(...results.map((r) => r.votes), 0);

    const winners = results
      .filter((r) => r.votes === maxVotes && maxVotes > 0)
      .map((r) => r.choix);

    return res.status(200).json({
      analysis,
      winners,
      totalVotes: poll.totalVotes || 0
    });

  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Erreur serveur."
    });
  }
}
