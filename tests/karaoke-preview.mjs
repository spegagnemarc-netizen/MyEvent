import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/js/karaoke.mjs', 'text/javascript'],
  ['/js/karaoke-score.mjs', 'text/javascript'],
  ['/css/karaoke.css', 'text/css'],
]);
const page = `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ORÉVAMI · Karaoké TEST</title>
<link rel="stylesheet" href="/css/karaoke.css">
<main>
  <h1>ORÉVAMI · Karaoké TEST</h1>
  <button type="button" disabled>Ouvrir le karaoké</button>
</main>
<script type="module">
  import '/js/karaoke.mjs';
  const button = document.querySelector('button');
  button.onclick = () => window.OrevamiKaraoke.open();
  button.disabled = false;
</script>
</html>`;

const server = createServer(async (request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
    return;
  }
  const type = files.get(request.url);
  if (!type) {
    response.writeHead(404).end();
    return;
  }
  try {
    const file = await readFile(new URL('..' + request.url, import.meta.url));
    response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }).end(file);
  } catch {
    response.writeHead(500).end();
  }
});
server.listen(Number(process.env.OREVAMI_KARAOKE_TEST_PORT ?? 4173), '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${server.address().port}/`);
});
