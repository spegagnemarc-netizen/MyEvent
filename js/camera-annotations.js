/* Local photo decorations, drawn into the exported JPEG rather than an HTML overlay. */
(function(){
  window.createCameraAnnotations=function(modal){
    const items=[];let selected=-1;
    const changed=()=>modal.dispatchEvent(new Event('camera-decoration-change'));
    function render(output){
      const ctx=output.getContext('2d'),edge=Math.min(output.width,output.height);
      ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
      for(const item of items){
        const size=edge*item.size/100;
        ctx.font='700 '+size+'px system-ui, -apple-system, sans-serif';ctx.fillStyle=item.color;
        ctx.strokeStyle='rgba(0,0,0,.65)';ctx.lineWidth=Math.max(1,size/16);ctx.lineJoin='round';
        const text=item.text, x=output.width*item.x/100,y=output.height*item.y/100;
        const width=output.width*.88;
        if(item.kind==='text')ctx.strokeText(text,x,y,width);
        ctx.fillText(text,x,y,width);
      }
      ctx.restore();return output;
    }
    function panel(host){
      host.replaceChildren();
      const note=document.createElement('p');note.textContent='Gratuit · Texte et stickers intégrés à la photo enregistrée et publiée.';host.append(note);
      if(!modal.cameraHasPhoto?.()){note.textContent='Prends ou importe une photo pour ajouter du texte et des stickers. La décoration vidéo est à venir.';return;}
      const text=document.createElement('input');text.type='text';text.maxLength=80;text.placeholder='Ton texte…';text.setAttribute('aria-label','Texte sur la photo');
      const add=document.createElement('button');add.type='button';add.textContent='Ajouter le texte';
      const create=(value,kind)=>{if(!value.trim()||items.length>=12)return;items.push({text:value.trim(),kind,x:50,y:50,size:kind==='text'?7:14,color:'#ffffff'});selected=items.length-1;changed();panel(host);};
      add.onclick=()=>create(text.value,'text');host.append(text,add);
      const stickers=document.createElement('div');stickers.className='cameraPanelChoices';
      ['❤️','✨','🎉','🥳','👑','🌟','ME'].forEach(value=>{const button=document.createElement('button');button.type='button';button.textContent=value;button.setAttribute('aria-label','Ajouter le sticker '+value);button.onclick=()=>create(value,'sticker');stickers.append(button);});host.append(stickers);
      if(items.length>=12){const limit=document.createElement('p');limit.textContent='12 éléments maximum. Supprime un élément pour en ajouter un autre.';host.append(limit);}
      if(!items.length)return;
      const choose=document.createElement('select');choose.setAttribute('aria-label','Élément à modifier');
      items.forEach((item,i)=>choose.add(new Option(item.text,String(i))));choose.value=String(selected);
      choose.onchange=()=>{selected=Number(choose.value);panel(host);};host.append(choose);
      const item=items[selected];
      for(const [key,label,min,max] of [['x','Position horizontale',10,90],['y','Position verticale',10,90],['size','Taille',3,24]]){
        const wrap=document.createElement('label');wrap.className='cameraRetouchControl';wrap.textContent=label;
        const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.value=item[key];range.oninput=()=>{item[key]=Number(range.value);changed();};wrap.append(range);host.append(wrap);
      }
      const color=document.createElement('input');color.type='color';color.value=item.color;color.setAttribute('aria-label','Couleur du texte');color.oninput=()=>{item.color=color.value;changed();};host.append(color);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Supprimer cet élément';remove.onclick=()=>{items.splice(selected,1);selected=items.length-1;changed();panel(host);};host.append(remove);
    }
    modal.addEventListener('camera-source-reset',()=>{items.length=0;selected=-1;});
    return {render,panel};
  };
})();
