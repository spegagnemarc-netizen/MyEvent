// Local PDF-LIB 1.17.1, MIT. No data is sent to a PDF service.
export function pdfBlocks(html){
  // The generated document has a deliberately small, controlled HTML vocabulary.
  const decode=s=>s.replace(/&(?:amp|lt|gt|quot|#39);/g,c=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[c]));
  const body=html.split('<body>')[1].split('</body>')[0];
  return [...body.matchAll(/<(h1|h2|p|span)(?:\s[^>]*)?>([^<]*)<\/\1>/g)].map(([raw,tag,text])=>({text:decode(text),style:tag==='h1'?'title':tag==='h2'?'heading':tag==='span'?'label':/signature manuscrite/i.test(text)?'signature':'body'}));
}
export async function createRentalPDF(blocks,library){
  const {PDFDocument,StandardFonts,rgb}=library,pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(blocks.find(b=>b.style==='title')?.text||'Documents de location');pdf.setAuthor('ORÉVAMI');
  const margin=45,width=595.28,height=841.89,contentWidth=width-2*margin;
  let page,y;function newPage(){page=pdf.addPage([width,height]);y=height-margin;}
  newPage();
  function lines(text,font,size){
    const result=[];
    for(const paragraph of text.normalize('NFC').replace(/\t/g,'    ').replace(/\u202f|\u00a0/g,' ').split(/\r?\n/)){
      let line='';for(const word of paragraph.split(/\s+/)){
        if(!word)continue;
        // Break long references as well as ordinary words; measure actual font widths.
        for(const character of word){font.encodeText(character);}
        if(line&&font.widthOfTextAtSize(line+' '+word,size)<=contentWidth){line+=' '+word;continue;}
        if(line){result.push(line);line='';}
        for(const character of word){if(font.widthOfTextAtSize(line+character,size)>contentWidth){result.push(line);line='';}line+=character;}
      }result.push(line);
    }return result;
  }
  for(const [index,block] of blocks.entries()){
    const size=block.style==='title'?20:block.style==='heading'?14:10.5,font=['title','heading','label'].includes(block.style)?bold:regular;
    let wrapped;try{wrapped=lines(block.text,font,size);}catch{throw Error('Un caractère saisi n’est pas compatible avec le PDF direct. Utilisez Imprimer puis Enregistrer au format PDF dans Chrome ou Edge pour le conserver.');}
    const leading=size*1.4,signature=block.style==='signature';
    const signatureSpace=blocks[index+1]?.style==='signature'?220:125;
    if((signature&&y<signatureSpace)||(['heading','label'].includes(block.style)&&y<110)||(block.text==='Observations et signature'&&y<360))newPage();
    if(block.style==='heading')y-=10;
    for(const line of wrapped){if(y-leading<margin+25)newPage();page.drawText(line,{x:margin,y:y-size,size,font,color:rgb(.09,.16,.12)});y-=leading;}
    if(signature){page.drawRectangle({x:margin,y:y-62,width:contentWidth,height:60,borderWidth:.5,borderColor:rgb(.65,.71,.66)});y-=72;}else y-=block.style==='label'?1:7;
  }
  const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText('ORÉVAMI - Location de matériel - '+(i+1)+' / '+pages.length,{x:margin,y:24,size:8,font:regular,color:rgb(.35,.4,.36)}));
  return pdf.save();
}
