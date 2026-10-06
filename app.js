const $=id=>document.getElementById(id);
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const D={hold:10,relax:10,reps:5,sets:2,rest:30,thr:160,arm:'R',voice:'1',alert:'1',mode:'0',calm:8,raise:4,fol:3,goal:4,xth:10.5,name:''};
let S=Object.assign({},D,store.get('S',{}));
const F=[['hold','Hold (sec)',3,60],['relax','Relax (sec)',3,60],['reps','Reps per set',1,30],['sets','Sets',1,10],['rest','Rest (sec)',5,180],['thr','Straight angle ≥',140,178],['calm','Routine: breathe (sec)',2,30],['raise','Routine: raise (sec)',2,15],['fol','Routine: follow-through (sec)',1,10],['goal','Weekly goal (sessions)',1,21]];
const LV=[[5,5],[8,5],[10,6],[12,6],[15,8],[20,8]];
let pose,camOn=false,stream=null,cur={ok:false},run=null,samples=[],facing='user',mirror=true;
// navigation
function show(n){if(n!=='train')leaveTrain();document.querySelectorAll('.view').forEach(s=>s.hidden=s.id!=='v-'+n);document.querySelector('main').scrollTop=0;if(n==='history')drawHist();if(n==='home')homeInfo();if(n==='settings')fill();if(n==='train')$('plan').textContent=(S.mode==='1'?'Shot routine · ':'')+S.hold+'s hold · '+S.relax+'s relax · '+S.reps+' reps × '+S.sets+' sets'}
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)show(b.dataset.go)});
function leaveTrain(){if(run){clearInterval(run.timer);run=null}rel();camStop();try{speechSynthesis.cancel()}catch(e){}}
// settings
const fd=$('fields');F.forEach(f=>{const l=document.createElement('label');l.innerHTML=f[1]+'<input id="f_'+f[0]+'" type="number" min="'+f[2]+'" max="'+f[3]+'">';fd.appendChild(l)});
function fill(){F.forEach(f=>$('f_'+f[0]).value=S[f[0]]);$('f_arm').value=S.arm;$('f_voice').value=S.voice;$('f_alert').value=S.alert;$('f_mode').value=S.mode}
function readS(){F.forEach(f=>{const v=+$('f_'+f[0]).value;if(v>=f[2]&&v<=f[3])S[f[0]]=v});S.arm=$('f_arm').value;S.voice=$('f_voice').value;S.alert=$('f_alert').value;S.mode=$('f_mode').value;store.set('S',S)}
document.querySelectorAll('#v-settings input,#v-settings select').forEach(i=>i.onchange=readS);
LV.forEach((l,i)=>{const b=document.createElement('button');b.textContent='L'+(i+1)+' · '+l[0]+'s×'+l[1];b.onclick=()=>{S.hold=l[0];S.reps=l[1];store.set('S',S);fill();$('lvn').textContent='Level '+(i+1)+' set: '+l[0]+'s holds, '+l[1]+' reps.'};$('lv').appendChild(b)});
function homeInfo(){const ss=store.get('sess',[]),d0=new Date();d0.setHours(0,0,0,0);const wk=new Date(d0);wk.setDate(d0.getDate()-((d0.getDay()+6)%7));
 const n=ss.filter(t=>t>=wk.getTime()).length,days=new Set(ss.map(t=>{const x=new Date(t);x.setHours(0,0,0,0);return x.getTime()}));
 let st=0;const c=new Date(d0);if(!days.has(c.getTime()))c.setDate(c.getDate()-1);while(days.has(c.getTime())){st++;c.setDate(c.getDate()-1)}
 const t=ss.length?'This week '+n+'/'+S.goal+' sessions · Streak '+st+(st===1?' day':' days'):'';$('homeSub').textContent=t;$('homeSub').hidden=!t}
// audio
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
let wl=null;const rel=()=>{try{wl&&wl.release()}catch(e){}wl=null};
let ac;function unlock(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state!=='running')ac.resume()}catch(e){}}
['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev,unlock,{passive:true}));
function beep(f=880,d=.12){try{unlock();const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='square';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+.02)}catch(e){}}
function say(s){if(S.voice!=='1')return;try{const u=new SpeechSynthesisUtterance(s);u.lang='en-IN';speechSynthesis.cancel();setTimeout(()=>speechSynthesis.speak(u),250)}catch(e){}}
// pose
const ang=(a,b,c)=>{const p=[a.x-b.x,a.y-b.y],q=[c.x-b.x,c.y-b.y],m=Math.hypot(...p)*Math.hypot(...q);return m?Math.acos(Math.max(-1,Math.min(1,(p[0]*q[0]+p[1]*q[1])/m)))*180/Math.PI:0};
const ang3=(a,b,c)=>{const p=[a.x-b.x,a.y-b.y,a.z-b.z],q=[c.x-b.x,c.y-b.y,c.z-b.z],m=Math.hypot(...p)*Math.hypot(...q);return m?Math.acos(Math.max(-1,Math.min(1,(p[0]*q[0]+p[1]*q[1]+p[2]*q[2])/m)))*180/Math.PI:0};
function rms(a){const m=a.reduce((s,x)=>s+x,0)/a.length;return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length)}
function steady(sm){if(sm.length<3)return 0;return Math.round(Math.max(0,Math.min(100,100-Math.hypot(rms(sm.map(s=>s.wx)),rms(sm.map(s=>s.wy)))*600)))}
function chip(id,t,ok){const c=$(id);c.textContent=t;c.className='chip'+(ok===true?' g':ok===false?' r':'')}
function onResults(r){
 const cv=$('cv'),v=$('v');cv.width=v.videoWidth;cv.height=v.videoHeight;const x=cv.getContext('2d');x.clearRect(0,0,cv.width,cv.height);
 const L=r.poseLandmarks,msg=$('msg');$('guide').hidden=false;
 if(!L){cur={ok:false};msg.hidden=false;msg.textContent='No body found. Step back so shoulders and arm are visible.';return}
 const R=S.arm==='R',W=cv.width,H=cv.height,P=q=>({x:q.x*W,y:q.y*H});
 const s0=L[R?12:11],e0=L[R?14:13],w0=L[R?16:15];
 if(Math.min(s0.visibility,e0.visibility,w0.visibility)<.5){cur={ok:false};msg.hidden=false;msg.textContent='Arm not clearly visible. Improve light or move back.';return}
 const edge=[s0,e0,w0,L[R?11:12]].some(q=>q.x<.03||q.x>.97||q.y<.03||q.y>.97);
 chip('cTrack','Track '+Math.round(Math.min(s0.visibility,e0.visibility,w0.visibility)*100)+'%');
 msg.hidden=!edge;if(edge)msg.textContent='Arm or shoulder is at the frame edge. Move back or turn the phone.';
 $('guide').hidden=true;
 const s=P(s0),e=P(e0),w=P(w0),o=P(L[R?11:12]);
 const W3=r.poseWorldLandmarks,i0=R?12:11,a=W3?ang3(W3[i0],W3[i0+2],W3[i0+4]):ang(s,e,w),straight=a>=S.thr,sw=Math.max(Math.hypot(s.x-o.x,s.y-o.y),W*.08),level=Math.abs(s.y-o.y)/sw<.15;
 cur={ok:true,ang:a,straight,level,wx:w.x/sw,wy:w.y/sw,mx:(s.x+o.x)/2/sw,t:performance.now()};
 x.lineWidth=5;x.lineCap='round';x.strokeStyle=straight?'#2ecc71':'#ff5a4a';x.beginPath();x.moveTo(s.x,s.y);x.lineTo(e.x,e.y);x.lineTo(w.x,w.y);x.stroke();
 x.strokeStyle=level?'#8fd3ff':'#ffb347';x.beginPath();x.moveTo(s.x,s.y);x.lineTo(o.x,o.y);x.stroke();
 x.fillStyle='#fff';[s,e,w].forEach(q=>{x.beginPath();x.arc(q.x,q.y,6,0,7);x.fill()});
 if(run&&!run.paused&&run.ph==='hold')samples.push({wx:cur.wx,wy:cur.wy,mx:cur.mx});
 chip('cAng',Math.round(a)+'°');chip('cArm',straight?'Straight':'Bent',straight);chip('cSh',level?'Level':'Uneven',level);
 if(run&&run.ph==='hold'&&samples.length>6)chip('cWob','Steady '+steady(samples.slice(-15)));
}
async function camStart(){
 if(camOn)return;
 try{const v=$('v');stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:640,height:480},audio:false});v.srcObject=stream;await v.play();
 pose=pose||new Pose({locateFile:f=>'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/'+f});
 pose.setOptions({modelComplexity:1,smoothLandmarks:true,minDetectionConfidence:.5,minTrackingConfidence:.5});pose.onResults(onResults);
 camOn=true;$('camBtn').textContent='Camera off';$('msg').hidden=false;$('msg').textContent='Loading pose model…';
 const loop=async()=>{if(!camOn)return;try{await pose.send({image:v})}catch(e){}requestAnimationFrame(loop)};loop();
 }catch(e){$('msg').hidden=false;$('msg').textContent='Camera blocked or unavailable. Allow permission, or open this page in your own browser. The timer still works.'}
}
function camStop(){camOn=false;cur={ok:false};if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$('camBtn').textContent='Camera on';$('guide').hidden=true;if($('msg')){$('msg').hidden=false;$('msg').textContent='Camera is off.'}const c=$('cv');c.getContext('2d').clearRect(0,0,c.width,c.height)}
$('camBtn').onclick=()=>camOn?camStop():camStart();
// session
const PH={ready:['GET READY','var(--mute)'],hold:['HOLD','var(--hold)'],calm:['BREATHE','var(--relax)'],raise:['RAISE','var(--hold)'],shot:['PRESS + FOLLOW','var(--ok)'],relax:['RELAX','var(--relax)'],rest:['SET REST','var(--mute)']};
function setPhase(p,sec){run.ph=p;run.left=run.tot=sec;run.zone=0;run.bad=0;run.warned=0;run.drop=false;
 $('ph').textContent=PH[p][0];$('arc').style.stroke=PH[p][1];$('rs').textContent='Set '+run.set+' · Rep '+run.rep;
 const b=$('breath');b.style.transition='none';b.style.transform='scale(.6)';b.style.opacity=(p==='relax'||p==='calm'||p==='raise')?.3:.12;
 if(p==='hold'){samples=[];beep(1000,.2);vib([250]);say(run.c.mode==='1'?'Aim. Breathe out and settle':'Hold')}
 if(p==='shot'){beep(1200,.3);vib([300]);say('Press the trigger. Follow through')}
 if(p==='relax'||p==='calm'||p==='raise'){beep(p==='raise'?800:500,.25);vib([100,80,100]);say(p==='calm'?'Breathe in, and out':p==='raise'?'Breathe in. Raise your arm':'Relax. Breathe in');requestAnimationFrame(()=>{b.style.transition='transform 4s ease-in-out';b.style.transform='scale(1.15)'});run.exh=false}
}
function startSession(){
 if(run)return;readS();$('pause').textContent='Pause';beep(660);$('sumBox').hidden=true;try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(l=>{wl=l}).catch(()=>{})}catch(e){}
 run={set:1,rep:1,res:[],last:performance.now(),c:{mode:S.mode,calm:S.calm,raise:S.raise,fol:S.fol,H:S.hold,Rl:S.relax,reps:S.reps,sets:S.sets,rest:S.rest}};samples=[];
 setPhase('ready',5);say('Get ready');run.timer=setInterval(tick,100);
}
function tick(){
 if(!run)return;if(run.paused){run.last=performance.now();return}const now=performance.now(),dt=Math.min(.5,(now-run.last)/1000);run.last=now;run.left-=dt;
 if(run.ph==='hold'&&cur.ok&&performance.now()-cur.t<600&&cur.straight)run.zone+=dt;
 if(run.ph==='hold'&&S.alert==='1'&&camOn&&cur.ok&&!cur.straight){run.bad+=dt;if(run.bad>=1.5){beep(300,.25);run.bad=-1.5}}else if(run.ph==='hold'&&run.bad>0)run.bad=0;
 if(run.ph==='shot'&&camOn&&cur.ok&&!cur.straight)run.drop=true;
 if((run.ph==='relax'||run.ph==='calm')&&!run.exh&&run.left<=run.tot-4){run.exh=true;const b=$('breath');b.style.transition='transform 6s ease-in-out';b.style.transform='scale(.6)'}
 const L=Math.max(0,run.left);$('t').textContent=Math.ceil(L);$('arc').style.strokeDashoffset=540.4*(1-L/run.tot);
 $('cue').textContent=run.ph!=='hold'?({relax:'Lower the arm and breathe.',calm:'Breathe in slowly, then out. Relax your body.',raise:'Breathe in and raise your arm to the target.',shot:'Press smoothly and keep your arm up. Dry-fire only.'}[run.ph]||'Get into position.'):!camOn?'Camera is off, so only the timer runs.':!cur.ok?'Body not detected.':!cur.straight?'Straighten your arm.':!cur.level?'Arm straight. Level your shoulders.':'Good. Hold steady.';
 if(L<=3&&!run.warned&&(run.ph==='relax'||run.ph==='ready')){run.warned=1;beep(700,.06)}
 if(run.left<=0)next();
}
function finishHold(){
 const c=run.c;let st=null,dr='n/a',sw='n/a';
 if(samples.length>8){st=steady(samples);const k=Math.max(3,Math.floor(samples.length/5)),av=(a,key)=>a.reduce((s,x)=>s+x[key],0)/a.length;
  dr=av(samples.slice(-k),'wy')-av(samples.slice(0,k),'wy')>.15?'Dropped':'Held';sw=rms(samples.map(s=>s.mx))<.06?'Low':'High'}
 run.res.push({id:run.set+'·'+run.rep,pct:camOn?Math.round(run.zone/c.H*100):null,st,dr,sw});
}
function after(){const c=run.c,last=run.rep>=c.reps;if(last&&run.set>=c.sets)return end();if(last){say('Set done. Rest');return setPhase('rest',c.rest)}return setPhase('relax',c.Rl)}
function next(){
 const c=run.c,Rt=c.mode==='1',first=Rt?['calm',c.calm]:['hold',c.H];
 if(run.ph==='ready')return setPhase(...first);
 if(run.ph==='calm')return setPhase('raise',c.raise);
 if(run.ph==='raise')return setPhase('hold',c.H);
 if(run.ph==='hold'){finishHold();return Rt?setPhase('shot',c.fol):after()}
 if(run.ph==='shot'){run.res[run.res.length-1].ft=camOn?(run.drop?'Dropped':'Held'):'n/a';return after()}
 if(run.ph==='relax'){run.rep++;return setPhase(...first)}
 if(run.ph==='rest'){run.set++;run.rep=1;setPhase(...first)}
}
function end(){
 const T=Date.now();rel();clearInterval(run.timer);const r=run.res,c=run.c;beep(900,.4);say('Session complete');
 let msg=r.length+' holds of '+c.H+'s done.';
 const zs=r.filter(x=>x.pct!==null).map(x=>x.pct),ss=r.filter(x=>x.st!==null).map(x=>x.st);
 if(zs.length){const az=Math.round(zs.reduce((a,b)=>a+b,0)/zs.length),as=ss.length?Math.round(ss.reduce((a,b)=>a+b,0)/ss.length):0;
  msg+=' Arm in zone '+az+'%, steadiness '+as+'/100.';
  if(ss.length>=4){const h=ss.length>>1,av=a=>a.reduce((x,y)=>x+y,0)/a.length,d=Math.round(av(ss.slice(-h))-av(ss.slice(0,h)));if(d<=-8)msg+=' Steadiness fell '+(-d)+' points late in the session, so try shorter holds or more rest.';else if(d>=8)msg+=' Steadiness rose '+d+' points as you warmed up.'}
  const h=store.get('hist',[]);h.push({d:T,az,as,hold:c.H,n:r.length});store.set('hist',h.slice(-30));
  if(az>=85&&as>=70){S.hold=Math.min(60,c.H+2);store.set('S',S);msg+=' Strong session. Hold time raised to '+S.hold+'s.'}
  else msg+=' Repeat this level until zone is 85%+ and steadiness 70+.'}
 store.set('last',{d:T,res:r,msg});store.set('sess',[...store.get('sess',[]),Date.now()].slice(-300));
 $('sum').textContent=msg;$('sumBox').hidden=false;$('ph').textContent='DONE';$('t').textContent='✓';$('arc').style.strokeDashoffset=0;run=null;
}
$('go').onclick=startSession;
$('pause').onclick=()=>{if(!run)return;run.paused=!run.paused;$('pause').textContent=run.paused?'Resume':'Pause';if(run.paused){try{speechSynthesis.cancel()}catch(e){}$('cue').textContent='Paused.'}else run.last=performance.now()};
$('stop').onclick=()=>{rel();$('pause').textContent='Pause';if(run){clearInterval(run.timer);run=null;$('ph').textContent='STOPPED';$('t').textContent='--';try{speechSynthesis.cancel()}catch(e){}}};
// history
function drawHist(){const h=store.get('hist',[]),b=$('bars');b.innerHTML='';
 $('tot').innerHTML=[[store.get('sess',[]).length,'Sessions'],[h.length?Math.max(...h.map(x=>x.as)):'-','Best steadiness'],[h.length?Math.round(h.reduce((a,x)=>a+x.az,0)/h.length)+'%':'-','Avg arm in zone']].map(x=>'<div><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('');
 h.slice(-12).forEach(s=>{const d=document.createElement('div');d.style.height=Math.max(3,s.as)+'%';d.title=new Date(s.d).toLocaleDateString()+': steadiness '+s.as+', zone '+s.az+'%';b.appendChild(d)});
 $('hnote').textContent=h.length?h.length+' camera sessions saved. Bars show steadiness (0 to 100).':'No camera sessions saved yet.';
 const l=store.get('last',null),t=$('res');t.innerHTML='';extra(l);
 if(!l){$('lsum').textContent='Finish a session to see per-rep results.';return}
 $('lsum').textContent=new Date(l.d).toLocaleString()+'. '+l.msg;
 l.res.forEach((r,i)=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+r.id+'</td><td>'+(r.pct===null?'n/a':r.pct+'%')+'</td><td>'+(r.st===null?'n/a':r.st)+'</td><td class="'+(r.dr==='Dropped'?'warn':'')+'">'+r.dr+'</td><td class="'+(r.sw==='High'?'warn':'')+'">'+r.sw+'</td><td class="'+(r.ft==='Dropped'?'warn':'')+'">'+(r.ft||'-')+'</td><td><select class="rg" data-i="'+i+'" aria-label="Ring score">'+RG.map(v=>'<option'+(String(r.sc||'')===v?' selected':'')+'>'+v+'</option>').join('')+'</select></td>';t.appendChild(tr)})}
let ck=0;$('clr').onclick=()=>{if(!ck){ck=1;$('clr').textContent='Tap again to confirm';setTimeout(()=>{ck=0;$('clr').textContent='Clear history'},3000);return}ck=0;$('clr').textContent='Clear history';store.set('hist',[]);store.set('last',null);store.set('sess',[]);drawHist()};
$('cpy').onclick=async()=>{const h=store.get('hist',[]),t='date,steadiness,zone,hold_sec,holds\n'+h.map(x=>[new Date(x.d).toISOString().slice(0,10),x.as,x.az,x.hold,x.n].join(',')).join('\n');try{await navigator.clipboard.writeText(t);$('hnote').textContent='Copied '+h.length+' sessions. Paste into Notes or a sheet.'}catch(e){$('hnote').textContent='Copy is blocked here. Open the page in your own browser and try again.'}};
function applyView(){$('cam').classList.toggle('mir',mirror);$('mirBtn').textContent='Mirror: '+(mirror?'on':'off')}
$('mirBtn').onclick=()=>{mirror=!mirror;applyView()};
$('tallBtn').onclick=()=>{const t=$('cam').classList.toggle('tall');$('tallBtn').textContent=t?'Wide view':'Tall view'};
$('flip').onclick=async()=>{facing=facing==='user'?'environment':'user';mirror=facing==='user';applyView();if(camOn){camStop();await camStart()}};
$('cal').onclick=()=>{if(run||!camOn){$('cue').textContent=run?'Stop the session first.':'Turn the camera on first.';return}
 const a=[];let n=0;say('Hold your arm straight');$('cue').textContent='Hold your arm straight for 5 seconds…';
 const id=setInterval(()=>{if(cur.ok)a.push(cur.ang);if(++n>=50){clearInterval(id);
  if(a.length<20){$('cue').textContent='Could not see your arm. Improve framing and try again.';return}
  a.sort((x,y)=>x-y);const m=a[a.length>>1];S.thr=Math.max(140,Math.min(178,Math.round(m-8)));store.set('S',S);
  $('cue').textContent='Calibrated: straight arm now counts at '+S.thr+'° or more (yours read '+Math.round(m)+'°).';beep(900,.2)}},100)};
const PK=['hold','relax','reps','sets','rest','calm','raise','fol','mode'];
function drawPlans(){const P=store.get('plans',[]),b=$('pl');b.innerHTML='';P.forEach((p,i)=>{const w=document.createElement('div');w.className='row';w.style.marginTop='8px';const l=document.createElement('button');l.textContent=p.n+(p.mode==='1'?' · routine':'')+' · '+p.hold+'s×'+p.reps+'×'+p.sets;l.style.flex='1';l.onclick=()=>{PK.forEach(k=>S[k]=p[k]);store.set('S',S);fill()};const x=document.createElement('button');x.textContent='×';x.setAttribute('aria-label','Delete plan');x.onclick=()=>{P.splice(i,1);store.set('plans',P);drawPlans()};w.append(l,x);b.appendChild(w)})}
$('psv').onclick=()=>{readS();const P=store.get('plans',[]),p={n:$('pn').value.trim()||'Plan '+(P.length+1)};PK.forEach(k=>p[k]=S[k]);store.set('plans',[...P,p].slice(-8));$('pn').value='';drawPlans()};
$('snd').onclick=()=>{readS();beep(1000,.2);setTimeout(()=>beep(500,.25),400);setTimeout(()=>say('Sound check'),700)};
const RG=['','6','7','8','9','10','X'];
function syncHist(l){const v=l.res.map(x=>x.sc).filter(Boolean).map(x=>x==='X'?10:+x),h=store.get('hist',[]),e=h.find(x=>x.d===l.d);if(e){e.sc=v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10:null;e.note=l.note||'';store.set('hist',h)}}
function extra(l){$('an').value=S.name||'';const h=store.get('hist',[]),rc=$('rec');rc.innerHTML='';
 h.slice(-8).reverse().forEach(x=>{const tr=document.createElement('tr');[new Date(x.d).toLocaleDateString(),x.as,x.az+'%',x.sc??'-',x.note||''].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});rc.appendChild(tr)});
 const g={};h.filter(x=>x.sc!=null).forEach(x=>{(g[x.hold]=g[x.hold]||[]).push(x.sc)});const k=Object.keys(g).sort((a,b)=>a-b);
 $('byh').textContent=k.length>1?'Average ring by hold length: '+k.map(x=>x+'s → '+Math.round(g[x].reduce((a,b)=>a+b,0)/g[x].length*10)/10+' ('+g[x].length+')').join(' · '):'Log ring scores for two or more hold lengths to compare them here.';
 const f=$('fbars');f.innerHTML='';$('lnote').value=l&&l.note||'';
 if(l)l.res.forEach(r=>{const d=document.createElement('div');d.style.height=Math.max(3,r.st||0)+'%';d.title='Hold '+r.id+': steadiness '+(r.st??'n/a');f.appendChild(d)});
 setTimeout(()=>document.querySelectorAll('.rg').forEach(e=>e.onchange=()=>{const L=store.get('last',null);if(!L)return;L.res[+e.dataset.i].sc=e.value;store.set('last',L);syncHist(L);extra(L)}),0)}
$('lnote').onchange=()=>{const L=store.get('last',null);if(!L)return;L.note=$('lnote').value.trim();store.set('last',L);syncHist(L);extra(L)};
// coach sharing
const enc=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const dec=t=>JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/')))));
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
function mkLink(){S.name=$('an').value.trim();store.set('S',S);const h=store.get('hist',[]).slice(-20);if(!h.length){$('lk').value='';$('hnote').textContent='Finish a session with the camera on first, then create the link.';return ''}
 const u=location.href.split('#')[0]+'#coach='+enc({n:S.name,s:h.map(x=>[x.d,x.az,x.as,x.hold,x.n,x.sc??null,(x.note||'').slice(0,60)])});$('lk').value=u;return u}
$('mk').onclick=mkLink;
$('shr').onclick=async()=>{const u=mkLink();if(!u)return;try{if(navigator.share)await navigator.share({title:'TEN X training',url:u});else{await navigator.clipboard.writeText(u);$('hnote').textContent='Link copied.'}}catch(e){$('lk').select();$('hnote').textContent='Copy the link from the box.'}};
function coachView(t){document.body.classList.add('coachmode');try{const o=dec(t),s=o.s.map(x=>x.map((v,i)=>i===6?String(v||'').slice(0,60):(v==null?null:Number(v))));if(!s.length)throw 0;
 $('cn').textContent=(o.n?String(o.n).slice(0,30)+' · ':'')+s.length+' sessions · read-only';
 const as=s.map(x=>x[2]),az=Math.round(s.reduce((a,x)=>a+x[1],0)/s.length);
 $('ct').innerHTML=[[s.length,'Sessions'],[Math.max(...as),'Best steadiness'],[az+'%','Avg in zone']].map(x=>'<div><b>'+esc(x[0])+'</b><span>'+x[1]+'</span></div>').join('');
 const b=$('cb');b.innerHTML='';as.forEach(v=>{const d=document.createElement('div');d.style.height=Math.max(3,v)+'%';b.appendChild(d)});
 $('cr').innerHTML=s.slice().reverse().map(x=>'<tr>'+[new Date(x[0]).toLocaleDateString(),x[2],x[1]+'%',x[3]+'s×'+x[4],x[5]??'-',x[6]].map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('');show('coach')}
 catch(e){$('cn').textContent='This coach link could not be read.';show('coach')}}
$('cx').addEventListener('click',()=>{history.replaceState(null,'',location.href.split('#')[0]);document.body.classList.remove('coachmode')});
// install
let dp=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;$('inst').hidden=false});
$('inst').onclick=async()=>{if(!dp)return;dp.prompt();try{await dp.userChoice}catch(e){}dp=null;$('inst').hidden=true};
try{if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{})}catch(e){}

// ===== scoring, analysis, modes, mental, nav =====
const NV={home:'home',settings:'settings',train:'settings',score:'score',stats:'stats',history:'stats',mind:'mind'};
const _show=show;show=function(n){_show(n);document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.go===NV[n]));if(n==='home')dash();if(n==='score')renderScore();if(n==='stats')drawStats();if(n==='mind')drawMind();if(n==='profile')fillPf()};
const MODES=[{id:'s10',i:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',n:'10-shot series',len:10,d:'One series of 10, fully scored.'},{id:'s20',i:'<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',n:'20-shot session',len:20,d:'Two series, take your time.'},{id:'s40',i:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',n:'40-shot match',len:40,d:'Four series of 10.'},{id:'s60',i:'<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 21h8M10 17h4"/>',n:'60-shot match',len:60,d:'Six series of 10, full match length.'},{id:'hold',i:'<circle cx="12" cy="6" r="3"/><path d="M12 9v7M7 12h10M9 21l3-5 3 5"/>',n:'Hold / steadiness practice',go:'settings',d:'Timer, shot routine and camera posture check.'},{id:'pb',i:'<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',n:'Personal-best challenge',len:10,pb:1,d:'Beat your best 10-shot series.'}];
const TM={10:12,20:25,40:50,60:75};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,sum=a=>a.reduce((x,y)=>x+y,0);
const sd=a=>{if(a.length<2)return 0;const m=avg(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))};
const f1=x=>(Math.round(x*10)/10).toFixed(1),XT=()=>+S.xth||10.5;
const blocks=a=>{const r=[];for(let i=0;i<a.length;i+=10)r.push(a.slice(i,i+10));return r};
const bestBlock=ses=>{const a=ses.flatMap(x=>blocks(x.shots.map(h=>h.s)).filter(b=>b.length===10).map(sum));return a.length?Math.max(...a):null};
let CS=store.get('cs',null),RR=null,TAB='t',ZM=0,DC=0,ms=-1;
// 10 m air pistol: ring 10 radius 5.75 mm, ring width 8 mm, pellet 4.5 mm. Score by the pellet's inner edge; every ring is split into ten equal zones.
const PR=2.25,R10=5.75,RMAX=77.75;
const pel=(x,y)=>{const r=Math.max(0,Math.hypot(x,y)-PR),e=1e-9;if(r>RMAX+e)return 0;if(r<=R10+e)return(109-Math.min(9,Math.floor(r/(R10/10)+e)))/10;return(99-Math.min(89,Math.floor((r-R10)/.8+e)))/10};
let PV=null;
function startMode(id){const m=MODES.find(x=>x.id===id);if(m.go){show(m.go);return}const mn=S.mt==='1'?(TM[m.len]||0):0;CS={id,n:m.n+(mn?' · timed':''),len:m.len,min:mn,pb:!!m.pb,shots:[],d:Date.now()};RR=null;PV=null;store.set('cs',CS);show('score')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b)startMode(b.dataset.m)});
const MS={s10:'10 shots',s20:'20 shots',s40:'40 shots',s60:'60 shots',hold:'Timer + camera',pb:'Beat your best'};
function addShot(v,x,y){if(!CS||isNaN(v)||v<0||v>10.9)return;PV=null;const h={s:Math.round(v*10)/10};if(x!=null){h.x=Math.round(x*10)/10;h.y=Math.round(y*10)/10}CS.shots.push(h);store.set('cs',CS);if(CS.shots.length>=CS.len)finish();else renderScore()}
function finish(){if(!CS||!CS.shots.length)return;const ses=store.get('ses',[]),sc=CS.shots.map(h=>h.s),tot=sum(sc),same=ses.filter(x=>x.shots.length===sc.length).map(x=>sum(x.shots.map(h=>h.s)));
 RR={n:CS.n,sc,tot,pbPrev:bestBlock(ses),rank:1+same.filter(v=>v>tot).length,of:same.length+1,len:sc.length,pb:CS.pb};
 ses.push({d:CS.d,id:CS.id,n:CS.n,shots:CS.shots});store.set('ses',ses.slice(-150));store.set('sess',[...store.get('sess',[]),Date.now()].slice(-300));CS=null;store.set('cs',null);renderScore()}
function grp(){const p=CS.shots.filter(h=>h.x!=null);if(p.length<2)return '';const mx=avg(p.map(h=>h.x)),my=avg(p.map(h=>h.y));let es=0;p.forEach(a=>p.forEach(b=>es=Math.max(es,Math.hypot(a.x-b.x,a.y-b.y))));
 return '<div class="panel"><b class="d h">Grouping ('+p.length+' shots)</b><p class="note" style="margin:6px 0 0">Group centre (mean point of impact): '+Math.abs(mx).toFixed(1)+' mm '+(mx<0?'left':'right')+' and '+Math.abs(my).toFixed(1)+' mm '+(my>0?'low':'high')+'.<br>Horizontal spread (SD) '+sd(p.map(h=>h.x)).toFixed(1)+' mm · vertical spread (SD) '+sd(p.map(h=>h.y)).toFixed(1)+' mm.<br>Group size '+es.toFixed(1)+' mm.</p></div>'}
function renderScore(){const el=$('sc');
 if(RR){const b=blocks(RR.sc),xs=RR.sc.filter(v=>v>=XT()).length;let run=0;const nb=Math.max(0,...b.filter(x=>x.length===10).map(sum));
  el.innerHTML='<h2>Result</h2><p class="sub">'+RR.n+'</p><div class="stats3"><div><b>'+f1(RR.tot)+'</b><span>Total</span></div><div><b>'+f1(RR.tot/RR.sc.length)+'</b><span>Average</span></div><div><b>'+xs+'</b><span>Inner tens</span></div></div><div class="panel"><table><thead><tr><th>Series</th><th>Shots</th><th>Total</th><th>Running</th></tr></thead><tbody>'+b.map((x,i)=>{run+=sum(x);return '<tr><td>'+(i+1)+'</td><td>'+x.length+'</td><td>'+f1(sum(x))+'</td><td>'+f1(run)+'</td></tr>'}).join('')+'</tbody></table><p class="note" style="margin:8px 0 0">Rank among your own '+RR.len+'-shot sessions: #'+RR.rank+' of '+RR.of+'.'+(RR.pb?(RR.pbPrev==null?' First 10-shot series logged.':nb>RR.pbPrev?' New personal best! Previous best '+f1(RR.pbPrev)+'.':' Personal best to beat: '+f1(RR.pbPrev)+'.'):'')+'</p></div><div class="row"><button class="p" data-go="home">Home</button><button data-go="stats">See analysis</button></div>';return}
 if(!CS){el.innerHTML='<h2 style="margin-bottom:6px">Match</h2><p class="sub">Choose a mode, then score each shot on the target or the keypad.</p><div class="row" style="justify-content:flex-start;margin:0 0 12px"><button id="mt">Match timer: '+(S.mt==='1'?'On':'Off')+'</button></div><div class="mg">'+MODES.filter(m=>!m.go).map(m=>'<button class="mc" data-m="'+m.id+'"><svg viewBox="0 0 24 24">'+m.i+'</svg><b>'+m.n+'</b><span>'+MS[m.id]+(S.mt==='1'&&TM[m.len]?' · '+TM[m.len]+' min':'')+'</span></button>').join('')+'</div><p class="note" style="margin-top:12px">The timer allows 12, 25, 50 and 75 minutes for 10, 20, 40 and 60 shots. Hold and steadiness practice with the camera is in the Train tab.</p>';$('mt').onclick=()=>{S.mt=S.mt==='1'?'0':'1';store.set('S',S);renderScore()};return}
 const sc=CS.shots.map(h=>h.s),t=sum(sc),xs=sc.filter(v=>v>=XT()).length;
 let h='<div class="top"><h2>'+CS.n+'</h2></div><div class="stats3"><div><b>'+sc.length+'/'+CS.len+'</b><span>Shots</span></div><div><b>'+f1(t)+'</b><span>Total</span></div><div><b>'+(sc.length?f1(t/sc.length):'-')+'</b><span>Average · X '+xs+'</span></div></div>';
 if(CS.min)h+='<p class="cue" id="tm"></p>';
 if(CS.pb){const pb=bestBlock(store.get('ses',[]));h+='<p class="cue">'+(pb==null?'No 10-shot best yet. Set one.':'Beat '+f1(pb)+'. Pace after '+sc.length+' shots: '+f1(pb/10*sc.length)+'.')+'</p>'}
 h+='<div class="row" style="margin-bottom:10px"><button id="tt" class="'+(TAB==='t'?'p':'')+'">Target</button><button id="tk" class="'+(TAB==='k'?'p':'')+'">Keypad</button></div>';
 if(TAB==='t')h+=tgtHTML(); else h+='<div class="row"><input id="ks" type="number" inputmode="decimal" step="0.1" min="0" max="10.9" placeholder="Score, e.g. 10.3" style="max-width:200px"><button class="p" id="ka">Add shot</button></div>';
 h+='<p class="note" style="text-align:center;margin-top:10px">'+(sc.slice(-10).map(f1).join(' · ')||'No shots yet')+'</p>'+grp()+'<div class="row"><button id="ud">Undo</button><button id="fn" class="p">Finish</button><button id="ds">Discard</button></div>';
 el.innerHTML=h;$('tt').onclick=()=>{TAB='t';renderScore()};$('tk').onclick=()=>{TAB='k';renderScore()};
 tgtBind();
 if($('ka')){$('ka').onclick=()=>{addShot(parseFloat($('ks').value))};$('ks').onkeydown=e=>{if(e.key==='Enter')$('ka').click()};$('ks').focus()}
 $('ud').onclick=()=>{CS.shots.pop();store.set('cs',CS);renderScore()};$('fn').onclick=finish;
 $('ds').onclick=()=>{if(!DC){DC=1;$('ds').textContent='Tap again to discard';setTimeout(()=>{DC=0;if($('ds'))$('ds').textContent='Discard'},3000);return}DC=0;CS=null;store.set('cs',null);show('home')};tmTick()}
const ZSP=[170,68,34],ZN=['Zoom to centre','Zoom closer','Full target'],RGS=[77.75,69.75,61.75,53.75,45.75,37.75,29.75,21.75,13.75,5.75];
function tgtHTML(){const v=ZSP[ZM],o=-v/2;
 let g='<svg id="tg" viewBox="'+o+' '+o+' '+v+' '+v+'" style="width:100%;max-width:440px;display:block;margin:0 auto;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:12px;background:#efeee8"><circle r="80" fill="#efeee8"/><circle r="29.75" fill="#14181c"/>';
 g+=RGS.map(r=>'<circle r="'+r+'" fill="none" stroke="'+(r<=29.75?'#efeee8':'#14181c')+'" stroke-width=".5"/>').join('')+'<circle r="2.5" fill="none" stroke="#efeee8" stroke-width=".4"/>';
 for(let k=1;k<=9;k++){const m=73.75-8*(k-1),c=k>=7?'#efeee8':'#14181c';[[m,0],[-m,0],[0,m],[0,-m]].forEach(q=>{g+='<text x="'+q[0]+'" y="'+q[1]+'" text-anchor="middle" dominant-baseline="central" font-size="4.6" font-weight="700" font-family="Barlow,sans-serif" fill="'+c+'" opacity=".85">'+k+'</text>'})}
 const sh=CS.shots.filter(q=>q.x!=null);
 g+=sh.map((q,i)=>'<circle cx="'+q.x+'" cy="'+q.y+'" r="2.25" fill="#ff5a4a" stroke="'+(i===sh.length-1?'#ffd23f':'#fff')+'" stroke-width="'+(i===sh.length-1?.7:.4)+'"/>').join('');
 g+='<g id="pvm" style="display:none"><circle r="2.25" fill="#ffd23f" fill-opacity=".25" stroke="#ffd23f" stroke-width=".5"/><path d="M-6 0H-2.6M2.6 0H6M0 -6V-2.6M0 2.6V6" stroke="#ffd23f" stroke-width=".4"/><circle r=".35" fill="#ffd23f"/></g></svg>';
 g+='<div class="panel" style="text-align:center;margin:10px 0 8px"><b class="d" id="pvs" style="font-size:48px;line-height:1;display:block">–</b><span class="note" id="pvd"></span></div>';
 g+='<div class="row" style="margin-bottom:8px"><button id="nL" aria-label="Nudge left">←</button><button id="nU" aria-label="Nudge up">↑</button><button id="nD" aria-label="Nudge down">↓</button><button id="nR" aria-label="Nudge right">→</button></div>';
 g+='<div class="row" style="margin-bottom:8px"><button class="p" id="pvc">Confirm shot</button><button id="pvx">Clear</button><button id="zm">'+ZN[ZM]+'</button></div>';
 g+='<p class="note" style="text-align:center">Touch or drag to place the shot, nudge it with the arrows, then confirm. The yellow circle is the true pellet size (4.5 mm). Scored by the pellet\u2019s inner edge on 10 m air pistol rings, each ring split into ten equal zones. Check it against your range\u2019s scoring.</p>';
 return g}
function upPV(){const m=$('pvm');if(!m)return;const has=!!PV;m.style.display=has?'':'none';$('pvc').disabled=!has;$('pvx').disabled=!has;
 if(has){m.setAttribute('transform','translate('+PV.x+' '+PV.y+')');const sc=pel(PV.x,PV.y),d=Math.hypot(PV.x,PV.y);$('pvs').textContent=f1(sc);$('pvd').textContent=(sc===0?'Miss · ':'')+d.toFixed(1)+' mm from centre'+(sc>=XT()?' · inner ten':'')}
 else{$('pvs').textContent='–';$('pvd').textContent='Touch the target to place the shot'}}
function tgtBind(){const g=$('tg');if(!g)return;let dn=false;
 const pos=e=>{const b=g.getBoundingClientRect(),v=ZSP[ZM];return{x:Math.round(((e.clientX-b.left)/b.width*v-v/2)*10)/10,y:Math.round(((e.clientY-b.top)/b.height*v-v/2)*10)/10}};
 g.onpointerdown=e=>{dn=true;try{g.setPointerCapture(e.pointerId)}catch(x){}PV=pos(e);upPV();e.preventDefault()};
 g.onpointermove=e=>{if(dn){PV=pos(e);upPV()}};
 g.onpointerup=g.onpointercancel=()=>{dn=false};
 const nd=(dx,dy)=>{if(!PV)return;const st=ZM===2?.25:.5;PV={x:Math.round((PV.x+dx*st)*100)/100,y:Math.round((PV.y+dy*st)*100)/100};upPV()};
 $('nL').onclick=()=>nd(-1,0);$('nR').onclick=()=>nd(1,0);$('nU').onclick=()=>nd(0,-1);$('nD').onclick=()=>nd(0,1);
 $('pvx').onclick=()=>{PV=null;upPV()};
 $('pvc').onclick=()=>{if(PV){const q=PV;addShot(pel(q.x,q.y),q.x,q.y)}};
 $('zm').onclick=()=>{ZM=(ZM+1)%3;renderScore()};
 upPV()}
function tmTick(){const t=$('tm');if(!t||!CS||!CS.min)return;const r=CS.min*60-(Date.now()-CS.d)/1000;t.textContent=r>0?'Time left '+Math.floor(r/60)+':'+String(Math.floor(r%60)).padStart(2,'0'):'Time is up. Finish when ready.'}
setInterval(tmTick,1000);
function dash(){const ses=store.get('ses',[]),all=ses.flatMap(x=>x.shots.map(h=>h.s)),m=avg(all),sa=ses.map(x=>avg(x.shots.map(h=>h.s))),pb=bestBlock(ses),H=new Date().getHours();
 $('gd').textContent=(H<12?'Good morning':H<17?'Good afternoon':'Good evening')+' · '+new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'});$('gh').textContent=S.name||'Ready to shoot?';
 const pm=MODES.find(x=>x.id===['s20','hold','s10','s40','hold','pb','s60'][new Date().getDay()]);$('tpn').textContent=pm.n;$('tp').textContent=pm.d;$('tpGo').onclick=()=>startMode(pm.id);$('rnd').onclick=()=>startMode(['s10','s20','s40','s60','pb','hold'][Math.floor(Math.random()*6)]);
 const ss=store.get('sess',[]),d0=new Date();d0.setHours(0,0,0,0);const wk=new Date(d0);wk.setDate(d0.getDate()-((d0.getDay()+6)%7));const n=ss.filter(t=>t>=wk.getTime()).length,days=new Set(ss.map(t=>{const x=new Date(t);x.setHours(0,0,0,0);return x.getTime()}));let st=0;const c=new Date(d0);if(!days.has(c.getTime()))c.setDate(c.getDate()-1);while(days.has(c.getTime())){st++;c.setDate(c.getDate()-1)}
 const g=S.goal||4,C=2*Math.PI*26;$('wkr').setAttribute('stroke-dasharray',(C*Math.min(1,n/g)).toFixed(1)+' '+C.toFixed(1));$('wkn').textContent=n+'/'+g;$('wkt').textContent=n>=g?'Weekly goal reached':(g-n)+' more '+(g-n===1?'session':'sessions')+' to reach your weekly goal';$('wks').textContent='Streak '+st+(st===1?' day':' days');
 $('dash').innerHTML=[[all.length?f1(m):'–','Average'],[pb==null?'–':f1(pb),'Best 10'],[all.length,'Shots']].map(x=>'<div><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('');
 const tr=sa.length>=4?avg(sa.slice(-3))-avg(sa.slice(-6,-3)):null;$('dtl').textContent=all.length?'Consistency '+Math.round(all.filter(v=>Math.abs(v-m)<=.5).length/all.length*100)+'% · Inner tens '+all.filter(v=>v>=XT()).length+(tr==null?'':' · Trend '+(tr>=0?'+':'')+f1(tr)):'Score your first session to fill these in.';
 $('trendp').hidden=!sa.length;$('trend').innerHTML=sa.slice(-12).map(v=>'<div style="height:'+Math.max(3,Math.min(100,(v-5)/5.9*100))+'%" title="'+f1(v)+'"></div>').join('');
 $('trn').textContent='Session averages, latest on the right. Best totals: '+[10,20,40,60].map(L=>{const t=ses.filter(x=>x.shots.length===L).map(x=>sum(x.shots.map(h=>h.s)));return L+'-shot '+(t.length?f1(Math.max(...t)):'–')}).join(' · ')+'. Consistency = shots within 0.5 of your average. Trend = last 3 sessions vs the 3 before.'}
homeInfo=function(){};
function drawStats(){const ses=store.get('ses',[]),el=$('stx');
 if(!ses.length){el.innerHTML='<h2>Shot analysis</h2><p class="note">Score a session in the Match tab to see averages, spread, distribution and trends here.</p><div class="row" style="justify-content:flex-start"><button class="p" data-go="home">Choose a mode</button><button data-go="history">Hold-drill progress</button></div>';return}
 const all=ses.flatMap(x=>x.shots.map(h=>h.s)),m=avg(all),fl=ses.flatMap(x=>blocks(x.shots.map(h=>h.s)).filter(b=>b.length===10)),bl=fl.map(sum),fa=fl.length?avg(fl.map(b=>b[0])):null,la=fl.length?avg(fl.map(b=>b[9])):null;
 const dist=[['<7',v=>v<7],['7',v=>v>=7&&v<8],['8',v=>v>=8&&v<9],['9',v=>v>=9&&v<10],['10',v=>v>=10]].map(([k,fn])=>[k,all.filter(fn).length]),mx=Math.max(...dist.map(d=>d[1]),1),sa=ses.map(x=>avg(x.shots.map(h=>h.s)));
 const T=x=>'<div><b>'+x[0]+'</b><span>'+x[1]+'</span></div>';
 el.innerHTML='<h2 style="margin-bottom:12px">Shot analysis</h2><div class="stats3">'+[[all.length,'Shots'],[f1(m),'Average'],[f1(sd(all)),'Std deviation'],[bl.length?f1(Math.max(...bl)):'-','Best series'],[bl.length?f1(Math.min(...bl)):'-','Worst series'],[all.filter(v=>v>=XT()).length,'Inner tens'],[fa==null?'-':f1(fa),'First-shot avg'],[la==null?'-':f1(la),'Last-shot avg'],[Math.round(all.filter(v=>Math.abs(v-m)<=.5).length/all.length*100)+'%','Consistency']].map(T).join('')+'</div>'
 +'<p class="note">'+(fa==null?'First vs last shot needs a full 10-shot series.':'First vs last shot of each 10-shot series: '+f1(fa)+' vs '+f1(la)+' ('+(la-fa>=0?'+':'')+f1(la-fa)+').')+' Series are blocks of 10 shots.</p>'
 +'<div class="panel"><b class="d h">Score distribution</b><div class="bars" style="height:90px;margin-top:8px">'+dist.map(d=>'<div style="height:'+Math.max(3,d[1]/mx*100)+'%" title="'+d[1]+' shots"></div>').join('')+'</div><div class="lab">'+dist.map(d=>'<span>'+d[0]+'<br>'+d[1]+'</span>').join('')+'</div></div>'
 +'<div class="panel"><b class="d h">Progress over time</b><div class="bars" style="margin-top:8px">'+sa.slice(-12).map(v=>'<div style="height:'+Math.max(3,Math.min(100,(v-5)/5.9*100))+'%" title="'+f1(v)+'"></div>').join('')+'</div><p class="note" style="margin:6px 0 0">Average score per session, latest on the right.</p></div>'
 +'<div class="panel"><b class="d h">Performance by session</b><table><thead><tr><th>Date</th><th>Mode</th><th>Shots</th><th>Avg</th><th>Total</th></tr></thead><tbody>'+ses.slice(-10).reverse().map(x=>{const q=x.shots.map(h=>h.s);return '<tr><td>'+new Date(x.d).toLocaleDateString()+'</td><td>'+x.n+'</td><td>'+q.length+'</td><td>'+f1(avg(q))+'</td><td>'+f1(sum(q))+'</td></tr>'}).join('')+'</tbody></table></div><button data-go="history">Hold-drill progress and coach link</button>'}
const ST=[['Stance','Feet set, weight even, body relaxed and facing the target line.'],['Grip check','Same grip every shot. Firm, not tight. Wrist in line with the forearm.'],['Breathing','One or two slow breaths to relax your body, then breathe in.'],['Raise','Raise the arm smoothly while you breathe in.'],['Settle','Breathe out and let the sights settle. Do not force it.'],['Sight alignment','Focus on the front sight. Keep it level and centred in the rear notch.'],['Trigger control','Press smoothly and straight back at the natural pause.'],['Follow-through','Keep the position after the shot. Do not move early.']];
function drawMind(){const el=$('mn'),L=store.get('mind',[]);let h='<h2 style="margin-bottom:8px">Mental training</h2>';
 if(ms<0)h+='<p class="sub">Run the same pre-shot routine before every shot. Eight steps, one at a time.</p><div class="panel"><ol class="guide">'+ST.map(x=>'<li><b>'+x[0]+'</b>: '+x[1]+'</li>').join('')+'</ol></div><div class="stats3" style="grid-template-columns:1fr 1fr"><div><b>'+L.length+'</b><span>Routines run</span></div><div><b>'+(L.length?f1(avg(L.map(x=>x.r))):'-')+'</b><span>Avg focus (1 to 5)</span></div></div><button class="p" id="mgo" style="width:100%">Run the routine</button><p class="note">These are common technique cues, not a replacement for a coach.</p>';
 else if(ms<ST.length)h+='<div class="panel" style="text-align:center"><p class="note" style="margin:0">Step '+(ms+1)+' of '+ST.length+'</p><div class="big" style="font-size:46px;margin:8px 0">'+ST[ms][0]+'</div><p style="margin:0 0 14px">'+ST[ms][1]+'</p><div class="row"><button id="mback">Back</button><button class="p" id="mnext">'+(ms===ST.length-1?'Done':'Next')+'</button></div></div>';
 else h+='<div class="panel"><b class="d h">How was your focus?</b><div class="row" style="margin-top:10px">'+[1,2,3,4,5].map(n=>'<button data-r="'+n+'">'+n+'</button>').join('')+'</div></div>';
 el.innerHTML=h;if($('mgo'))$('mgo').onclick=()=>{ms=0;drawMind()};if($('mnext'))$('mnext').onclick=()=>{ms++;drawMind()};if($('mback'))$('mback').onclick=()=>{ms=Math.max(-1,ms-1);drawMind()};
 el.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{store.set('mind',[...L,{d:Date.now(),r:+b.dataset.r}].slice(-200));ms=-1;drawMind()})}
const PS='<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';const av=()=>{if(S.name)$('pf').textContent=S.name[0].toUpperCase();else $('pf').innerHTML=PS};
const ALLK=['S','ses','sess','hist','last','mind','plans','cs'];
const dstart=t=>{const x=new Date(t);x.setHours(0,0,0,0);return x.getTime()};
const fdate=t=>new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
function pfStats(){
 const ses=store.get('ses',[]),sess=store.get('sess',[]),hist=store.get('hist',[]),mind=store.get('mind',[]),all=ses.flatMap(x=>x.shots.map(h=>h.s));
 const days=[...new Set(sess.map(dstart))].sort((a,b)=>a-b);let longest=0,run=0;
 days.forEach((d,i)=>{run=(i&&Math.round((d-days[i-1])/864e5)===1)?run+1:1;longest=Math.max(longest,run)});
 const ds=new Set(days);let cur=0;const c=new Date();c.setHours(0,0,0,0);if(!ds.has(c.getTime()))c.setDate(c.getDate()-1);while(ds.has(c.getTime())){cur++;c.setDate(c.getDate()-1)}
 let b10=null;ses.forEach(x=>blocks(x.shots.map(h=>h.s)).filter(b=>b.length===10).forEach(b=>{const t=sum(b);if(!b10||t>b10.v)b10={v:t,d:x.d}}));
 const bl={};[20,40,60].forEach(L=>ses.filter(x=>x.shots.length===L).forEach(x=>{const t=sum(x.shots.map(h=>h.s));if(!bl[L]||t>bl[L].v)bl[L]={v:t,d:x.d}}));
 let ba=null;ses.filter(x=>x.shots.length>=10).forEach(x=>{const a=avg(x.shots.map(h=>h.s));if(!ba||a>ba.v)ba={v:a,d:x.d}});
 const wk=new Date();wk.setHours(0,0,0,0);wk.setDate(wk.getDate()-((wk.getDay()+6)%7));
 return{ses,all,mind,hist,longest,cur,b10,bl,ba,wkn:sess.filter(t=>t>=wk.getTime()).length,avg:all.length?avg(all):null}}
const BD=[['First session','Score one session',s=>s.ses.length>=1],['100 shots','Shots scored in total',s=>s.all.length>=100],['500 shots','Shots scored in total',s=>s.all.length>=500],['1000 shots','Shots scored in total',s=>s.all.length>=1000],['7-day streak','Train 7 days running',s=>s.longest>=7],['90+ series','10 shots totalling 90',s=>!!s.b10&&s.b10.v>=90],['95+ series','10 shots totalling 95',s=>!!s.b10&&s.b10.v>=95],['100+ series','10 shots totalling 100',s=>!!s.b10&&s.b10.v>=100],['Mind training','Run 10 routines',s=>s.mind.length>=10],['Hold drills','Finish 20 hold sessions',s=>s.hist.length>=20]];
function matchText(){if(!S.md)return '';const t=new Date(S.md+'T00:00:00');if(isNaN(t))return '';const d0=new Date();d0.setHours(0,0,0,0);const n=Math.round((t-d0)/864e5);if(n<0)return '';return (S.mn||'Match')+': '+(n===0?'today':n===1?'tomorrow':'in '+n+' days ('+fdate(t)+')')}
function pfRender(){
 const s=pfStats(),nm=S.name||'Shooter';
 $('pnm').textContent=nm;$('pav').textContent=nm[0].toUpperCase();
 $('pln').textContent=[S.disc,S.club,S.coach?'Coach '+S.coach:''].filter(Boolean).join(' · ')||'Add your event and club below';
 $('pst').innerHTML=[[s.ses.length,'Sessions'],[s.all.length,'Shots'],[s.avg==null?'–':f1(s.avg),'Average'],[s.b10?f1(s.b10.v):'–','Best 10'],[s.cur,'Day streak'],[s.hist.length,'Hold drills']].map(x=>'<div><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('');
 const mt=matchText(),mc=$('pmc');mc.hidden=!mt;mc.innerHTML='<b class="d h"></b>';mc.firstChild.textContent=mt;
 let g='This week: '+s.wkn+' of '+(S.goal||4)+' sessions.';
 if(S.tgt){if(s.avg==null)g+=' Target average '+f1(S.tgt)+'.';else{const d=S.tgt-s.avg;g+=' Average '+f1(s.avg)+' against a target of '+f1(S.tgt)+(d>0?', '+f1(d)+' to go.':'. Target reached.')}}
 $('pgl').textContent=g;
 const R=[];if(s.b10)R.push(['Best 10-shot series',f1(s.b10.v),fdate(s.b10.d)]);[20,40,60].forEach(L=>{if(s.bl[L])R.push(['Best '+L+'-shot session',f1(s.bl[L].v),fdate(s.bl[L].d)])});if(s.ba)R.push(['Best session average',f1(s.ba.v),fdate(s.ba.d)]);if(s.longest)R.push(['Longest streak',s.longest+(s.longest===1?' day':' days'),'']);
 const tb=$('pbt');tb.innerHTML='';if(!R.length){tb.innerHTML='<tr><td class="note">Score a session in the Match tab to set your first best.</td></tr>'}
 R.forEach(r=>{const tr=document.createElement('tr');r.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i===1)td.style.fontWeight='700';if(i===2)td.className='note';tr.appendChild(td)});tb.appendChild(tr)});
 const bd=$('pbd');bd.innerHTML='';BD.forEach(b=>{const d=document.createElement('div'),ok=b[2](s);if(!ok)d.className='off';const t=document.createElement('b'),u=document.createElement('span');t.textContent=b[0];u.textContent=ok?'Earned':b[1];d.appendChild(t);d.appendChild(u);bd.appendChild(d)})}
function fillPf(){$('pf_n').value=S.name||'';$('pf_g').value=S.goal;$('pf_x').value=S.xth;$('pf_a').value=S.arm;$('pf_d').value=S.disc||'';$('pf_c').value=S.club||'';$('pf_co').value=S.coach||'';$('pf_ge').value=S.gear||'';$('pf_t').value=S.tgt||'';$('pf_mn').value=S.mn||'';$('pf_md').value=S.md||'';pfRender()}
['pf_n','pf_g','pf_x','pf_a','pf_d','pf_c','pf_co','pf_ge','pf_t','pf_mn','pf_md'].forEach(i=>$(i).onchange=()=>{S.name=$('pf_n').value.trim();S.goal=Math.min(21,Math.max(1,+$('pf_g').value||4));S.xth=Math.min(10.9,Math.max(10,+$('pf_x').value||10.5));S.arm=$('pf_a').value;S.disc=$('pf_d').value;S.club=$('pf_c').value.trim();S.coach=$('pf_co').value.trim();S.gear=$('pf_ge').value.trim();const t=+$('pf_t').value;S.tgt=t?Math.min(10.9,Math.max(5,t)):0;S.mn=$('pf_mn').value.trim();S.md=$('pf_md').value;store.set('S',S);av();pfRender()});
function bk(){const o={app:'TEN X',v:1,t:Date.now(),data:{}};ALLK.forEach(k=>{const v=store.get(k,null);if(v!==null)o.data[k]=v});return JSON.stringify(o)}
function reloadAll(){S=Object.assign({},D,store.get('S',{}));fill();drawPlans();dash();av();fillPf()}
$('pf_ex').onclick=()=>{const j=bk(),n='tenx-backup-'+new Date().toISOString().slice(0,10)+'.json';try{const u=URL.createObjectURL(new Blob([j],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=n;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);$('pdn').textContent='Backup saved as '+n+'.'}catch(e){(navigator.clipboard?navigator.clipboard.writeText(j):Promise.reject()).then(()=>$('pdn').textContent='Download blocked. Backup copied to the clipboard instead.').catch(()=>$('pdn').textContent='Export is blocked here. Open the page in your own browser.')}};
$('pf_im').onclick=()=>$('pf_fi').click();
$('pf_fi').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!o||o.app!=='TEN X'||typeof o.data!=='object')throw 0;if(!confirm('Replace the data on this device with this backup?'))return;ALLK.forEach(k=>{if(o.data[k]!==undefined)store.set(k,o.data[k]);else try{localStorage.removeItem(k)}catch(x){}});reloadAll();$('pdn').textContent='Backup restored.'}catch(x){$('pdn').textContent='That file is not a TEN X backup.'}};r.readAsText(f)};
let pck=0;$('pf_cl').onclick=()=>{if(!pck){pck=1;$('pf_cl').textContent='Tap again to erase everything';setTimeout(()=>{pck=0;$('pf_cl').textContent='Clear all data'},3000);return}pck=0;$('pf_cl').textContent='Clear all data';ALLK.forEach(k=>{try{localStorage.removeItem(k)}catch(x){}});S=Object.assign({},D);fill();drawPlans();dash();av();fillPf();$('pdn').textContent='All data cleared.'};
const _dash=dash;dash=function(){_dash();const t=matchText(),e=$('mcd');if(e){e.textContent=t;e.hidden=!t}};

// back button handling
let CV='home',navOn=true,exArm=0;
history.replaceState({root:1},'');history.pushState({v:'home'},'');
const _s2=show;show=function(n){_s2(n);if(navOn&&n!==CV)history.pushState({v:n},'');CV=n};
function toast(t){const e=$('toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2000)}
addEventListener('popstate',e=>{const v=e.state&&e.state.v;navOn=false;
 if(v){show(v)}else{if(exArm){navOn=true;history.back();return}exArm=1;setTimeout(()=>exArm=0,2000);toast('Press back again to exit');history.pushState({v:'home'},'');show('home')}
 navOn=true});
fill();homeInfo();drawPlans();if(location.hash.startsWith('#coach='))coachView(location.hash.slice(7));
dash();av();
