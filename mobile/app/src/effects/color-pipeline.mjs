// Shared reference compositor. Native live backends must implement these semantics
// and compare their exported pixels with this implementation before advertising support.
export const colorFilters = ['original','warm','cool','monochrome','vintage','cinema','contrast','grain'];
export function renderColorFrame(source, filter, seed=1) {
  if(!(source instanceof Uint8ClampedArray) || source.length%4 || !colorFilters.includes(filter) || !Number.isInteger(seed))throw new Error('Frame / filtre invalide.');
  const result=new Uint8ClampedArray(source);
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let i=0;i<result.length;i+=4){
    let r=source[i],g=source[i+1],b=source[i+2];
    if(filter==='warm'){r+=14;b-=14;}
    if(filter==='cool'){r-=14;b+=14;}
    if(filter==='monochrome'){r=g=b=.2126*r+.7152*g+.0722*b;}
    if(filter==='vintage'){const red=r,green=g,blue=b;r=.393*red+.769*green+.189*blue;g=.349*red+.686*green+.168*blue;b=.272*red+.534*green+.131*blue;}
    if(filter==='contrast' || filter==='cinema'){
      const amount=filter==='contrast'?1.2:1.12;
      r=(r-127.5)*amount+127.5;g=(g-127.5)*amount+127.5;b=(b-127.5)*amount+127.5;
      if(filter==='cinema'){const luma=.2126*r+.7152*g+.0722*b;r=luma+(r-luma)*.85;g=luma+(g-luma)*.85;b=luma+(b-luma)*.85;}
    }
    if(filter==='grain'){const noise=(random()-.5)*16;r+=noise;g+=noise;b+=noise;}
    result[i]=r;result[i+1]=g;result[i+2]=b;
  }
  return result;
}
export function landmarksForFrame(frame, landmarks) {
  if(!frame || !Number.isFinite(frame.timestampMs) || !landmarks || landmarks.frameId!==frame.id || landmarks.coordinateSpace!=='normalized-oriented-unmirrored' ||
      !Number.isFinite(landmarks.confidence) || landmarks.confidence<0.6 || landmarks.confidence>1 ||
      !Number.isFinite(landmarks.timestampMs) || Math.abs(frame.timestampMs-landmarks.timestampMs)>100 ||
      !Array.isArray(landmarks.points) || !landmarks.points.length ||
      landmarks.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||(p.z!==undefined&&!Number.isFinite(p.z))||p.x<0||p.x>1||p.y<0||p.y>1))return null;
  return landmarks;
}
