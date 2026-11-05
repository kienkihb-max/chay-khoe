window.Pose = class {
  setOptions(){} onResults(cb){this.cb=cb;} async initialize(){}
  async send(a){
    await new Promise(r=>setTimeout(r,25));
    const t=(a&&a.image&&a.image.src)?a.image.currentTime:performance.now()/1000, W=1280,H=720, pxcm=3, sh=172/60/2;
    const hipy=300+4*pxcm*Math.sin(2*Math.PI*(172/60)*t), hx=640;
    const lm=Array.from({length:33},()=>({x:0.5,y:0.3,visibility:1}));
    const set=(j,x,y,v)=>{lm[j]={x:x/W,y:y/H,visibility:v}};
    for (const [ids,shift,vis] of [[[11,23,25,27,29,31],0,.95],[[12,24,26,28,30,32],Math.PI,.55]]){
      const ph=2*Math.PI*sh*t+shift, ax=hx+25*pxcm*Math.cos(ph), ay=hipy+85*pxcm-12*pxcm*Math.max(-Math.sin(ph),0);
      const kx=hx+.5*(ax-hx)+10*pxcm, ky=hipy+42*pxcm;
      set(ids[0],hx+6*pxcm,hipy-50*pxcm,vis); set(ids[1],hx,hipy,vis); set(ids[2],kx,ky,vis);
      set(ids[3],ax,ay,vis); set(ids[4],ax-5*pxcm,ay+3*pxcm,vis); set(ids[5],ax+12*pxcm,ay+5*pxcm,vis);
    }
    set(0,hx+60,hipy-170,1); set(7,hx+40,hipy-165,1); set(8,hx+40,hipy-165,1);
    for (const [e,w,sg] of [[13,15,1],[14,16,-1]]) { const a=0.5*Math.sin(2*Math.PI*sh*t+(sg>0?0:Math.PI)); const sx=hx+6*pxcm, sy=hipy-50*pxcm; const ex=sx+25*pxcm*Math.sin(a), ey=sy+25*pxcm*Math.cos(a); set(e,ex,ey,.9); set(w,ex+20*pxcm*Math.cos(a)+8*pxcm,ey-10*pxcm,.9); }
    this.cb({poseLandmarks:lm});
  }
};
