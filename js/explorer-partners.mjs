// Official loaders require the normal parser/DOMContentLoaded sequence.
const kind=new URLSearchParams(location.search).get('kind');
if(['accommodation','transport','ticket'].includes(kind))location.replace('explorer-partners-'+kind+'.html');
else document.getElementById('notice').textContent='Catégorie de partenaire inconnue.';
