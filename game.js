/* Tethered Chaos — deterministic-ish local simulation with separated input/state.
   Online upgrade path: replace readLocalInput() with network snapshots and run
   simulate(dt, inputs) on an authoritative server or rollback client. */

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const ui = Object.fromEntries(['wave','score','combo','high','status','overlay','overlay-title','overlay-text','start','lan','network','pause','announcement','announcement-title','announcement-text','copy-score','sound'].map(id=>[id,document.getElementById(id)]));
const W=canvas.width,H=canvas.height,TAU=Math.PI*2;
const held=new Set(),pressed=new Set();
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let state,raf,last=0,soundOn=true,audio;
let mode='menu',socket=null,lanSlot=0,roomPlayers=0,sendClock=0,guestWave=1,intentionalClose=false;
let remoteInput={x:0,y:0,action:false};

const MODIFIERS=[
  {name:'TURBO-SCHWARM',text:'Mehr Gegner. Mehr Punkte. Weniger Ausreden.',spawn:.58,speed:1.12,score:1.35},
  {name:'GUMMILEINE',text:'Euer Band zieht euch doppelt so stark zusammen.',pull:2.1,score:1.2},
  {name:'GLASKANONEN',text:'Eure Impulse sind riesig. Gegner aber auch.',pulse:1.75,enemySize:1.3,score:1.4},
  {name:'BLACKOUT',text:'Die Arena wird dunkel. Folgt der Verbindung.',dark:true,score:1.5},
  {name:'ÜBERLADUNG',text:'Energie lädt schneller, entlädt sich aber ständig.',charge:1.8,drain:4,score:1.25},
  {name:'RÜCKWÄRTS?',text:'Das Chaos dreht die Arena — nicht eure Tasten.',spin:true,score:1.3}
];

function newPlayer(id,x,color,keys){return{id,x,y:H/2,r:18,color,keys,vx:0,vy:0,hp:3,down:false,revive:0,inv:0,pulse:0,trail:[]}}
function freshState(){return{
  running:true,paused:false,time:0,wave:1,waveTime:0,score:0,combo:1,comboClock:0,charge:100,shake:0,flash:0,gameOver:false,modifier:null,lastModifier:-1,
  players:[newPlayer(1,W*.34,'#65f7ff',{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',action:'KeyF'}),newPlayer(2,W*.66,'#ff4fb3',{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',action:'Enter'})],
  enemies:[],orbs:[],particles:[],rings:[],floaters:[],spawnClock:.4,orbClock:3
}}

function readLocalInput(){return state.players.map(p=>({x:(held.has(p.keys.right)?1:0)-(held.has(p.keys.left)?1:0),y:(held.has(p.keys.down)?1:0)-(held.has(p.keys.up)?1:0),action:pressed.has(p.keys.action)}))}
function readOwnInput(){return{x:(held.has('KeyD')||held.has('ArrowRight')?1:0)-(held.has('KeyA')||held.has('ArrowLeft')?1:0),y:(held.has('KeyS')||held.has('ArrowDown')?1:0)-(held.has('KeyW')||held.has('ArrowUp')?1:0),action:pressed.has('KeyF')||pressed.has('Enter')||pressed.has('Space')}}
function beep(freq=220,duration=.06,type='sine',volume=.04){if(!soundOn)return;audio ||= new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}
function burst(x,y,color,count=16,power=230){for(let i=0;i<count;i++){const a=rand(0,TAU),s=rand(30,power);state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.9),max:1,size:rand(2,7),color})}}
function ring(x,y,color,max=130){state.rings.push({x,y,r:8,max,life:1,color})}
function floater(x,y,text,color='#fff',size=18){state.floaters.push({x,y,text,color,size,life:1})}
function circleHit(a,b){return dist(a,b)<a.r+b.r}
function pointLineDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(!l2)return dist(p,a);const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l2,0,1);return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))}

function beginRound(){cancelAnimationFrame(raf);state=freshState();sendClock=0;remoteInput={x:0,y:0,action:false};ui.overlay.classList.add('hidden');ui.pause.classList.add('hidden');ui['copy-score'].disabled=true;ui.status.textContent=mode==='local'?'DIE VERBINDUNG HÄLT':`LAN · SPIELER ${lanSlot}`;last=performance.now();beep(180,.12,'sawtooth',.06);raf=requestAnimationFrame(loop)}
function startLocal(){disconnectLan(true);mode='local';ui.network.classList.add('hidden');ui.lan.disabled=false;ui.lan.textContent='ÜBER WLAN SPIELEN';beginRound()}
function beginGuestRound(){cancelAnimationFrame(raf);state=freshState();state.running=true;guestWave=1;sendClock=0;ui.overlay.classList.add('hidden');ui.pause.classList.add('hidden');ui['copy-score'].disabled=true;ui.status.textContent='LAN · SPIELER 2';last=performance.now();raf=requestAnimationFrame(guestLoop)}

function netSend(message){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message))}
function setLanMessage(title,text){ui['overlay-title'].textContent=title;ui['overlay-text'].innerHTML=text;ui.overlay.classList.remove('hidden')}
function updateRoom(){
  if(mode==='lan-host'&&!state?.running&&!state?.gameOver){const ready=roomPlayers===2;setLanMessage(ready?'Spieler 2 ist verbunden.':'Warte auf Spieler 2 …',ready?'Ihr seid im selben Raum. Starte, wenn ihr beide bereit seid.':'Dein Freund öffnet dieselbe WLAN-Adresse, die im Terminal angezeigt wird.');ui.start.textContent=ready?'LAN-RUNDE STARTEN':'WARTE AUF FREUND';ui.start.disabled=!ready}
  if(mode==='lan-guest'&&!state?.running&&!state?.gameOver){setLanMessage('Verbunden als Spieler 2.','Spieler 1 startet die Runde. Auf deinem Laptop funktionieren WASD oder die Pfeiltasten; Impuls mit F, Enter oder Leertaste.');ui.start.textContent='SPIELER 1 STARTET';ui.start.disabled=true}
}
function connectLan(){
  if(location.protocol==='file:'){setLanMessage('LAN braucht den Spielserver.','Starte im Projektordner <strong>npm install</strong> und danach <strong>npm start</strong>. Öffne anschließend die angezeigte WLAN-Adresse.');return}
  if(socket&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(socket.readyState))return;
  intentionalClose=false;mode='lan-connecting';ui.start.disabled=true;ui.lan.disabled=true;ui.lan.textContent='VERBINDE …';setLanMessage('LAN-Verbindung wird aufgebaut …','Der erste verbundene Laptop wird Spieler 1, der zweite wird Spieler 2.');
  const protocol=location.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(`${protocol}//${location.host}`);
  socket.addEventListener('message',event=>{
    let message;try{message=JSON.parse(event.data)}catch{return}
    if(message.type==='assign'){
      lanSlot=message.slot;ui.network.classList.remove('hidden','bad');ui.network.textContent=lanSlot?`● LAN · P${lanSlot}`:'● ZUSCHAUER';ui.lan.textContent='LAN VERBUNDEN';
      if(lanSlot===1)mode='lan-host';else if(lanSlot===2)mode='lan-guest';else{mode='lan-spectator';setLanMessage('Dieser Raum ist voll.','Zwei Spieler sind bereits verbunden. Schließe einen der anderen Tabs und lade diese Seite neu.')}updateRoom()
    }
    if(message.type==='room'){roomPlayers=message.players;updateRoom()}
    if(message.type==='input'&&mode==='lan-host'){const i=message.input||{};remoteInput={x:Math.max(-1,Math.min(1,Number(i.x)||0)),y:Math.max(-1,Math.min(1,Number(i.y)||0)),action:Boolean(i.action)}}
    if(message.type==='start'){if(mode==='lan-host')beginRound();if(mode==='lan-guest')beginGuestRound()}
    if(message.type==='snapshot'&&mode==='lan-guest'){
      state=message.state;if(state.wave>guestWave&&state.modifier){guestWave=state.wave;ui['announcement-title'].textContent=state.modifier.name;ui['announcement-text'].textContent=state.modifier.text;ui.announcement.classList.remove('hidden');ui.announcement.style.animation='none';void ui.announcement.offsetWidth;ui.announcement.style.animation='cardIn 2.8s both'}
      ui.pause.classList.toggle('hidden',!state.paused);updateUi()
    }
    if(message.type==='gameover'&&mode==='lan-guest'){state=message.state;showGameOver()}
    if(message.type==='host-left'&&mode==='lan-guest'){cancelAnimationFrame(raf);state.running=false;setLanMessage('Spieler 1 hat den Raum verlassen.','Lade beide Seiten neu, um einen neuen LAN-Raum zu starten.');ui.start.disabled=true;ui.network.classList.add('bad')}
  });
  socket.addEventListener('close',()=>{if(intentionalClose)return;cancelAnimationFrame(raf);ui.network.classList.remove('hidden');ui.network.classList.add('bad');ui.network.textContent='● LAN GETRENNT';setLanMessage('LAN-Verbindung getrennt.','Prüfe, ob der Server auf Laptop 1 noch läuft, und lade die Seite neu.');ui.start.disabled=true});
  socket.addEventListener('error',()=>{ui.network.classList.remove('hidden');ui.network.classList.add('bad');ui.network.textContent='● LAN-FEHLER'});
}
function disconnectLan(silent=false){if(socket){intentionalClose=silent;socket.close();socket=null}lanSlot=0;roomPlayers=0}
function handleStart(){if(mode==='lan-host'){if(roomPlayers===2)netSend({type:'start'});return}if(mode==='lan-guest'||mode==='lan-connecting'||mode==='lan-spectator')return;startLocal()}
function spawnEnemy(){const edge=Math.floor(rand(0,4)),m=35;let x=edge===1?W+m:edge===3?-m:rand(0,W),y=edge===0?-m:edge===2?H+m:rand(0,H);const roll=Math.random();state.enemies.push({x,y,r:roll>.87?25:roll>.62?18:13,hp:roll>.87?3:roll>.62?2:1,speed:rand(72,118),type:roll>.87?'tank':roll>.62?'dash':'basic',color:roll>.87?'#ffe66d':'#ff446d',hit:0,phase:rand(0,TAU),dead:false})}
function spawnOrb(){state.orbs.push({x:rand(70,W-70),y:rand(70,H-70),r:10,life:10,phase:rand(0,TAU)})}
function applyModifier(){let next=Math.floor(Math.random()*MODIFIERS.length);if(next===state.lastModifier)next=(next+1)%MODIFIERS.length;state.lastModifier=next;state.modifier={...MODIFIERS[next]};ui['announcement-title'].textContent=state.modifier.name;ui['announcement-text'].textContent=state.modifier.text;ui.announcement.classList.remove('hidden');void ui.announcement.offsetWidth;ui.announcement.style.animation='none';void ui.announcement.offsetWidth;ui.announcement.style.animation='cardIn 2.8s both';beep(110,.25,'square',.05)}

function updatePlayer(p,input,dt){
  if(p.inv>0)p.inv-=dt;if(p.pulse>0)p.pulse-=dt;
  if(p.down){p.vx*=.86;p.vy*=.86;p.x+=p.vx*dt;p.y+=p.vy*dt;return}
  const l=Math.hypot(input.x,input.y)||1,speed=235;p.vx+=(input.x/l*speed-p.vx)*Math.min(1,dt*13);p.vy+=(input.y/l*speed-p.vy)*Math.min(1,dt*13);p.x+=p.vx*dt;p.y+=p.vy*dt;
  p.x=clamp(p.x,p.r+22,W-p.r-22);p.y=clamp(p.y,p.r+22,H-p.r-22);
  if(input.action&&state.charge>=32){state.charge-=32;p.pulse=.35;ring(p.x,p.y,p.color,150*(state.modifier?.pulse||1));burst(p.x,p.y,p.color,22,300);state.shake=8;beep(p.id===1?420:520,.1,'sawtooth',.045);for(const e of state.enemies){if(dist(p,e)<145*(state.modifier?.pulse||1)){const d=dist(p,e)||1;e.x+=(e.x-p.x)/d*55;e.y+=(e.y-p.y)/d*55;damageEnemy(e,1,p.x,p.y)}}}
  p.trail.push({x:p.x,y:p.y,life:.35});if(p.trail.length>16)p.trail.shift()
}
function damageEnemy(e,amount,x,y){if(e.dead||e.hit>0)return;e.hp-=amount;e.hit=.09;burst(e.x,e.y,e.color,7,130);if(e.hp<=0){e.dead=true;const gained=Math.round((90+e.r*3)*state.combo*(state.modifier?.score||1));state.score+=gained;state.combo=clamp(state.combo+.18,1,8);state.comboClock=2.4;state.charge=clamp(state.charge+5,0,100);floater(e.x,e.y,`+${gained}`,e.color,15);burst(e.x,e.y,e.color,18,230);beep(150+state.combo*35,.045,'square',.025)}}
function hurtPlayer(p,e){if(p.inv>0||p.down)return;p.hp--;p.inv=1.15;state.combo=1;state.shake=15;state.flash=.16;const d=dist(p,e)||1;p.vx+=(p.x-e.x)/d*380;p.vy+=(p.y-e.y)/d*380;burst(p.x,p.y,p.color,28,290);beep(75,.18,'sawtooth',.07);if(p.hp<=0){p.down=true;p.revive=0;floater(p.x,p.y,'GEFALLEN!',p.color,24);ring(p.x,p.y,p.color,80)}}

function simulate(dt,inputs){
  state.time+=dt;state.waveTime+=dt;state.shake=Math.max(0,state.shake-dt*35);state.flash=Math.max(0,state.flash-dt);state.charge=clamp(state.charge+dt*2.3*(state.modifier?.charge||1)-dt*(state.modifier?.drain||0),0,100);
  state.players.forEach((p,i)=>updatePlayer(p,inputs[i],dt));const [a,b]=state.players;const d=dist(a,b),max=310,pull=(state.modifier?.pull||1);
  if(d>max){const nx=(b.x-a.x)/d,ny=(b.y-a.y)/d,force=(d-max)*4.6*pull;if(!a.down){a.x+=nx*force*dt;a.y+=ny*force*dt}if(!b.down){b.x-=nx*force*dt;b.y-=ny*force*dt}state.charge=Math.max(0,state.charge-dt*5)}
  // Revive requires the survivor to stay close; moving away resets progress slowly.
  for(const p of state.players.filter(p=>p.down)){const mate=state.players.find(q=>q!==p);if(!mate.down&&dist(p,mate)<92){p.revive+=dt;if(p.revive>=2.2){p.down=false;p.hp=2;p.inv=2;p.revive=0;state.score+=500;ring(p.x,p.y,p.color,180);burst(p.x,p.y,p.color,35,300);floater(p.x,p.y,'RETTUNG +500',p.color,22);beep(660,.2,'sine',.06)}}else p.revive=Math.max(0,p.revive-dt*.45)}
  if(a.down&&b.down)return endGame();

  state.spawnClock-=dt;if(state.spawnClock<=0){spawnEnemy();const base=Math.max(.2,.88-state.wave*.055);state.spawnClock=base*(state.modifier?.spawn||1)}
  state.orbClock-=dt;if(state.orbClock<=0){spawnOrb();state.orbClock=rand(4,7)}
  const living=state.players.filter(p=>!p.down);
  for(const e of state.enemies){e.hit=Math.max(0,e.hit-dt);e.phase+=dt*3;const target=living.reduce((best,p)=>dist(e,p)<dist(e,best)?p:best,living[0]);if(!target)continue;let dx=target.x-e.x,dy=target.y-e.y,l=Math.hypot(dx,dy)||1,mult=(state.modifier?.speed||1)*(e.type==='dash'&&Math.sin(e.phase)>.72?2.4:1);e.x+=dx/l*e.speed*mult*dt;e.y+=dy/l*e.speed*mult*dt;
    if(pointLineDistance(e,a,b)<e.r+5&&d>85)damageEnemy(e,dt>0?1:0,(a.x+b.x)/2,(a.y+b.y)/2);
    for(const p of state.players)if(circleHit(e,p))hurtPlayer(p,e)
  }
  state.enemies=state.enemies.filter(e=>!e.dead);
  for(const o of state.orbs){o.life-=dt;o.phase+=dt*4;for(const p of state.players)if(!p.down&&circleHit(o,p)){o.life=0;state.charge=clamp(state.charge+30,0,100);state.score+=150;floater(o.x,o.y,'ENERGIE +150','#fff',16);burst(o.x,o.y,'#fff',18,220);beep(780,.08,'sine',.035)}}state.orbs=state.orbs.filter(o=>o.life>0);
  if(state.comboClock>0)state.comboClock-=dt;else state.combo=Math.max(1,state.combo-dt*.8);
  if(state.waveTime>=22){state.wave++;state.waveTime=0;state.score+=1000*state.wave;applyModifier();state.enemies.forEach(e=>e.dead=true);state.players.forEach(p=>{if(!p.down)p.hp=Math.min(3,p.hp+1)});state.charge=100}
  updateEffects(dt);updateUi()
}
function updateEffects(dt){for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt}for(const r of state.rings){r.r+=(r.max-r.r)*dt*7;r.life-=dt*1.8}for(const f of state.floaters){f.y-=dt*28;f.life-=dt*.9}state.particles=state.particles.filter(p=>p.life>0);state.rings=state.rings.filter(r=>r.life>0);state.floaters=state.floaters.filter(f=>f.life>0)}
function updateUi(){ui.wave.textContent=state.wave;ui.score.textContent=Math.floor(state.score).toString().padStart(6,'0');ui.combo.textContent=`×${state.combo.toFixed(1)}`}

function drawGrid(){ctx.fillStyle='#070815';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#191c38';ctx.lineWidth=1;const off=(state.time*12)%50;for(let x=-50+off;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=-50+off;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.strokeStyle='#32375f';ctx.strokeRect(22,22,W-44,H-44)}
function drawTether(a,b){const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);g.addColorStop(0,a.color);g.addColorStop(.5,'#fff');g.addColorStop(1,b.color);ctx.save();ctx.lineCap='round';ctx.shadowBlur=22;ctx.shadowColor='#bd83ff';ctx.strokeStyle=g;ctx.lineWidth=state.charge>15?7:3;ctx.globalAlpha=.9;ctx.beginPath();ctx.moveTo(a.x,a.y);const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,wave=Math.sin(state.time*8)*7;ctx.quadraticCurveTo(mx+wave,my-wave,b.x,b.y);ctx.stroke();ctx.globalAlpha=.26;ctx.lineWidth=18;ctx.stroke();ctx.restore()}
function drawPlayer(p){ctx.save();ctx.translate(p.x,p.y);if(p.inv>0&&Math.floor(p.inv*10)%2===0)ctx.globalAlpha=.35;ctx.shadowBlur=25;ctx.shadowColor=p.color;ctx.strokeStyle=p.color;ctx.fillStyle='#0a0c1c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,p.r,0,TAU);ctx.fill();ctx.stroke();ctx.rotate(state.time*(p.id===1?2:-2));ctx.fillStyle=p.color;for(let i=0;i<3;i++){ctx.rotate(TAU/3);ctx.fillRect(p.r+4,-3,8,6)}ctx.restore();if(p.down){ctx.strokeStyle=p.color;ctx.lineWidth=4;ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(p.x,p.y,28+Math.sin(state.time*5)*4,0,TAU);ctx.stroke();if(p.revive>0){ctx.globalAlpha=1;ctx.lineWidth=6;ctx.beginPath();ctx.arc(p.x,p.y,35,-Math.PI/2,-Math.PI/2+TAU*clamp(p.revive/2.2,0,1));ctx.stroke()}ctx.globalAlpha=1}for(let i=0;i<p.hp;i++){ctx.fillStyle=p.color;ctx.fillRect(p.x-18+i*13,p.y+29,9,3)}}
function drawEnemy(e){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.phase);ctx.shadowBlur=15;ctx.shadowColor=e.color;ctx.fillStyle=e.hit>0?'#fff':e.color;const rr=e.r*(state.modifier?.enemySize||1);ctx.beginPath();for(let i=0;i<8;i++){const r=i%2?rr*.55:rr,a=i/8*TAU;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore()}
function render(){ctx.save();if(state.shake)ctx.translate(rand(-state.shake,state.shake),rand(-state.shake,state.shake));drawGrid();const[a,b]=state.players;drawTether(a,b);for(const o of state.orbs){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.phase);ctx.shadowBlur=24;ctx.shadowColor='#fff';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(-8,-8,16,16);ctx.restore()}state.enemies.forEach(drawEnemy);state.players.forEach(drawPlayer);for(const r of state.rings){ctx.globalAlpha=r.life;ctx.strokeStyle=r.color;ctx.lineWidth=5*r.life;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,TAU);ctx.stroke()}for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size)}ctx.textAlign='center';for(const f of state.floaters){ctx.globalAlpha=Math.max(0,f.life);ctx.fillStyle=f.color;ctx.font=`700 ${f.size}px system-ui`;ctx.fillText(f.text,f.x,f.y)}ctx.globalAlpha=1;
  // Energy bar and wave timer
  ctx.fillStyle='#11142c';ctx.fillRect(W/2-150,H-34,300,8);const cg=ctx.createLinearGradient(W/2-150,0,W/2+150,0);cg.addColorStop(0,'#65f7ff');cg.addColorStop(1,'#ff4fb3');ctx.fillStyle=cg;ctx.fillRect(W/2-150,H-34,300*(state.charge/100),8);ctx.fillStyle='#a4a9c8';ctx.font='700 11px system-ui';ctx.fillText('GEMEINSAME IMPULS-ENERGIE',W/2,H-43);ctx.fillStyle='#32375f';ctx.fillRect(22,12,W-44,4);ctx.fillStyle='#ffe66d';ctx.fillRect(22,12,(W-44)*(state.waveTime/22),4);
  if(state.modifier?.dark){const rg=ctx.createRadialGradient((a.x+b.x)/2,(a.y+b.y)/2,60,(a.x+b.x)/2,(a.y+b.y)/2,280);rg.addColorStop(0,'#0000');rg.addColorStop(1,'#000f');ctx.fillStyle=rg;ctx.fillRect(0,0,W,H)}if(state.flash){ctx.fillStyle=`rgba(255,255,255,${state.flash*2})`;ctx.fillRect(0,0,W,H)}ctx.restore()}

function showGameOver(){
  cancelAnimationFrame(raf);const final=Math.floor(state.score),old=Number(localStorage.tetheredChaosHigh||0),high=Math.max(old,final);localStorage.tetheredChaosHigh=high;ui.high.textContent=String(high).padStart(6,'0');ui['overlay-title'].textContent=`Welle ${state.wave}. Verbindung verloren.`;ui['overlay-text'].innerHTML=`Euer Team-Score: <strong>${String(final).padStart(6,'0')}</strong><br>${final>=old&&final>0?'NEUER REKORD — das schreit nach einem Revanche-Video.':'Noch eine Runde. Diesmal ohne Schuldzuweisungen.'}`;ui.start.textContent=mode==='lan-guest'?'SPIELER 1 STARTET':'REVANCHE STARTEN';ui.start.disabled=mode==='lan-guest'||(mode==='lan-host'&&roomPlayers<2);ui.overlay.classList.remove('hidden');ui['copy-score'].disabled=false;ui.status.textContent='VERBINDUNG VERLOREN';beep(55,.5,'sawtooth',.08)
}
function endGame(){state.running=false;state.gameOver=true;if(mode==='lan-host')netSend({type:'gameover',state});showGameOver()}
function loop(now){
  if(!state?.running)return;const dt=Math.min((now-last)/1000,.033);last=now;
  const inputs=mode==='lan-host'?[readOwnInput(),remoteInput]:readLocalInput();if(!state.paused)simulate(dt,inputs);render();
  if(mode==='lan-host'){remoteInput.action=false;sendClock+=dt;if(sendClock>=1/30){sendClock=0;netSend({type:'snapshot',state})}}
  pressed.clear();raf=requestAnimationFrame(loop)
}
function guestLoop(now){
  if(mode!=='lan-guest')return;const dt=Math.min((now-last)/1000,.05);last=now;if(state?.running)render();sendClock+=dt;if(sendClock>=1/30){sendClock=0;netSend({type:'input',input:readOwnInput()})}pressed.clear();raf=requestAnimationFrame(guestLoop)
}

addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Space'].includes(e.code))e.preventDefault();if(!held.has(e.code))pressed.add(e.code);held.add(e.code);if(e.code==='KeyP'&&state?.running&&(mode==='local'||mode==='lan-host')){state.paused=!state.paused;ui.pause.classList.toggle('hidden',!state.paused);last=performance.now();if(mode==='lan-host')netSend({type:'snapshot',state})}});
addEventListener('keyup',e=>held.delete(e.code));
ui.start.addEventListener('click',handleStart);ui.lan.addEventListener('click',connectLan);ui.sound.addEventListener('click',()=>{soundOn=!soundOn;ui.sound.textContent=`TON: ${soundOn?'AN':'AUS'}`});
ui['copy-score'].addEventListener('click',async()=>{const text=`Wir haben in Tethered Chaos Welle ${state.wave} mit ${Math.floor(state.score)} Punkten erreicht. Schafft ihr mehr? #TetheredChaos`;try{await navigator.clipboard.writeText(text);ui['copy-score'].textContent='KOPIERT!';setTimeout(()=>ui['copy-score'].textContent='ERGEBNIS KOPIEREN',1400)}catch{ui['copy-score'].textContent='NICHT MÖGLICH'}});

state=freshState();state.running=false;ui.high.textContent=String(Number(localStorage.tetheredChaosHigh||0)).padStart(6,'0');render();
