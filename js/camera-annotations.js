/* One canvas renderer for touch editing and the final JPEG, in source-photo coordinates. */
(function(){
  window.createCameraAnnotations=function(modal){
    const items=[],pointers=new Map();let selected=-1,gesture=null,dirty=false;
    const photo=modal.querySelector('#myeventCapturedImage');
    const layer=document.createElement('canvas');layer.className='cameraDecorationLayer';layer.setAttribute('aria-label','Éditeur photo : déplacer au doigt, pincer pour agrandir et tourner');layer.hidden=true;modal.querySelector('.cameraProPreview').append(layer);
    const bar=document.createElement('div');bar.className='cameraDecorationTools';bar.hidden=true;
    const edit=document.createElement('button'),remove=document.createElement('button'),done=document.createElement('button');
    edit.type=remove.type=done.type='button';edit.textContent='Modifier';remove.textContent='Supprimer';done.textContent='Terminé';bar.append(edit,remove,done);modal.append(bar);
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    function metrics(ctx,item,w,h){
      const size=Math.min(w,h)*item.size/100;
      ctx.font='700 '+size+'px system-ui, -apple-system, sans-serif';
      return {size,width:Math.min(ctx.measureText(item.text).width,w*.88),x:w*item.x/100,y:h*item.y/100};
    }
    function draw(ctx,w,h,selection=false){
      ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
      items.forEach((item,index)=>{
        const m=metrics(ctx,item,w,h);ctx.save();ctx.translate(m.x,m.y);ctx.rotate(item.rotation*Math.PI/180);
        ctx.fillStyle=item.color;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.lineWidth=Math.max(1,m.size/16);ctx.lineJoin='round';
        if(item.kind==='text')ctx.strokeText(item.text,0,0,w*.88);
        ctx.fillText(item.text,0,0,w*.88);
        if(selection&&index===selected){ctx.strokeStyle=modal.dataset.cameraTier==='premium'?'#d6b866':'#ffffff';ctx.lineWidth=Math.max(1,w/layer.getBoundingClientRect().width*2);ctx.strokeRect(-m.width/2-m.size*.15,-m.size*.65,m.width+m.size*.3,m.size*1.3);}
        ctx.restore();
      });ctx.restore();
    }
    function render(output){draw(output.getContext('2d'),output.width,output.height);return output;}
    function refresh(){
      if(!modal.cameraHasPhoto?.()||!photo.naturalWidth||modal.getAttribute('aria-hidden')==='true'){layer.hidden=bar.hidden=true;return;}
      const source=modal.cameraGetPhotoSource?.();if(!source)return;
      if(layer.width!==source.width)layer.width=source.width;if(layer.height!==source.height)layer.height=source.height;
      layer.getContext('2d').clearRect(0,0,layer.width,layer.height);
      const r=photo.getBoundingClientRect();Object.assign(layer.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
      layer.hidden=false;draw(layer.getContext('2d'),layer.width,layer.height,true);
      bar.hidden=selected<0;bar.style.top=Math.max(0,r.top-42)+'px';
    }
    const changed=()=>{refresh();modal.dispatchEvent(new Event('camera-decoration-change'));};
    function point(e){const r=layer.getBoundingClientRect();return {x:(e.clientX-r.left)*layer.width/r.width,y:(e.clientY-r.top)*layer.height/r.height};}
    function hit(p){const ctx=layer.getContext('2d');for(let i=items.length-1;i>=0;i--){const item=items[i],m=metrics(ctx,item,layer.width,layer.height),angle=-item.rotation*Math.PI/180,dx=p.x-m.x,dy=p.y-m.y;
      const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
      const pad=Math.max(m.size*.2,22*layer.width/layer.getBoundingClientRect().width);
      if(Math.abs(x)<=m.width/2+pad&&Math.abs(y)<=m.size*.65+pad)return i;
    }return -1;}
    function anchor(){
      if(selected<0||!pointers.size){gesture=null;return;}
      const points=[...pointers.values()],a=points[0],b=points[1]||a;
      gesture={...items[selected],cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,distance:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)};
    }
    layer.addEventListener('pointerdown',e=>{
      if(!modal.cameraHasPhoto?.())return;e.preventDefault();e.stopPropagation();
      if(!pointers.size){selected=hit(point(e));refresh();}
      if(selected<0||pointers.size>=2)return;
      try{layer.setPointerCapture(e.pointerId);}catch(error){/* Safari can cancel capture before this handler completes. */}pointers.set(e.pointerId,point(e));anchor();
    });
    layer.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId)||!gesture)return;e.preventDefault();pointers.set(e.pointerId,point(e));
      const points=[...pointers.values()],a=points[0],b=points[1]||a,item=items[selected];
      const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
      const requestedScale=pointers.size===2&&gesture.distance>0?Math.hypot(b.x-a.x,b.y-a.y)/gesture.distance:1;
      item.size=clamp(gesture.size*requestedScale,3,50);const scale=item.size/gesture.size;
      const rotation=pointers.size===2?Math.atan2(b.y-a.y,b.x-a.x)-gesture.angle:0;
      const dx=layer.width*gesture.x/100-gesture.cx,dy=layer.height*gesture.y/100-gesture.cy;
      item.x=clamp((cx+scale*(dx*Math.cos(rotation)-dy*Math.sin(rotation)))/layer.width*100,0,100);
      item.y=clamp((cy+scale*(dx*Math.sin(rotation)+dy*Math.cos(rotation)))/layer.height*100,0,100);
      item.rotation=((gesture.rotation+rotation*180/Math.PI+180)%360+360)%360-180;dirty=true;refresh();
    });
    function release(e){
      if(!pointers.delete(e.pointerId))return;
      if(layer.hasPointerCapture(e.pointerId))layer.releasePointerCapture(e.pointerId);
      anchor();if(!pointers.size&&dirty){dirty=false;changed();}
    }
    for(const name of ['pointerup','pointercancel','lostpointercapture'])layer.addEventListener(name,release);
    layer.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
    layer.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});
    edit.onclick=()=>{const host=modal.querySelector('#cameraPanelContent'),sheet=modal.querySelector('#cameraCreativePanel');sheet.hidden=false;sheet.dataset.kind='stickers';modal.querySelector('#cameraPanelTitle').textContent='Modifier cet élément';panel(host);};
    remove.onclick=()=>{if(selected<0)return;items.splice(selected,1);selected=-1;changed();const sheet=modal.querySelector('#cameraCreativePanel');if(!sheet.hidden&&sheet.dataset.kind==='stickers')panel(modal.querySelector('#cameraPanelContent'));};
    done.onclick=()=>{selected=-1;refresh();};
    function panel(host){
      host.replaceChildren();
      const note=document.createElement('p');note.textContent='Déplace au doigt. Avec deux doigts : agrandis et tourne. Ferme ce panneau pour éditer toute la photo.';host.append(note);
      if(!modal.cameraHasPhoto?.()){note.textContent='Prends ou importe une photo. La décoration vidéo est à venir.';return;}
      const text=document.createElement('input');text.type='text';text.maxLength=80;text.placeholder='Ton texte…';text.setAttribute('aria-label','Texte sur la photo');
      const add=document.createElement('button');add.type='button';add.textContent='Ajouter le texte';
      const create=(value,kind)=>{if(!value.trim()||items.length>=12)return;const offset=(items.length%5-2)*9;items.push({text:value.trim(),kind,x:50+offset,y:50+offset,size:kind==='text'?7:14,rotation:0,color:'#ffffff'});selected=items.length-1;changed();panel(host);};
      add.onclick=()=>create(text.value,'text');host.append(text,add);
      const stickers=document.createElement('div');stickers.className='cameraPanelChoices';
      ['❤️','✨','🎉','🥳','👑','🌟','ME'].forEach(value=>{const button=document.createElement('button');button.type='button';button.textContent=value;button.setAttribute('aria-label','Ajouter le sticker '+value);button.onclick=()=>create(value,'sticker');stickers.append(button);});host.append(stickers);
      if(items.length>=12){const limit=document.createElement('p');limit.textContent='12 éléments maximum.';host.append(limit);}
      if(!items.length)return;
      const choose=document.createElement('select');choose.setAttribute('aria-label','Élément à modifier');items.forEach((item,i)=>choose.add(new Option(item.text,String(i))));
      choose.value=String(selected);choose.onchange=()=>{selected=Number(choose.value);refresh();panel(host);};host.append(choose);
      if(selected<0)return;const item=items[selected];
      const value=document.createElement('input');value.type='text';value.maxLength=80;value.value=item.text;value.setAttribute('aria-label','Modifier le contenu');
      const save=document.createElement('button');save.type='button';save.textContent='Appliquer le texte';save.onclick=()=>{if(value.value.trim()){item.text=value.value.trim();changed();panel(host);}};host.append(value,save);
      for(const [key,label,min,max] of [['size','Taille',3,50],['rotation','Rotation',-180,180]]){
        const wrap=document.createElement('label');wrap.className='cameraRetouchControl';wrap.textContent=label;
        const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.value=item[key];range.oninput=()=>{item[key]=Number(range.value);changed();};wrap.append(range);host.append(wrap);
      }
      const color=document.createElement('input');color.type='color';color.value=item.color;color.setAttribute('aria-label','Couleur du texte');color.oninput=()=>{item.color=color.value;changed();};host.append(color);
      const del=document.createElement('button');del.type='button';del.textContent='Supprimer cet élément';del.onclick=()=>{items.splice(selected,1);selected=items.length-1;changed();panel(host);};host.append(del);
    }
    modal.addEventListener('camera-source-reset',()=>{items.length=0;selected=-1;pointers.clear();gesture=null;dirty=false;layer.hidden=bar.hidden=true;});
    modal.addEventListener('camera-preview-ready',refresh);modal.addEventListener('camera-editor-layout',refresh);
    return {render,panel};
  };
})();
