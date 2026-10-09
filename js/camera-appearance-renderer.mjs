export const categories=[['fun','Déformations'],['glasses','Lunettes'],['accessories','Accessoires'],['makeup','Maquillage'],['creative-ai','Cartoon 3D · IA']];
export const effects={
  fun:[['big-eyes','Gros yeux','👀'],['big-head','Grosse tête','😮'],['small-face','Petit visage','🙂'],['toon-face','Cartoon local','🧸'],['wild-face','Déformation du visage','🤪'],['funny-mirror','Miroir déformant','🪞'],['puffy-face','Visage arrondi','○'],['reactive-mouth','Bouche réactive','😛'],['pig-face','Petit cochon','🐷']],
  glasses:[['round','Lunettes amusantes','🤓'],['sun','Lunettes soleil','🕶'],['hearts','Lunettes cœur','😍']],
  accessories:[['clown','Nez de clown','🔴'],['hat','Chapeau','🎩'],['dog','Oreilles de chien','🐶'],['cat','Oreilles de chat','🐱'],['rainbow','Arc-en-ciel','🌈'],['moustache','Moustache','🥸'],['stars','Étoiles','✦'],['crown','Couronne','♛']],
  makeup:[['rose','Rose','🌸'],['coral','Corail','💋']]
};
export const warpEffects=new Set(effects.fun.map(x=>x[0]));
export const selectedWarp=selection=>selection.fun||null;
export const hasEffects=selection=>Object.values(selection).some(Boolean);

// Landmarks and the canvas share the exact cropped, unmirrored camera frame.
// This function remains the Canvas2D layer for glasses/accessories/makeup.
export function drawAppearance(ctx,landmarks,selection,width,height,intensity=1){
  if(!landmarks||landmarks.length<468)return;
  const p=i=>({x:landmarks[i].x*width,y:landmarks[i].y*height});
  const a=p(33),b=p(263),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const span=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);
  if(!Number.isFinite(span)||span<2)return;
  ctx.save();ctx.globalAlpha*=Math.min(1,Math.max(0,intensity));
  if(selection.fun==='pig-face'){
    const nose=p(4),mouth=p(13);ctx.save();ctx.translate(nose.x,nose.y);ctx.rotate(angle);
    ctx.fillStyle='rgba(239,151,151,.94)';ctx.strokeStyle='rgba(126,61,61,.75)';ctx.lineWidth=Math.max(2,span*.012);
    ctx.beginPath();ctx.ellipse(0,0,span*.19,span*.13,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(55,24,28,.88)';for(const x of [-.065,.065]){ctx.beginPath();ctx.ellipse(span*x,0,span*.035,span*.052,0,0,Math.PI*2);ctx.fill();}ctx.restore();
    ctx.save();ctx.translate(mouth.x,mouth.y+span*.12);ctx.rotate(angle);ctx.fillStyle='rgba(244,116,146,.96)';ctx.strokeStyle='rgba(130,49,70,.7)';ctx.lineWidth=Math.max(2,span*.01);ctx.beginPath();ctx.ellipse(0,span*.07,span*.12,span*.24,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }
  if(selection.fun==='wild-face'){
    const mouth=p(13);ctx.save();ctx.translate(mouth.x,mouth.y+span*.08);ctx.rotate(angle);ctx.fillStyle='rgba(244,112,145,.94)';ctx.strokeStyle='rgba(116,42,65,.7)';ctx.lineWidth=Math.max(2,span*.01);ctx.beginPath();ctx.ellipse(0,span*.07,span*.105,span*.21,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }
  if(selection.makeup){
    const lip=selection.makeup==='coral'?'rgba(238,83,63,.58)':'rgba(194,46,108,.48)';
    const contours=[[61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185],[78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191]];
    ctx.beginPath();
    for(const contour of contours){contour.forEach((id,i)=>{const q=p(id);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();}
    ctx.fillStyle=lip;ctx.fill('evenodd');
    for(const id of [50,280]){const q=p(id);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(angle);ctx.fillStyle=selection.makeup==='coral'?'rgba(246,112,77,.20)':'rgba(220,85,135,.20)';ctx.beginPath();ctx.ellipse(0,0,span*.12,span*.055,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  }
  if(selection.glasses){
    ctx.save();ctx.translate(mid.x,mid.y);ctx.rotate(angle);
    ctx.lineWidth=span*.025;ctx.strokeStyle=selection.glasses==='sun'?'#17151c':'#f1bf70';ctx.fillStyle=selection.glasses==='sun'?'rgba(14,18,30,.82)':'rgba(195,230,255,.10)';
    for(const x of [-.285,.285]){ctx.beginPath();if(selection.glasses==='hearts'){const cx=span*x;ctx.moveTo(cx,span*.20);ctx.bezierCurveTo(cx-span*.52,-span*.16,cx-span*.10,-span*.32,cx,-span*.13);ctx.bezierCurveTo(cx+span*.10,-span*.32,cx+span*.52,-span*.16,cx,span*.20);ctx.fillStyle='#eb4479aa';ctx.strokeStyle='#ff7eaa';}else ctx.ellipse(span*x,span*.015,span*.255,span*.19,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.beginPath();ctx.moveTo(-span*.03,0);ctx.quadraticCurveTo(0,-span*.05,span*.03,0);ctx.moveTo(-span*.54,0);ctx.lineTo(-span*.62,-span*.045);ctx.moveTo(span*.54,0);ctx.lineTo(span*.62,-span*.045);ctx.stroke();ctx.restore();
  }
  if(selection.accessories){
    const forehead=p(10);ctx.save();ctx.translate(forehead.x,forehead.y);ctx.rotate(angle);ctx.fillStyle='#ffd16b';ctx.strokeStyle='#bc6c32';ctx.lineWidth=span*.012;
    if(selection.accessories==='crown'){
      ctx.beginPath();ctx.moveTo(-span*.38,0);ctx.lineTo(-span*.46,-span*.3);ctx.lineTo(-span*.18,-span*.16);ctx.lineTo(0,-span*.42);ctx.lineTo(span*.18,-span*.16);ctx.lineTo(span*.46,-span*.3);ctx.lineTo(span*.38,0);ctx.closePath();ctx.fill();ctx.stroke();
    }else if(selection.accessories==='stars'){
      for(const side of [-1,1]){ctx.beginPath();for(let i=0;i<10;i++){const radius=span*(i%2?.05:.12),theta=i*Math.PI/5-Math.PI/2;const x=side*span*.57+Math.cos(theta)*radius,y=span*.25+Math.sin(theta)*radius;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();}
    }else if(selection.accessories==='hat'){
      ctx.fillStyle='#222';ctx.strokeStyle='#ff8b52';ctx.fillRect(-span*.33,-span*.45,span*.66,span*.40);ctx.strokeRect(-span*.33,-span*.45,span*.66,span*.40);ctx.fillRect(-span*.50,-span*.06,span,span*.10);ctx.fillStyle='#ff8b52';ctx.fillRect(-span*.33,-span*.16,span*.66,span*.06);
    }else if(selection.accessories==='dog'||selection.accessories==='cat'){
      for(const side of [-1,1]){ctx.save();ctx.translate(side*span*.38,-span*.08);ctx.fillStyle='#a46841';ctx.strokeStyle='#4e2b21';ctx.beginPath();if(selection.accessories==='cat'){ctx.moveTo(-span*.18,span*.1);ctx.lineTo(side*span*.1,-span*.38);ctx.lineTo(span*.18,span*.1);ctx.closePath();}else ctx.ellipse(side*span*.1,span*.10,span*.16,span*.34,-side*.35,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
    }else if(selection.accessories==='rainbow'){
      const colors=['#f34b5c','#ff9143','#ffe76b','#62dba4','#57abff','#a576ff'];ctx.lineWidth=span*.07;colors.forEach((color,i)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.arc(0,span*.1,span*(.7-i*.075),Math.PI,Math.PI*2);ctx.stroke();});
    }
    ctx.restore();
    if(selection.accessories==='clown'){
      const nose=p(4);ctx.save();ctx.translate(nose.x,nose.y);ctx.fillStyle='#ee3040';ctx.strokeStyle='#941827';ctx.beginPath();ctx.arc(0,0,span*.12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#ffffffaa';ctx.beginPath();ctx.arc(-span*.035,-span*.035,span*.03,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(selection.accessories==='moustache'){
      const nose=p(4),mouth=p(13);ctx.save();ctx.translate((nose.x+mouth.x)/2,(nose.y+mouth.y)/2);ctx.rotate(angle);ctx.fillStyle='#2d1812';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(side*span*.08,-span*.08,side*span*.24,span*.08,side*span*.32,-span*.07);ctx.bezierCurveTo(side*span*.28,span*.16,side*span*.07,span*.15,0,0);ctx.fill();}ctx.restore();
    }
  }
  ctx.restore();
}
