// MyEvent WebGL2 face warp proof-of-concept.
// Kept isolated so the validated camera remains unchanged until integration.
const VERTEX=`#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main(){v_uv=(a_position+1.0)*0.5;gl_Position=vec4(a_position,0.0,1.0);}`;
const FRAGMENT=`#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_leftEye,u_rightEye,u_face,u_mouth;
uniform float u_eye,u_faceWarp,u_mouthWarp,u_aspect;
in vec2 v_uv;
out vec4 outColor;
vec2 warp(vec2 uv,vec2 c,float radius,float strength){
 vec2 d=uv-c;d.x*=u_aspect;float dist=length(d);
 if(dist>=radius)return uv;
 float t=1.0-dist/radius;d*=1.0-strength*t*t;d.x/=u_aspect;return c+d;
}
void main(){
 vec2 uv=v_uv;
 uv=warp(uv,u_face,.38,u_faceWarp);
 uv=warp(uv,u_leftEye,.115,u_eye);
 uv=warp(uv,u_rightEye,.115,u_eye);
 uv=warp(uv,u_mouth,.15,u_mouthWarp);
 outColor=texture(u_image,clamp(uv,vec2(.001),vec2(.999)));
}`;
function compile(gl,type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader compile failed');
 return s;
}
const p=(marks,id)=>marks?.[id]||{x:.5,y:.5};
const uv=(marks,id)=>{const q=p(marks,id);return [q.x,1-q.y];};
export class FaceWarpRenderer{
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!gl)throw new Error('WebGL2 unavailable');this.gl=gl;
  const program=gl.createProgram(),vs=compile(gl,gl.VERTEX_SHADER,VERTEX),fs=compile(gl,gl.FRAGMENT_SHADER,FRAGMENT);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Program link failed');
  this.program=program;gl.useProgram(program);
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.u={};for(const n of ['u_image','u_leftEye','u_rightEye','u_face','u_mouth','u_eye','u_faceWarp','u_mouthWarp','u_aspect'])this.u[n]=gl.getUniformLocation(program,n);
  gl.uniform1i(this.u.u_image,0);
 }
 render(source,marks,effect,width=source.width,height=source.height){
  if(!marks||marks.length<468)return false;
  const gl=this.gl,w=Math.max(1,width|0),h=Math.max(1,height|0);this.canvas.width=w;this.canvas.height=h;
  gl.viewport(0,0,w,h);gl.useProgram(this.program);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
  gl.uniform2fv(this.u.u_leftEye,uv(marks,468));gl.uniform2fv(this.u.u_rightEye,uv(marks,473));gl.uniform2fv(this.u.u_face,uv(marks,1));gl.uniform2fv(this.u.u_mouth,uv(marks,13));
  const t=p(marks,13),bt=p(marks,14),a=p(marks,61),b=p(marks,291);
  const openness=Math.hypot(bt.x-t.x,bt.y-t.y)/Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y));
  const eye=effect==='big-eyes'?.58:effect==='toon-face'?.48:effect==='wild-face'?.42:0;
  const face=effect==='puffy-face'?.42:effect==='toon-face'?.28:effect==='wild-face'?.38:0;
  const mouth=effect==='reactive-mouth'?Math.min(.68,Math.max(.12,(openness-.02)*4.6)):effect==='toon-face'?.28:effect==='wild-face'?.5:0;
  gl.uniform1f(this.u.u_eye,eye);gl.uniform1f(this.u.u_faceWarp,face);gl.uniform1f(this.u.u_mouthWarp,mouth);
  gl.uniform1f(this.u.u_aspect,w/h);gl.drawArrays(gl.TRIANGLES,0,6);return true;
 }
 close(){const gl=this.gl;if(!gl)return;gl.deleteTexture(this.texture);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);this.gl=null;}
}
