export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY n’est pas configurée sur Vercel.' });

  try {
    const imageData = req.body?.imageData;
    if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Photo invalide.' });
    }

    const match = imageData.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
    if (!match) return res.status(400).json({ error: 'Format d’image non pris en charge.' });

    const mime = match[1].toLowerCase().replace('jpg', 'jpeg');
    const bytes = Buffer.from(match[2], 'base64');

    if (bytes.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'Photo trop volumineuse après compression.' });
    }

    const form = new FormData();

    form.append('model', 'gpt-image-2');

    form.append(
      'prompt',
      'Transform this portrait into a polished friendly 3D-cartoon avatar for a social event app. Preserve the person’s recognizable facial characteristics, hairstyle and overall appearance, while making it clearly an illustrated avatar rather than a photorealistic portrait. Centered head and shoulders, clean simple background, modern premium mobile-app style, square composition. Do not add text, logos, watermark, or extra people.'
    );

    form.append(
      'image[]',
      new Blob([bytes], { type: mime }),
      `photo.${mime.split('/')[1]}`
    );

    form.append('size', '1024x1024');
    form.append('quality', 'medium');
    form.append('output_format', 'webp');
    form.append('output_compression', '85');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Erreur OpenAI.'
      });
    }

    const b64 = data?.data?.[0]?.b64_json;

    if (!b64) {
      return res.status(502).json({
        error: 'OpenAI n’a pas retourné d’image.'
      });
    }

    return res.status(200).json({
      image: `data:image/webp;base64,${b64}`
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: 'Erreur serveur pendant la génération.'
    });
  }
}
