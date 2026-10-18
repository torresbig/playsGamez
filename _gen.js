const fs=require('fs');
const path=require('path');

function w(name, html, js, css) {
  const b = path.join('gamez', name);
  fs.mkdirSync(b, {recursive:true});
  fs.writeFileSync(path.join(b,'index.html'), html);
  fs.writeFileSync(path.join(b,'game.js'), js);
  fs.writeFileSync(path.join(b,'style.css'), css);
}

// 1. Stone Smash
w('stone',
`<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PlaysGamez – Stone Smash</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1 id="title">PlaysGamez</h1>
    <div id="scoreBar"><span id="score">Score: 0</span><span id="best">Best: 0</span></div>
    <canvas id="gameCanvas" width="600" height="700"></canvas>
    <p id="hint">Maus/Finger: Kieselsteine zerstören · R Neustart</p>
    <div id="controls"><button id="restartBtn">Restart</button></div>
    <p id="touchHint">👆 Kieselsteine antippen</p>
    <script src="game.js"></script>
</body>
</html>`,
`
  const canvas=document.getElementById("gameCanvas"),ctx=canvas.getContext("2d");
  const scoreEl=document.getElementById("score"),bestEl=document.getElementById("best");
  const W=600,H=700;ctx.canvas.width=W;ctx.canvas.height=H;
  const BEST_KEY="playsgamez_stone_best";let best=+(localStorage.getItem(BEST_KEY)||0);
  bestEl.textContent=best?("Best: "+best):("Best: 0");
  let rocks=[],parts=[],score=0,t=0,spawnT=0.4,paused=false,over=false;
  function reset(){rocks=[];parts=[];score=0;t=0;spawnT=0.3;over=false;paused=false;updateScore();}
  function updateScore(){scoreEl.textContent="Score: "+score;if(score>best){best=score;localStorage.setItem(BEST_KEY,best);bestEl.textContent="Best: "+best;}}
  function spawn(){const r={x:40+Math.random()*(W-80),y:-10,s:14+Math.random()*34,rot:Math.random()*6,vr:2+Math.random()*3};rocks.push(r);}
  function crash(){over=true;for(let i=0;i<20;i++)parts.push({x:50,y:50,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,life:.6,t:0,color:"#ff0044"});}
  let lastT=0;
  function frame(ts){
    requestAnimationFrame(frame);
    const dt=Math.min(.033,(ts-lastT)/1000||.016);lastT=ts;
    ctx.fillStyle="#101010";ctx.fillRect(0,0,W,H);
    if(paused){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(0,0,W,H);ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="bold 34px Arial";ctx.shadowColor="#00eaff";ctx.shadowBlur=14;ctx.fillText("PAUSE",W/2,H/2);ctx.shadowBlur=0;}
    if(over){ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(0,0,W,H);ctx.textAlign="center";ctx.fillStyle="#ff0044";ctx.font="bold 40px Arial";ctx.shadowColor="#ff0044";ctx.shadowBlur=16;ctx.fillText("CRASH!",W/2,H/2);ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.font="18px Arial";ctx.fillText("R = Neustart - "+score, W/2,H/2+34);}
    t+=dt;spawnT-=dt;
    if(spawnT<=0){spawnT=Math.max(.08,.4-t*.004);spawn();}
    for(const r of rocks){r.y+=r.s*.4;r.rot+=r.vr*dt;r.x+=r.rot*dt*.3;}
    rocks=rocks.filter(r=>r.y<H+20);
    for(const r of rocks){if(Math.abs(r.x-80)<16&&r.y>H-30&&r.y<H+10){crash();break;}}
    for(const p of parts){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
    parts=parts.filter(p=>p.t<p.life);
    for(const r of rocks){
      ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.rot);ctx.shadowColor="#ff0044";ctx.shadowBlur=9;ctx.fillStyle="#ff0044";ctx.fillRect(-r.s/2,-r.s/2,r.s,r.s);ctx.fillStyle="#330000";ctx.fillRect(-r.s/4,-r.s/4,r.s/2,r.s/2);ctx.restore();
    }
    for(const p of parts){ctx.globalAlpha=1-p.t/p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
    ctx.fillStyle="#fff";ctx.font="bold 20px Arial";ctx.textAlign="left";ctx.fillText("Score: "+score,12,H-12);
    if(best>0){ctx.fillStyle="#607d8b";ctx.fillText("Best: "+best,W-12,20);}
    if(!over&&!paused){
      ctx.fillStyle="#607d8b";ctx.font="14px Arial";ctx.textAlign="center";ctx.fillText("🔨 Kieselsteine zerstören! R=Neustart",H/2,120);
    }
  }
  document.addEventListener("keydown",e=>{if(e.key==="r"||e.key==="R")reset();if(e.key==="p"||e.key==="P")paused=!paused;});
  canvas.addEventListener("click",()=>{if(over)reset();});
  canvas.addEventListener("touchstart",e=>{e.preventDefault();if(over)reset();},{passive:false});
  document.getElementById("restartBtn").onclick=reset;
  reset();requestAnimationFrame(frame);
`,
`
  :root{--main-color:#ff0044;--reserved-space:0}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;background:linear-gradient(135deg,#0a0a0a,#1a1a1a,#000);font-family:'Segoe UI',Arial,sans-serif;color:#fff;overflow-x:hidden}
  body::before{content:"";position:fixed;inset:0;background:repeating-linear-gradient(45deg,rgba(255,0,68,.05) 0 2px,transparent 2px 6px);animation:mv 12s linear infinite;pointer-events:none}
  @keyframes mv{from{transform:translateY(0)}to{transform:translateY(-200px)}}
  #title{text-align:center;margin:14px 0 6px;font-size:clamp(24px,5vw,44px);color:var(--main-color);text-shadow:0 0 20px var(--main-color),0 0 40px var(--main-color);letter-spacing:2px}
  #scoreBar{display:flex;gap:22px;font-size:17px;margin-bottom:6px;color:#cfd8dc}
  #score{color:#fff!important}#best{color:var(--main-color)!important;font-weight:700}
  #gameCanvas{display:block;width:min(600px,94vw);height:min(700px,94vh);border:3px solid var(--main-color);box-shadow:0 0 25px var(--main-color),inset 0 0 20px #003311;background:#07070a;border-radius:10px;touch-action:none;user-select:none}
  #hint{text-align:center;margin:6px 0 0;font-size:14px;color:#607d8b}
  #controls{display:flex;gap:12px;margin:12px 0 8px}
  button{background:#111;color:#fff;border:2px solid var(--main-color);padding:12px 24px;font-size:18px;border-radius:10px;cursor:pointer;transition:.25s;box-shadow:0 0 10px var(--main-color);font-family:inherit}
  button:hover{background:var(--main-color);color:#000;transform:translateY(-3px);box-shadow:0 0 20px var(--main-color)}
  @media(max-width:640px){#gameCanvas{width:94vw;height:70vh}}
`);

console.log("stone done");
