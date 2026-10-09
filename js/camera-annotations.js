/* One canvas renderer for touch editing and the final JPEG, in source-photo coordinates. */
(function(){
  window.createCameraAnnotations=function(modal){
    const frame={style:'none',color:'#ffffff',thickness:3},items=[],pointers=new Map();let selected=-1,gesture=null,dirty=false;
    const photo=modal.querySelector('#myeventCapturedImage');
    const layer=document.createElement('canvas');layer.className='cameraDecorationLayer';layer.setAttribute('aria-label','Éditeur photo : déplacer au doigt, pincer pour agrandir et tourner');layer.hidden=true;modal.querySelector('.cameraProPreview').append(layer);
    const bar=document.createElement('div');bar.className='cameraDecorationTools';bar.hidden=true;
    const edit=document.createElement('button'),remove=document.createElement('button'),done=document.createElement('button');
    edit.type=remove.type=done.type='button';edit.textContent='Modifier';remove.textContent='Supprimer';done.textContent='Terminé';bar.append(edit,remove,done);modal.append(bar);
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    const signatureNames={classic:'Classique',heart:'Cœur',crown:'Couronne',handwritten:'Manuscrite'};
    // Pen strokes are vectors, independent of installed fonts and identical in the JPEG.
    function signature(ctx,style,size,color){
      ctx.fillStyle=ctx.strokeStyle=color;ctx.lineCap=ctx.lineJoin='round';
      if(style==='handwritten'){
        ctx.save();ctx.scale(size/40,size/40);ctx.translate(-96,-18);ctx.lineWidth=2.3;
        const paths=[
          'M 0 32 C 3 12 3 3 6 2 C 9 4 13 25 14 27 C 17 21 25 3 29 1 C 27 12 24 31 28 33',
          'M 33 16 C 30 30 39 31 45 16 C 43 29 43 46 33 49 C 23 48 39 35 48 31',
          'M 52 31 C 55 20 57 6 60 1 M 58 3 C 66 0 73 0 78 2 M 55 18 L 71 16 M 52 31 C 61 28 70 29 74 30',
          'M 79 16 C 77 27 81 36 85 31 L 98 14',
          'M 99 24 C 112 22 113 12 106 15 C 93 20 96 40 114 28',
          'M 118 16 L 115 32 C 119 23 130 12 131 18 C 129 24 126 37 136 29',
          'M 145 4 C 140 13 136 34 142 32 L 154 25 M 134 16 L 153 13',
          'M -3 42 C 48 36 103 40 150 38 C 130 41 125 44 117 43',
          'M 157 30 C 151 22 157 18 161 24 C 165 15 175 20 170 27 L 159 37 L 157 30'
        ];
        for(const path of paths)ctx.stroke(new Path2D(path));ctx.restore();return;
      }
      ctx.font='italic 700 '+size+'px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('MyEvent',0,0);
      if(style==='heart'){ctx.save();ctx.translate(size*2.12,-size*.32);ctx.scale(size/40,size/40);ctx.lineWidth=2.4;ctx.stroke(new Path2D('M 0 4 C -20 -10 -9 -23 0 -12 C 10 -24 25 -10 0 4 Z'));ctx.restore();}
      if(style==='crown'){ctx.save();ctx.translate(size*1.55,-size*.85);ctx.scale(size/40,size/40);ctx.lineWidth=2;const path=new Path2D('M -15 8 L -19 -9 L -7 0 L 0 -16 L 7 0 L 19 -9 L 15 8 Z');ctx.stroke(path);ctx.restore();}
    }
    function metrics(ctx,item,w,h){
      const size=Math.min(w,h)*item.size/100;
      ctx.font='700 '+size+'px system-ui, -apple-system, sans-serif';
      return {size,width:item.kind==='signature'?size*5.2:Math.min(ctx.measureText(item.text).width,w*.88),x:w*item.x/100,y:h*item.y/100};
    }
    function bubble(ctx,item,m){
      const x=-m.width/2-m.size*.45,y=-m.size*.9,w=m.width+m.size*.9,h=m.size*1.8;
      ctx.fillStyle=item.background||'#ffffff';ctx.strokeStyle=item.outlineColor||'#111111';ctx.lineWidth=m.size*(item.outlineWidth??5)/100;
      ctx.beginPath();
      if(item.bubble==='thought')ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);
      else if(item.bubble==='shout'){for(let i=0;i<32;i++){const a=i*Math.PI/16,r=i%2?.77:1;const px=Math.cos(a)*w/2*r,py=Math.sin(a)*h*.65*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
      else{ctx.roundRect(x,y,w,h,m.size*.3);}
      ctx.fill();if((item.outlineWidth??5)>0)ctx.stroke();
      if(item.bubble==='speech'){ctx.beginPath();ctx.moveTo(-w*.22,h/2-2);ctx.lineTo(-w*.3,h*.85);ctx.lineTo(-w*.03,h/2-2);ctx.fill();if((item.outlineWidth??5)>0)ctx.stroke();}
      if(item.bubble==='thought'){for(const [px,py,r] of [[-w*.24,h*.66,m.size*.15],[-w*.32,h*.91,m.size*.09]]){ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();if((item.outlineWidth??5)>0)ctx.stroke();}}
    }
    function drawFrame(ctx,w,h){
      if(frame.style==='none')return;
      const crop=modal.cameraGetExportCrop?.({width:w,height:h})||{x:0,y:0,width:w,height:h};
      const t=Math.min(crop.width,crop.height)*frame.thickness/100;
      ctx.save();ctx.translate(crop.x,crop.y);ctx.strokeStyle=frame.color;ctx.fillStyle=frame.color;ctx.lineWidth=t;
      const inset=t/2,cw=crop.width,ch=crop.height;
      if(frame.style==='neon'){ctx.shadowColor=frame.color;ctx.shadowBlur=t*2;}
      if(frame.style==='polaroid'){ctx.fillRect(0,0,cw,t);ctx.fillRect(0,0,t,ch);ctx.fillRect(cw-t,0,t,ch);ctx.fillRect(0,ch-t*3,cw,t*3);}
      else{ctx.beginPath();if(frame.style==='rounded')ctx.roundRect(inset,inset,cw-t,ch-t,Math.min(cw,ch)*.07);else ctx.rect(inset,inset,cw-t,ch-t);ctx.stroke();}
      if(frame.style==='festive'){ctx.shadowBlur=0;const colors=[frame.color,'#ff7d32','#ffd166','#e76fbc'];for(let i=0;i<48;i++){ctx.fillStyle=colors[i%4];const x=(i*137%997)/997*(cw-t)+inset,y=i%2?ch-t*1.3:t*.7;ctx.save();ctx.translate(x,y);ctx.rotate(i*.9);ctx.fillRect(-t*.18,-t*.3,t*.36,t*.6);ctx.restore();}}
      ctx.restore();
    }
    function draw(ctx,w,h,selection=false){
      ctx.save();drawFrame(ctx,w,h);ctx.textAlign='center';ctx.textBaseline='middle';
      items.forEach((item,index)=>{
        const m=metrics(ctx,item,w,h);ctx.save();ctx.translate(m.x,m.y);ctx.rotate(item.rotation*Math.PI/180);
        ctx.globalAlpha=item.opacity??1;ctx.shadowColor=item.shadowColor||'#000000';ctx.shadowBlur=m.size*(item.shadow??0)/100;ctx.shadowOffsetY=m.size*(item.shadow??0)/300;ctx.lineJoin='round';if(item.kind==='text'&&item.bubble&&item.bubble!=='none')bubble(ctx,item,m);ctx.fillStyle=item.color;ctx.strokeStyle=item.outlineColor||'#000000';ctx.lineWidth=m.size*(item.outlineWidth??6)/100;
        if(item.kind==='signature'){if((item.outlineWidth??6)>0){ctx.save();ctx.shadowBlur=0;const pad=ctx.lineWidth/2;for(const [x,y] of [[pad,0],[-pad,0],[0,pad],[0,-pad]]){ctx.save();ctx.translate(x,y);signature(ctx,item.signature,m.size,item.outlineColor||'#000000');ctx.restore();}ctx.restore();}signature(ctx,item.signature,m.size,item.color);}else{if(item.kind==='text'&&(item.outlineWidth??6)>0)ctx.strokeText(item.text,0,0,w*.88);ctx.fillText(item.text,0,0,w*.88);}ctx.globalAlpha=1;ctx.shadowBlur=ctx.shadowOffsetY=0;
        if(selection&&index===selected){ctx.strokeStyle=modal.dataset.cameraTier==='premium'?'#d6b866':'#ffffff';ctx.lineWidth=Math.max(1,w/layer.getBoundingClientRect().width*2);ctx.strokeRect(-m.width/2-m.size*.15,-m.size*.65,m.width+m.size*.3,m.size*1.3);}
        ctx.restore();
      });ctx.restore();
    }
    function render(output){draw(output.getContext('2d'),output.width,output.height);return output;}
    function refresh(){
      if(!modal.cameraHasPhoto?.()||!photo.naturalWidth||modal.getAttribute('aria-hidden')==='true'){layer.hidden=true;const video=modal.dataset.mediaKind==='video'&&modal.dataset.cameraState==='preview'&&modal.getAttribute('aria-hidden')!=='true';bar.hidden=!video;edit.hidden=remove.hidden=done.hidden=video;return;}
      const source=modal.cameraGetPhotoSource?.();if(!source)return;
      if(layer.width!==source.width)layer.width=source.width;if(layer.height!==source.height)layer.height=source.height;
      layer.getContext('2d').clearRect(0,0,layer.width,layer.height);
      const r=photo.getBoundingClientRect();Object.assign(layer.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',clipPath:photo.style.clipPath});
      layer.hidden=false;draw(layer.getContext('2d'),layer.width,layer.height,true);
      bar.hidden=false;done.hidden=false;bar.style.removeProperty('top');edit.disabled=remove.disabled=selected<0;const validated=modal.dataset.cameraEditing==='validated';edit.hidden=remove.hidden=validated;done.textContent=validated?'Modifier la photo':'Terminé';
    }
    const changed=()=>{refresh();modal.dispatchEvent(new Event('camera-decoration-change'));};
    function point(e){const r=layer.getBoundingClientRect();return {x:(e.clientX-r.left)*layer.width/r.width,y:(e.clientY-r.top)*layer.height/r.height};}
    function hit(p){const ctx=layer.getContext('2d');for(let i=items.length-1;i>=0;i--){const item=items[i],m=metrics(ctx,item,layer.width,layer.height),angle=-item.rotation*Math.PI/180,dx=p.x-m.x,dy=p.y-m.y;
      const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
      const pad=Math.max(m.size*.2,22*layer.width/layer.getBoundingClientRect().width);
      if(Math.abs(x)<=m.width/2+m.size*.5+pad&&Math.abs(y)<=m.size*(item.bubble&&item.bubble!=='none'?1.5:.65)+pad)return i;
    }return -1;}
    function anchor(){
      if(selected<0||!pointers.size){gesture=null;return;}
      const points=[...pointers.values()],a=points[0],b=points[1]||a;
      gesture={...items[selected],cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,distance:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)};
    }
    layer.addEventListener('pointerdown',e=>{
      if(!modal.cameraHasPhoto?.())return;e.preventDefault();e.stopPropagation();
      if(!pointers.size){modal.cameraResumeEdit?.();selected=hit(point(e));refresh();}
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
    edit.onclick=()=>{const host=modal.querySelector('#cameraPanelContent'),sheet=modal.querySelector('#cameraCreativePanel');sheet.hidden=false;sheet.dataset.kind=items[selected]?.kind==='signature'?'signatures':'stickers';modal.querySelector('#cameraPanelTitle').textContent='Modifier cet élément';panel(host,sheet.dataset.kind);};
    remove.onclick=()=>{if(selected<0)return;items.splice(selected,1);selected=-1;changed();const sheet=modal.querySelector('#cameraCreativePanel');if(!sheet.hidden&&['stickers','signatures'].includes(sheet.dataset.kind))panel(modal.querySelector('#cameraPanelContent'),sheet.dataset.kind);};
    done.onclick=()=>{selected=-1;if(modal.dataset.cameraEditing==='validated')modal.cameraResumeEdit?.();else modal.cameraValidateEdit?.();refresh();};
    function panel(host,mode='stickers'){
      host.replaceChildren();
      const note=document.createElement('p');note.textContent='Déplace au doigt. Avec deux doigts : agrandis et tourne. Ferme ce panneau pour éditer toute la photo.';host.append(note);
      if(!modal.cameraHasPhoto?.()){note.textContent='Prends ou importe une photo. La décoration vidéo est à venir.';return;}
      function range(target,key,label,min,max){const wrap=document.createElement('label');wrap.className='cameraRetouchControl';wrap.textContent=label;const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.value=target[key]??0;input.setAttribute('aria-label',label);input.oninput=()=>{target[key]=Number(input.value);changed();};wrap.append(input);host.append(wrap);}
      function colors(target,key,label){const wrap=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=label;wrap.append(legend);const row=document.createElement('div');row.className='cameraPanelChoices';for(const hex of ['#ffffff','#000000','#ff6b35','#ffd166','#ef476f','#06d6a0','#118ab2','#b388ff']){const button=document.createElement('button');button.type='button';button.textContent='●';button.style.setProperty('background',hex,'important');button.style.setProperty('color',hex,'important');button.style.setProperty('border','2px solid #888','important');button.setAttribute('aria-label',label+' '+hex);button.onclick=()=>{target[key]=hex;custom.value=hex;changed();};row.append(button);}const custom=document.createElement('input');custom.type='color';custom.value=target[key]||'#ffffff';custom.setAttribute('aria-label',label);custom.oninput=()=>{target[key]=custom.value;changed();};wrap.append(row,custom);host.append(wrap);}
      if(mode==='frames'){const choices=document.createElement('div');choices.className='cameraPanelChoices';for(const [style,label] of [['none','Aucun'],['simple','Simple'],['rounded','Arrondi'],['polaroid','Polaroid'],['neon','Néon'],['festive','Festif']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(style===frame.style));button.onclick=()=>{frame.style=style;changed();panel(host,mode);};choices.append(button);}host.append(choices);colors(frame,'color','Couleur du cadre');range(frame,'thickness','Épaisseur du cadre',1,10);return;}
      const create=(value,kind,style)=>{if(!value.trim()||items.length>=12)return;const offset=(items.length%5-2)*9;items.push({text:value.trim(),kind,signature:style,x:50,y:50+offset,size:kind==='sticker'?14:7,rotation:0,color:'#ffffff',opacity:1,bubble:'none',background:'#ffffff',outlineColor:'#000000',outlineWidth:6,shadow:0,shadowColor:'#000000'});selected=items.length-1;changed();panel(host,mode);};
      if(mode==='signatures'){
        const gallery=document.createElement('div');gallery.className='cameraSignatureGallery';
        for(const [style,name] of Object.entries(signatureNames)){
          const button=document.createElement('button');button.type='button';button.dataset.signature=style;button.setAttribute('aria-label','Signature '+name);
          const thumb=document.createElement('canvas');thumb.width=260;thumb.height=100;const ctx=thumb.getContext('2d');ctx.translate(125,55);signature(ctx,style,40,'#ffffff');
          const label=document.createElement('span');label.textContent=name;button.append(thumb,label);
          button.onclick=()=>{if(items[selected]?.kind==='signature'){items[selected].signature=style;items[selected].text='MyEvent · '+name;changed();panel(host,mode);}else create('MyEvent · '+name,'signature',style);};gallery.append(button);
        }host.append(gallery);
      }else{
        const text=document.createElement('input');text.type='text';text.maxLength=80;text.placeholder='Ton texte…';text.setAttribute('aria-label','Texte sur la photo');
        const add=document.createElement('button');add.type='button';add.textContent='Ajouter le texte';add.onclick=()=>create(text.value,'text');host.append(text,add);
        const stickers=document.createElement('div');stickers.className='cameraPanelChoices';
        ['❤️','✨','🎉','🥳','👑','🌟','ME'].forEach(value=>{const button=document.createElement('button');button.type='button';button.textContent=value;button.setAttribute('aria-label','Ajouter le sticker '+value);button.onclick=()=>create(value,'sticker');stickers.append(button);});if(mode!=='text')host.append(stickers);
      }
      if(items.length>=12){const limit=document.createElement('p');limit.textContent='12 éléments maximum.';host.append(limit);}
      if(!items.length)return;
      const choose=document.createElement('select');choose.setAttribute('aria-label','Élément à modifier');items.forEach((item,i)=>choose.add(new Option(item.text,String(i))));
      choose.value=String(selected);choose.onchange=()=>{selected=Number(choose.value);refresh();panel(host,mode);};host.append(choose);
      if(selected<0)return;const item=items[selected];
      const value=document.createElement('input');value.type='text';value.maxLength=80;value.value=item.text;value.setAttribute('aria-label','Modifier le contenu');
      const save=document.createElement('button');save.type='button';save.textContent='Appliquer le texte';save.onclick=()=>{if(value.value.trim()){item.text=value.value.trim();changed();panel(host,mode);}};if(item.kind!=='signature')host.append(value,save);
      for(const [key,label,min,max] of [['size','Taille',3,50],['rotation','Rotation',-180,180]]){
        const wrap=document.createElement('label');wrap.className='cameraRetouchControl';wrap.textContent=label;
        const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.value=item[key];range.oninput=()=>{item[key]=Number(range.value);changed();};wrap.append(range);host.append(wrap);
      }
      const opacity=document.createElement('label');opacity.className='cameraRetouchControl';opacity.textContent='Transparence';const alpha=document.createElement('input');alpha.type='range';alpha.min='0';alpha.max='100';alpha.value=String(Math.round((item.opacity??1)*100));alpha.setAttribute('aria-label','Opacité de l’élément');alpha.oninput=()=>{item.opacity=Number(alpha.value)/100;changed();};opacity.append(alpha);host.append(opacity);
      colors(item,'color','Couleur du texte');colors(item,'outlineColor','Couleur du contour');range(item,'outlineWidth','Épaisseur du contour',0,20);colors(item,'shadowColor','Couleur de l’ombre');range(item,'shadow','Ombre',0,50);
      if(item.kind==='text'){const label=document.createElement('label');label.textContent='Bulle';const select=document.createElement('select');select.setAttribute('aria-label','Style de bulle');for(const [value,name] of [['none','Sans bulle'],['speech','Parole'],['thought','Pensée'],['shout','Cri']])select.add(new Option(name,value));select.value=item.bubble||'none';select.onchange=()=>{item.bubble=select.value;changed();};label.append(select);host.append(label);colors(item,'background','Fond de la bulle');}
      const del=document.createElement('button');del.type='button';del.textContent='Supprimer cet élément';del.onclick=()=>{items.splice(selected,1);selected=items.length-1;changed();panel(host,mode);};host.append(del);
    }
    modal.addEventListener('camera-source-reset',()=>{items.length=0;frame.style='none';selected=-1;pointers.clear();gesture=null;dirty=false;layer.hidden=bar.hidden=true;});
    modal.addEventListener('camera-preview-ready',refresh);modal.addEventListener('camera-editor-layout',refresh);
    return {render,panel,signatures:host=>panel(host,'signatures')};
  };
})();
