(function(){
'use strict';
/* ---------- helpers ---------- */
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var r2=function(n){return Math.round((+n||0)*100)/100};
var num=function(v){var n=parseFloat(String(v==null?'':v).replace(/,/g,''));return isFinite(n)?n:0};
var m=function(n){n=r2(n);var a=Math.abs(n);var s=a.toLocaleString('en-PH',{minimumFractionDigits:Number.isInteger(a)?0:2,maximumFractionDigits:2});return (n<0?'-':'')+'₱'+s};
var pm=function(n){n=r2(n);return (n<0?'-':'')+'PHP '+Math.abs(n).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})};
var uid=function(){return Math.random().toString(36).slice(2,9)};
var pad=function(n){return String(n).padStart(2,'0')};
var iso=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
var parse=function(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])};
var today=function(){return iso(new Date())};
var dim=function(y,mm){return new Date(y,mm,0).getDate()};
var fmtDate=function(s,wd){return parse(s).toLocaleDateString('en-PH',wd?{weekday:'short',month:'short',day:'numeric'}:{month:'short',day:'numeric'})};
var monthLabel=function(k){var p=k.split('-');return new Date(+p[0],+p[1]-1,1).toLocaleDateString('en-PH',{month:'long'})};
var prevMonth=function(k){var p=k.split('-').map(Number);var y=p[0],mm=p[1]-1;if(mm<1){mm=12;y--}return y+'-'+pad(mm)};
var nextMonth=function(k){var p=k.split('-').map(Number);var y=p[0],mm=p[1]+1;if(mm>12){mm=1;y++}return y+'-'+pad(mm)};
var dueDate=function(k,day){var p=k.split('-').map(Number);return p[0]+'-'+pad(p[1])+'-'+pad(Math.min(day||1,dim(p[0],p[1])))};
var daysBetween=function(a,b){return Math.round((parse(b)-parse(a))/864e5)};
var ord=function(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
var addDay=function(ds){var d=parse(ds);d.setDate(d.getDate()+1);return iso(d)};

var mem={};
var store={
  get:function(k){try{var v=localStorage.getItem(k);return v==null?(mem[k]==null?null:mem[k]):v}catch(e){return mem[k]==null?null:mem[k]}},
  set:function(k,v){mem[k]=v;try{localStorage.setItem(k,v)}catch(e){}},
  del:function(k){delete mem[k];try{localStorage.removeItem(k)}catch(e){}}
};
var KEY='hatiin.data.v1',PINK='hatiin.pin.v1',BIOK='hatiin.bio.v1',THEMEK='hatiin.theme';

/* ---------- model ---------- */
var TYPES={
  bill:{label:'Bills',one:'bill',color:'var(--c-bill)'},
  loan:{label:'Loans',one:'loan',color:'var(--c-loan)'},
  tithe:{label:'Tithes',one:'tithe',color:'var(--c-tithe)'},
  saving:{label:'Savings',one:'savings goal',color:'var(--c-save)'},
  invest:{label:'Investments',one:'investment',color:'var(--c-inv)'},
  emergency:{label:'Emergency fund',one:'emergency fund',color:'var(--c-emg)'},
  cash:{label:'Cash on hand',one:'cash',color:'var(--c-cash)'}
};
var OBLIG=['bill','loan','tithe'],SAVE=['emergency','saving','invest'];
function fresh(){return {v:1,ready:false,sample:false,profile:null,cart:{budget:0,items:[]},settings:{lead:1,time:'09:00',notify:false,dismissed:false},notified:{},pay:{amount:0,days:[15,30],next:''},items:[],owed:[],b:{cash:0,reserve:0},log:[]}}
function migrate(s){
  s.owed=s.owed||[];s.pay=s.pay||{};s.b=s.b||{cash:0,reserve:0};s.items=s.items||[];s.log=s.log||[];
  s.settings=Object.assign({lead:1,time:'09:00',notify:false,dismissed:false},s.settings||{});s.notified=s.notified||{};s.profile=s.profile||null;s.cart=s.cart||{budget:0,items:[]};
  s.log=s.log.filter(function(e){return daysBetween(e.date,today())<=100});
  if(!Array.isArray(s.pay.days)||!s.pay.days.length){
    var f=s.pay.freq;
    s.pay.days=f==='weekly'?[7,14,21,28]:f==='monthly'?[s.pay.day||30]:[15,30];
  }
  delete s.pay.freq;delete s.pay.day;
  return s;
}
function load(){try{var s=JSON.parse(store.get(KEY));if(s&&s.v===1)return migrate(s)}catch(e){}return fresh()}
var S=load();
function save(){store.set(KEY,JSON.stringify(S))}
var ui={tab:'home',arm:null};
var item=function(id){return S.items.find(function(x){return x.id===id})};
var person=function(id){return S.owed.find(function(x){return x.id===id})};

function clampDate(y,mo,day){return iso(new Date(y,mo,Math.min(day,dim(y,mo+1))))}
function nextOnOrAfter(ds,days){
  var d=parse(ds),list=days.slice().sort(function(a,b){return a-b});
  for(var i=0;i<4;i++){
    var base=new Date(d.getFullYear(),d.getMonth()+i,1);
    for(var j=0;j<list.length;j++){var c=clampDate(base.getFullYear(),base.getMonth(),list[j]);if(c>=ds)return c}
  }
  return ds;
}
function nextAfter(ds){return nextOnOrAfter(addDay(ds),S.pay.days)}
function windowEnd(){
  var n=S.pay.next;if(!n)return '9999-12-31';
  var g=0;while(n<=today()&&g<24){n=nextAfter(n);g++}
  return n;
}
var perMonth=function(){return Math.max(1,S.pay.days.length)};
function monthly(it){
  if(it.type==='bill'||it.type==='loan')return it.amount;
  return r2((it.mode==='pct'?S.pay.amount*it.value/100:it.value)*perMonth());
}
function cycle(it,mk){
  var pays=S.log.filter(function(e){return e.t==='paid'&&e.itemId===it.id&&e.month===mk});
  var got=r2(pays.reduce(function(a,e){return a+e.amount},0));
  var amt=monthly(it);
  if(it.type==='loan')amt=Math.min(amt,r2(it.balance+got));
  var full=pays.some(function(e){return e.full});
  var paid=full||got>=amt-0.005;
  return {it:it,month:mk,due:dueDate(mk,it.due||1),amount:amt,got:got,paid:paid,left:paid?0:r2(Math.max(0,amt-got)),pays:pays};
}
function dues(){
  var cur=today().slice(0,7),pmk=prevMonth(cur),nmk=nextMonth(cur),out=[];
  S.items.forEach(function(it){
    if(OBLIG.indexOf(it.type)<0)return;
    var st=it.start||cur;
    [pmk,cur,nmk].forEach(function(mk){
      if(mk<st)return;
      var c=cycle(it,mk);
      if(mk===pmk){if(!c.paid&&c.amount>0)out.push(c);return}
      if(it.type==='loan'&&it.balance<=0.005&&!c.got&&!c.paid)return;
      if(c.amount<=0&&!c.got)return;
      if(mk===nmk&&c.paid&&!c.got)return;
      out.push(c);
    });
  });
  return out;
}
/* Bills and loans that must be covered by the paycheck on day D, up to (not including) the next payday N */
function needsFor(D,N){
  var months=[prevMonth(D.slice(0,7)),D.slice(0,7)],last=N.slice(0,7),g=0;
  while(months[months.length-1]<last&&g<4){months.push(nextMonth(months[months.length-1]));g++}
  var list=[],total=0;
  S.items.forEach(function(it){
    if(OBLIG.indexOf(it.type)<0)return;
    var balLeft=it.type==='loan'?it.balance:Infinity;
    months.forEach(function(mk){
      if(mk<(it.start||'0000-00'))return;
      var c=cycle(it,mk);if(c.paid||c.left<=0)return;
      if(c.due>=N)return;
      var need=Math.min(c.left,balLeft);if(need<=0)return;
      balLeft-=need;list.push({it:it,due:c.due,amount:r2(need)});total=r2(total+need);
    });
  });
  list.sort(function(a,b){return a.due<b.due?-1:a.due>b.due?1:0});
  return {list:list,total:total};
}
function calc(amount,D,N){
  var rows=S.items.filter(function(i){return SAVE.indexOf(i.type)>=0}).map(function(i){return {it:i,pp:goalDone(i)?0:r2(i.mode==='pct'?amount*i.value/100:i.value)}});
  var by={bill:0,loan:0,tithe:0,saving:0,invest:0,emergency:0};
  var nd=needsFor(D,N);
  nd.list.forEach(function(x){by[x.it.type]=r2(by[x.it.type]+x.amount)});
  rows.forEach(function(r){by[r.it.type]=r2(by[r.it.type]+r.pp)});
  var sv=r2(rows.reduce(function(a,r){return a+r.pp},0)),R=bal('reserve');
  return {rows:rows,by:by,needs:nd,save:sv,R:R,cash:r2(amount-sv-nd.total+R),amount:amount,D:D,N:N};
}
function defaultNext(D){var n=S.pay.next;if(n&&D<=n&&daysBetween(D,n)<=3)return nextAfter(n);return nextAfter(D)}
function upcoming(){var D=S.pay.next||today();return calc(S.pay.amount,D,nextAfter(D))}
function buckets(){
  var out=[{id:'cash',name:'Cash on hand',type:'cash'},{id:'reserve',name:'Bills set aside',type:'reserve'}];
  SAVE.forEach(function(t){S.items.filter(function(i){return i.type===t}).forEach(function(i){out.push({id:i.id,name:i.name,type:i.type,it:i})})});
  return out;
}
var bname=function(id){var b=buckets().find(function(x){return x.id===id});return b?b.name:'Removed bucket'};
var bal=function(id){return r2(S.b[id]||0)};
var goalDone=function(it){return SAVE.indexOf(it.type)>=0&&it.target>0&&bal(it.id)>=it.target-0.005};
var itemDone=function(it){return it.type==='loan'?it.balance<=0.005:goalDone(it)};
var recent=function(){return S.log.filter(function(e){return daysBetween(e.date,today())<=30})};
function netSavings(){return r2(S.items.filter(function(i){return SAVE.indexOf(i.type)>=0}).reduce(function(a,i){return a+bal(i.id)},0))}
function monthDelta(){
  var mk=today().slice(0,7),ids=S.items.filter(function(i){return SAVE.indexOf(i.type)>=0}).map(function(i){return i.id}),t=0;
  S.log.forEach(function(e){if(e.date.slice(0,7)!==mk||e.t==='adjust')return;ids.forEach(function(id){if(e.d&&e.d[id])t+=e.d[id]})});
  return r2(t);
}
function applyEntry(e,s){
  Object.keys(e.d||{}).forEach(function(k){S.b[k]=r2((S.b[k]||0)+s*e.d[k])});
  if(e.loan){var L=item(e.itemId);if(L)L.balance=Math.max(0,r2(L.balance-s*e.loan))}
  if(e.owedId){var o=person(e.owedId);if(o)o.balance=Math.max(0,r2(o.balance-s*e.owed))}
}
function addEntry(e){e.id=uid();e.date=e.date||today();applyEntry(e,1);S.log.unshift(e);save();return e}
function undoEntry(id){
  var i=S.log.findIndex(function(e){return e.id===id});if(i<0)return;
  applyEntry(S.log[i],-1);S.log.splice(i,1);save();
}
/* A bill comes out of the money set aside for it first. Anything above that comes out of cash on hand. */
function winOpen(){var end=windowEnd();return dues().filter(function(c){return !c.paid&&c.due<end}).length}
function recordPayment(it,mk,amount,full,quiet){
  var wasOpen=quiet?0:winOpen();
  amount=r2(amount);
  var fromR=Math.min(amount,Math.max(0,bal('reserve'))),fromC=r2(amount-fromR),d={};
  if(fromR)d.reserve=-fromR;if(fromC)d.cash=-fromC;
  var e={t:'paid',itemId:it.id,month:mk,amount:amount,full:!!full,name:it.name,d:d};
  if(it.type==='loan')e.loan=Math.min(amount,it.balance);
  var entry=addEntry(e);
  if(wasOpen>0&&winOpen()===0)setTimeout(celebrate,300);
  return entry;
}

/* ---------- security ---------- */
var G={v:'',res:null,open:false};
var PADHTML=(function(){
  var b='';for(var n=1;n<=9;n++)b+='<button type="button" data-k="'+n+'">'+n+'</button>';
  b+='<button type="button" data-k="bio" id="bioKey" class="off" aria-label="Unlock with fingerprint or face"><svg viewBox="0 0 24 24"><path d="M12 11v3c0 2-.5 4-1.5 6M8 14c0-3 1-5 4-5s4 2 4 5c0 2 0 3.5-.5 5M5 12a7 7 0 0 1 14 0c0 2 0 4-.5 6M8 20c.7-1.5 1-3 1-5"/></svg></button>';
  b+='<button type="button" data-k="0">0</button><button type="button" data-k="del" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M12 9l5 6M17 9l-5 6"/></svg></button>';
  return b;
})();
$('#pad').innerHTML=PADHTML;
async function hashPin(pin,salt){
  try{var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pin));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
  catch(e){var h=5381,s=salt+pin;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return 'f'+h}
}
async function setPin(pin){var salt=uid()+uid();store.set(PINK,JSON.stringify({salt:salt,hash:await hashPin(pin,salt)}))}
async function checkPin(pin){try{var p=JSON.parse(store.get(PINK));return (await hashPin(pin,p.salt))===p.hash}catch(e){return false}}
function paintDots(){Array.prototype.forEach.call($('#dots').children,function(el,i){el.className=i<G.v.length?'on':''})}
function openGate(o){
  G.open=true;$('#lock').hidden=false;$('#onboard').hidden=true;
  $('#gTitle').textContent=o.title;$('#gSub').textContent=o.sub||'';$('#gMsg').textContent='';
  $('#gForgot').hidden=!o.forgot;$('#forgotBox').hidden=true;
  $('#bioKey').className=o.bio?'':'off';
  $('#main').hidden=true;
}
function gateSet(t,s){$('#gTitle').textContent=t;$('#gSub').textContent=s||'';$('#gMsg').textContent=''}
function gateMsg(t,shake){$('#gMsg').textContent=t;if(shake){var d=$('#dots');d.classList.remove('shake');void d.offsetWidth;d.classList.add('shake')}}
function closeGate(){G.open=false;G.res=null;$('#lock').hidden=true}
function gateInput(){G.v='';paintDots();return new Promise(function(r){G.res=r})}
function gateKey(k){
  if(!G.open||!G.res)return;
  if(k==='bio'){var r=G.res;G.res=null;r('BIO');return}
  if(k==='del'){G.v=G.v.slice(0,-1);paintDots();return}
  if(G.v.length>=4)return;
  G.v+=k;paintDots();
  if(G.v.length===4){var rs=G.res;G.res=null;setTimeout(function(){rs(G.v)},120)}
}
$('#pad').addEventListener('click',function(e){var b=e.target.closest('[data-k]');if(b)gateKey(b.dataset.k)});
document.addEventListener('keydown',function(e){
  if(!G.open)return;
  if(/^[0-9]$/.test(e.key))gateKey(e.key);else if(e.key==='Backspace')gateKey('del');
});
var fails=0,lockedUntil=0;
async function unlockFlow(){
  var hasBio=!!store.get(BIOK);
  var hi=['Time to manage our riches!','Money check time, boss!','Let\'s get this bread, boss!'];
  openGate({title:hi[Math.floor(Math.random()*hi.length)],sub:'Punch in your PIN.',bio:hasBio,forgot:true});
  while(true){
    var r=await gateInput();
    if(r==='BIO'){
      if(await bioAuth())break;
      gateMsg('Fingerprint did not work. Your PIN does.');continue;
    }
    if(Date.now()<lockedUntil){gateMsg('Whoa, slow down. Wait '+Math.ceil((lockedUntil-Date.now())/1000)+' seconds.',true);continue}
    if(await checkPin(r)){fails=0;break}
    fails++;
    if(fails>=5){fails=0;lockedUntil=Date.now()+30000;gateMsg('Whoa, slow down. Wait 30 seconds.',true)}
    else gateMsg('Nope, not that one. '+(5-fails)+' tries left.',true);
  }
  closeGate();
}
async function createPin(title){
  while(true){
    openGate({title:title||'Set your secret PIN',sub:'Four digits. Only you get in.'});
    var a=await gateInput();
    gateSet('Once more, to be sure','');
    var b=await gateInput();
    if(a===b){await setPin(a);closeGate();return a}
    gateMsg('Those did not match. Try again.',true);
    await new Promise(function(r){setTimeout(r,900)});
  }
}
var b64=function(buf){return btoa(String.fromCharCode.apply(null,new Uint8Array(buf)))};
var unb64=function(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)})};
async function bioSetup(){
  if(!window.PublicKeyCredential||!navigator.credentials)throw new Error('unsupported');
  var ok=await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if(!ok)throw new Error('none');
  var cred=await navigator.credentials.create({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'Yamanly'},
    user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'hatiin-user',displayName:'Yamanly'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},timeout:60000}});
  store.set(BIOK,b64(cred.rawId));
}
async function bioAuth(){
  try{
    var id=store.get(BIOK);if(!id)return false;
    var r=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials:[{type:'public-key',id:unb64(id)}],userVerification:'required',timeout:60000}});
    return !!r;
  }catch(e){return false}
}
var lastActive=Date.now(),IDLE=30*60*1000;
['pointerdown','keydown','touchstart','scroll'].forEach(function(ev){document.addEventListener(ev,function(){lastActive=Date.now()},{passive:true,capture:true})});
function checkIdle(){
  if(S.ready&&store.get(PINK)&&!G.open&&!$('#main').hidden&&Date.now()-lastActive>IDLE)lockNow();
}
setInterval(checkIdle,30000);
document.addEventListener('visibilitychange',function(){if(!document.hidden){checkIdle();checkReminders()}});
async function lockNow(){closeSheet();await unlockFlow();lastActive=Date.now();showMain()}

/* ---------- groceries (beta) ---------- */
var scan={state:'idle',ok:false,fn:null,ctl:null};
function ensureScan(){
  if(scan.state!=='idle')return;scan.state='checking';
  (async function(){
    try{
      var c=window.claude&&window.claude.use?await window.claude.use('sample'):null;
      if(c){var l=await c.limits();if(l&&l.images){scan.ok=true;scan.fn=c}}
    }catch(e){}
    scan.state='done';if(ui.tab==='groceries')render();
  })();
}
var cartTotal=function(){return r2(S.cart.items.reduce(function(a,i){return a+i.price*i.qty},0))};
var SCAN_PROMPT='This is a photo of a price tag or product label in a Philippine supermarket or store. Read it and reply with only JSON like {"name":"Lucky Me Pancit Canton 60g","price":14.5,"note":""}. '+
  'Rules: price is what the shopper pays per piece right now, as a plain number in pesos. If a sale or promo price is shown, use it, not the old crossed-out price. '+
  'Do not use the price per kilo or per 100g unless it is the only price you can find, and in that case set note to "price per kg" or "price per 100g" so the shopper can check. '+
  'name is the product name with its size, kept short. If several products are in the photo, use the one most clearly in focus. If you cannot read a price, reply {"error":"unreadable"}.';
function vGroceries(){
  ensureScan();
  var tot=cartTotal(),bud=S.cart.budget||0,left=r2(bud-tot),over=bud>0&&left<0;
  var h='<div><button class="link" data-act="tab" data-tab="home">&lsaquo; Home</button></div>';
  h+='<section class="card"><h2>Groceries (BETA)</h2><p class="small muted">Scan a price tag and keep a running total while you shop.</p>'+
    '<div class="rowh" style="margin-top:14px;align-items:flex-end"><div><p class="small muted">In your cart</p><span class="num" style="font-size:32px;font-weight:700">'+m(tot)+'</span></div><div style="text-align:right"><p class="small muted">Budget</p><button class="link" data-act="setbudget" style="padding:2px 0">'+(bud?m(bud):'Set a budget')+'</button></div></div>';
  if(bud)h+='<div class="prog" style="margin-top:10px"><i style="width:'+Math.min(100,tot/bud*100)+'%;background:'+(over?'var(--bad)':'var(--c-save)')+'"></i></div><p class="small '+(over?'bad':'muted')+'" style="margin-top:6px">'+(over?'Over by '+m(-left)+'. Put something back, boss.':m(left)+' left')+'</p>';
  h+='</section>';
  if(scan.ok){
    h+='<div class="actions" style="grid-template-columns:1fr 1fr"><button class="btn" data-act="scancam">Scan price tag</button><button class="btn ghost" data-act="scanpick">Choose photo</button></div>';
  }else if(scan.state==='done'){
    h+='<p class="note soft">Scanning is not available in this view. You can still type items in.</p>';
  }else h+='<p class="small muted">Getting the scanner ready...</p>';
  h+='<button class="btn ghost block" data-act="addgrocery">Type an item in</button>';
  if(scan.ok)h+='<p class="hint">BETA. The photo goes to Claude only to read the tag. Nothing is saved. Always check the price it reads.</p>';
  h+='<section class="card"><div class="sect"><h2>Your list</h2><span class="small muted">'+S.cart.items.length+(S.cart.items.length===1?' item':' items')+'</span></div>';
  if(!S.cart.items.length)h+='<p class="empty">Nothing yet. Scan your first price tag.</p>';
  else h+='<div class="list">'+S.cart.items.map(function(i){
    return '<div class="due"><button class="due-main" data-act="editgrocery" data-id="'+i.id+'"><span class="due-txt"><b>'+esc(i.name)+'</b><small>'+m(i.price)+' each</small></span></button><div class="stepper"><button data-act="qtyminus" data-id="'+i.id+'" aria-label="One less">−</button><span>'+i.qty+'</span><button data-act="qtyplus" data-id="'+i.id+'" aria-label="One more">+</button></div><span class="due-amt" style="min-width:64px">'+m(r2(i.price*i.qty))+'</span></div>';
  }).join('')+'</div>';
  h+='</section>';
  if(S.cart.items.length)h+='<button class="btn block" data-act="doneshop">Done shopping</button><button class="link" data-act="clearcart">Clear the list</button>';
  return h;
}
function shrink(file){
  return new Promise(function(res){
    try{
      var url=URL.createObjectURL(file),img=new Image();
      img.onload=function(){
        var sc=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(img.width*sc));c.height=Math.max(1,Math.round(img.height*sc));
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
        c.toBlob(function(b){res(b||file)},'image/jpeg',0.85);
      };
      img.onerror=function(){URL.revokeObjectURL(url);res(file)};
      img.src=url;
    }catch(e){res(file)}
  });
}
function groceryForm(it,note,title){
  var v=it||{name:'',price:'',qty:1};
  var h='<h2>'+title+'</h2>'+(note?note:'')+
    '<label class="f">Item<input id="f-gname" value="'+esc(v.name)+'" placeholder="e.g. Lucky Me Pancit Canton" autocomplete="off"></label>'+
    amtField('f-gprice','Price each',v.price)+
    '<label class="f">How many<input id="f-gqty" inputmode="numeric" value="'+esc(v.qty)+'"></label><div class="err" id="err"></div>'+
    '<button class="btn block" data-act="savegrocery" data-id="'+(it&&it.id?it.id:'')+'">'+(it&&it.id?'Save':'Add to list')+'</button>';
  if(it&&it.id)h+='<button class="link bad" data-act="delgrocery" data-id="'+it.id+'">Remove from list</button>';
  openSheet(h);
}
function scanFail(msg){
  openSheet('<h2>Could not read that one</h2><p class="muted">'+esc(msg)+'</p><button class="btn block" data-act="scancam">Try again</button><button class="btn ghost block" data-act="addgrocery">Type it in</button>');
}
async function doScan(file){
  if(!file||!scan.fn)return;
  scan.ctl=new AbortController();
  openSheet('<h2>Reading the tag...</h2><p class="muted">Hang on, boss. This takes a few seconds.</p><button class="btn ghost block" data-act="stopscan">Stop</button>');
  try{
    var blob=await shrink(file);
    var r=await scan.fn.json(SCAN_PROMPT,{images:blob,modelTier:'quick',signal:scan.ctl.signal,cache:false});
    var price=num(r&&r.price);
    if(!r||r.error||!(price>0)){scanFail('The price was not clear in that photo. Try again closer and in good light, or type it in.');return}
    var note=r.note?'<p class="note soft">Heads up: the tag says "'+esc(String(r.note).slice(0,60))+'". Check this is the price you want.</p>':'';
    groceryForm({name:String(r.name||'').slice(0,80),price:price,qty:1},note+'<p class="small muted">BETA. Check the price before you add it.</p>','Is this right?');
  }catch(e){
    var c=e&&e.code;
    if(c==='cancelled')return;
    if(c==='not_granted'||c==='sampling_disabled'||c==='not_declared'||c==='images_unavailable'||c==='capability_disabled')scanFail('Scanning needs your OK to use Claude. You can still type items in.');
    else if(c==='rate_limited')scanFail('Too many scans for now. Wait a bit, or type it in.');
    else if(c==='image_rejected')scanFail('That photo did not work. Try a different one.');
    else scanFail('Something went wrong on our side. Try once more, or type it in.');
  }
}
/* ---------- confetti ---------- */
function celebrate(){
  toast('Every bill is paid for this payday. Big win, boss!');
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var old=document.getElementById('confetti');if(old)old.remove();
  var c=document.createElement('canvas');c.id='confetti';c.setAttribute('aria-hidden','true');
  c.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70';
  var dpr=Math.min(2,window.devicePixelRatio||1),W=window.innerWidth,H=window.innerHeight;
  c.width=W*dpr;c.height=H*dpr;document.body.appendChild(c);
  var x=c.getContext('2d');x.scale(dpr,dpr);
  var greens=['#2E9E5B','#3DBE8B','#1E7A48','#6FCF97'],parts=[],n=70;
  for(var i=0;i<n;i++){
    var coin=i%4===0;
    parts.push({x:Math.random()*W,y:-20-Math.random()*H*0.6,vx:(Math.random()-0.5)*1.6,vy:2+Math.random()*3.2,
      r:Math.random()*6.28,vr:(Math.random()-0.5)*0.22,coin:coin,col:coin?'#F2B705':greens[i%greens.length],s:coin?9+Math.random()*4:20+Math.random()*10,ph:Math.random()*6.28});
  }
  var t0=performance.now(),DUR=2800;
  function frame(now){
    var el=now-t0;x.clearRect(0,0,W,H);
    var fade=el>DUR-600?Math.max(0,(DUR-el)/600):1;x.globalAlpha=fade;
    parts.forEach(function(p){
      p.x+=p.vx+Math.sin(el/400+p.ph)*0.6;p.y+=p.vy;p.r+=p.vr;
      x.save();x.translate(p.x,p.y);x.rotate(p.r);
      if(p.coin){
        x.fillStyle=p.col;x.beginPath();x.arc(0,0,p.s/2,0,6.28);x.fill();
        x.fillStyle='#8A6500';x.font='bold '+Math.round(p.s*0.7)+'px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('₱',0,1);
      }else{
        var w=p.s*1.7,h=p.s*0.85*Math.abs(Math.cos(el/260+p.ph)*0.6+0.4);
        x.fillStyle=p.col;x.fillRect(-w/2,-h/2,w,h);
        x.strokeStyle='rgba(255,255,255,.55)';x.lineWidth=1.5;x.strokeRect(-w/2+3,-h/2+3,w-6,Math.max(1,h-6));
        x.fillStyle='rgba(255,255,255,.7)';x.beginPath();x.arc(0,0,Math.max(1,h*0.22),0,6.28);x.fill();
      }
      x.restore();
    });
    if(el<DUR)requestAnimationFrame(frame);else c.remove();
  }
  requestAnimationFrame(frame);
}
/* ---------- reminders ---------- */
var notifOK=function(){return 'Notification' in window};
function notifState(){if(!notifOK())return 'unsupported';try{return Notification.permission}catch(e){return 'unsupported'}}
function atTime(ds,lead){var d=parse(ds);d.setDate(d.getDate()-lead);var t=(S.settings.time||'09:00').split(':');d.setHours(+t[0]||0,+t[1]||0,0,0);return d}
function pendingReminders(){
  var now=new Date(),out=[],cur=today(),lead=+S.settings.lead||0;
  dues().forEach(function(c){
    if(c.paid||c.it.remind===false||c.due<cur)return;
    if(now>=atTime(c.due,lead))out.push({key:'due:'+c.it.id+':'+c.month+':'+lead,title:'Hey boss! Due date for '+c.it.name+' is coming!',body:m(c.left||c.amount)+' due '+fmtDate(c.due)+'. Tap to mark it paid.'});
  });
  S.owed.forEach(function(p){
    if(!p.remindOn||p.balance<=0.005)return;
    if(now>=atTime(p.remindOn,0))out.push({key:'owed:'+p.id+':'+p.remindOn,title:'Hey boss! Time to claim your money',body:p.name+' still owes you '+m(p.balance)+'.'});
  });
  return out.filter(function(x){return !S.notified[x.key]});
}
function showNative(title,body,tag){
  if(notifState()!=='granted')return false;
  var plain=function(){try{new Notification(title,{body:body,tag:tag});return true}catch(e){return false}};
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration){
      navigator.serviceWorker.getRegistration().then(function(reg){if(reg&&reg.showNotification)reg.showNotification(title,{body:body,tag:tag});else plain()},plain);
      return true;
    }
  }catch(e){}
  return plain();
}
function checkReminders(){
  if(!S.ready||!S.settings.notify)return;
  var list=pendingReminders(),cur=today();
  Object.keys(S.notified).forEach(function(k){if(daysBetween(S.notified[k],cur)>60)delete S.notified[k]});
  if(!list.length)return;
  list.forEach(function(r){S.notified[r.key]=cur;showNative(r.title,r.body,r.key)});
  save();
  if(!$('#main').hidden){toast(list.length===1?list[0].title:'Hey boss! You have '+list.length+' reminders.');if(ui.tab==='home')render()}
}
setInterval(checkReminders,60000);

/* ---------- theme ---------- */
function applyTheme(){var t=store.get(THEMEK);var r=document.documentElement;if(t==='light'||t==='dark')r.setAttribute('data-theme',t);else r.removeAttribute('data-theme')}

/* ---------- UI atoms ---------- */
var ICON={
  home:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  bills:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  plan:'<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  owed:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.5M18 14.5c2 .8 3 2.800 3 5.5"/></svg>',
  activity:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>'
};
var TABS=[['home','Home'],['bills','Bills'],['plan','Plan'],['owed','Owed'],['activity','Activity']];
function toast(msg,undo,label){
  var t=$('#toast');t.hidden=false;t.innerHTML='<span>'+esc(msg)+'</span>'+(undo?'<button data-act="toastundo">'+(label||'Undo')+'</button>':'');
  toast.undo=undo||null;clearTimeout(toast.t);toast.t=setTimeout(function(){t.hidden=true},undo?6000:2800);
}
function bar(parts){
  var tot=parts.reduce(function(a,p){return a+Math.max(0,p.v)},0)||1;
  return '<div class="bar" role="img" aria-label="Payday split">'+parts.filter(function(p){return p.v>0}).map(function(p){return '<i style="width:'+(Math.max(0,p.v)/tot*100).toFixed(2)+'%;background:'+p.c+'"></i>'}).join('')+'</div>';
}
function splitBar(P){return bar([{v:P.by.bill,c:TYPES.bill.color},{v:P.by.loan,c:TYPES.loan.color},{v:P.by.tithe,c:TYPES.tithe.color},{v:P.by.saving,c:TYPES.saving.color},{v:P.by.invest,c:TYPES.invest.color},{v:P.by.emergency,c:TYPES.emergency.color},{v:P.cash,c:TYPES.cash.color}])}
function openSheet(html){
  $('#layer').innerHTML='<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-in"><div class="grab"></div>'+html+'</div></div>';
  document.body.style.overflow='hidden';
}
function closeSheet(){$('#layer').innerHTML='';document.body.style.overflow=''}
var gv=function(id){var el=document.getElementById(id);return el?el.value:''};
var segv=function(id){var el=document.querySelector('[data-seg="'+id+'"] .on');return el?el.dataset.v:''};
function seg(id,opts,cur){return '<div class="seg" data-seg="'+id+'">'+opts.map(function(o){return '<button type="button" data-act="seg" data-v="'+o[0]+'"'+(o[0]===cur?' class="on"':'')+'>'+o[1]+'</button>'}).join('')+'</div>'}
function amtField(id,label,val,hint,unit){return '<label class="f">'+label+(hint?' <small>'+hint+'</small>':'')+'<div class="amt"><span id="'+id+'-u">'+(unit||'₱')+'</span><input id="'+id+'" inputmode="decimal" autocomplete="off" placeholder="0" value="'+esc(val===0||val==null?'':val)+'"></div></label>'}
function bucketOptions(sel){return buckets().filter(function(b){return b.id!=='reserve'}).map(function(b){return '<option value="'+b.id+'"'+(b.id===sel?' selected':'')+'>'+esc(b.name)+'</option>'}).join('')}

/* ---------- views ---------- */
function dueRow(c,showMonth){
  var days=daysBetween(today(),c.due),it=c.it,label,pill='';
  if(c.paid){label='Paid'+(c.got?' '+m(c.got):'')}
  else if(days<0){label='Was due '+fmtDate(c.due);pill='<span class="pill bad">'+(-days)+(days===-1?' day late':' days late')+'</span>'}
  else if(days===0){label='Due today';pill='<span class="pill warn">Today</span>'}
  else if(days===1){label='Due tomorrow'}
  else label='Due '+fmtDate(c.due)+' · in '+days+' days';
  if(!c.paid&&c.got>0)label+=' · '+m(c.got)+' paid';
  var sub=label;
  if(it.type==='loan'&&!c.paid&&it.balance>0)sub+=' · '+m(it.balance)+' left';
  var btn=c.paid?'<button class="paybtn done" data-act="detail" data-id="'+it.id+'" data-m="'+c.month+'" aria-label="Paid. Open details">'+ICON.check+'Paid</button>'
    :'<button class="paybtn" data-act="quickpay" data-id="'+it.id+'" data-m="'+c.month+'" aria-label="Mark '+esc(it.name)+' as paid">Paid</button>';
  return '<div class="due"><button class="due-main" data-act="detail" data-id="'+it.id+'" data-m="'+c.month+'"><span class="dot" style="background:'+TYPES[it.type].color+'"></span><span class="due-txt"><b>'+esc(it.name)+' '+pill+'</b><small>'+esc(sub)+'</small></span><span class="due-amt">'+m(c.paid?c.amount:c.left||c.amount)+'</span></button>'+btn+'</div>';
}
function progRow(it,v,color){
  var sub='',pg='',done=goalDone(it);
  if(it.target>0){var p=Math.max(0,Math.min(100,v/it.target*100));sub=done?'Goal reached':Math.round(p)+'% of '+m(it.target);pg='<div class="prog" style="margin-top:6px"><i style="width:'+p+'%;background:'+color+'"></i></div>'}
  return '<button class="due'+(done?' fin':'')+'" style="width:100%;text-align:left" data-act="bucket" data-id="'+it.id+'"><span class="dot" style="background:'+color+'"></span><span class="due-txt"><b>'+esc(it.name)+'</b><small>'+esc(sub||TYPES[it.type].one)+'</small>'+pg+'</span><span class="due-amt">'+m(v)+'</span></button>';
}
function greeting(){var n=S.profile&&S.profile.name?S.profile.name.trim().split(' ')[0]:'boss';var hr=new Date().getHours();return (hr<12?'Morning':hr<18?'Afternoon':'Evening')+', '+n+'! Let\'s run the numbers.'}
function collectRow(p){
  var days=daysBetween(today(),p.remindOn),label=days<=0?'Time to claim your money':'Claim on '+fmtDate(p.remindOn)+' \u00B7 in '+days+(days===1?' day':' days');
  return '<div class="due"><button class="due-main" data-act="owed" data-id="'+p.id+'"><span class="dot" style="background:var(--good)"></span><span class="due-txt"><b>Claim from '+esc(p.name)+'</b><small>'+esc(label)+'</small></span><span class="due-amt">'+m(p.balance)+'</span></button><button class="paybtn" data-act="owed" data-id="'+p.id+'">Collect</button></div>';
}
function vHome(){
  var cur=today(),end=windowEnd(),D=dues();
  var open=D.filter(function(c){return !c.paid}).sort(function(a,b){return a.due<b.due?-1:a.due>b.due?1:0});
  var inWin=open.filter(function(c){return c.due<end});
  var left=r2(inWin.reduce(function(a,c){return a+c.left},0));
  var ns=netSavings(),md=monthDelta();
  var sumT=function(t){return r2(S.items.filter(function(i){return i.type===t}).reduce(function(a,i){return a+bal(i.id)},0))};
  var isDay=S.pay.next&&S.pay.next<=cur;
  var h='<p class="h3" style="font-size:18px">'+esc(greeting())+'</p>';
  if(!S.settings.notify&&!S.settings.dismissed)h+='<section class="note soft"><p><b>Want a nudge when stuff is due?</b> Turn on reminders so bills and payments never sneak up on you.</p><div class="actions" style="grid-template-columns:1fr 1fr;margin-top:10px"><button class="btn sm" data-act="enablenotif">Turn on reminders</button><button class="btn ghost sm" data-act="dismissnotif">Not now</button></div></section>';
  h+='<section class="hero"><p class="eyebrow">Net savings</p><p class="hero-num">'+m(ns)+'</p><p class="hero-sub">'+(md>=0?'+':'')+m(md)+' this month</p>'+
    '<div class="hero-parts"><div><small>Savings</small><b>'+m(sumT('saving'))+'</b></div><div><small>Invested</small><b>'+m(sumT('invest'))+'</b></div><div><small>Emergency</small><b>'+m(sumT('emergency'))+'</b></div></div></section>';
  h+='<div class="tiles"><button class="card tile" data-act="bucket" data-id="cash"><p class="eyebrow">Cash on hand</p><span class="num '+(bal('cash')<0?'bad':'')+'">'+m(bal('cash'))+'</span><p class="small muted">What is left after everything</p></button>'+
    '<button class="card tile" data-act="tab" data-tab="bills"><p class="eyebrow">Bills to pay</p><span class="num">'+m(left)+'</span><p class="small muted">'+(inWin.length?inWin.length+(inWin.length===1?' bill':' bills')+' before payday':'Nothing due before payday')+'</p></button></div>';
  h+='<div class="tiles" style="align-items:start"><div><button class="btn ghost block" data-act="spend">Add expenses</button><p class="hint">e.g. groceries, dine outs, etc</p></div><div><button class="btn ghost block" data-act="income">Add Extra Income</button><p class="hint">from your side hustles</p></div></div>';
  var ct=cartTotal();
  h+='<button class="card" data-act="groceries"><div class="rowh"><div><p class="eyebrow">Groceries (BETA)</p><p class="small muted">Scan price tags and keep a running total</p></div><span class="num h3">'+(ct?m(ct):'Open')+'</span></div></button>';
  h+='<section class="card"><div class="rowh"><div><p class="eyebrow">'+(isDay?'Payday is here':'Next payday')+'</p><p class="h3">'+(S.pay.next?fmtDate(S.pay.next,true):'Not set')+'</p><button class="link small" data-act="changenext" style="padding:2px 0">Change date</button></div><button class="btn'+(isDay?'':' ghost')+'" data-act="gotpaid">Got paid</button></div>';
  if(S.pay.amount>0){
    var P=upcoming();
    h+='<div style="margin:12px 0 10px">'+splitBar(P)+'</div>'+
      '';
    if(P.cash<0)h+='<p class="note bad" style="margin-top:10px">That payday is short by '+m(-P.cash)+'. Check your plan.</p>';
  }
  h+='</section>';
  var coll=S.owed.filter(function(p){return p.remindOn&&p.balance>0.005&&daysBetween(cur,p.remindOn)<=7}).map(function(p){return {owed:p,due:p.remindOn}});
  var coming=open.map(function(c){return {c:c,due:c.due}}).concat(coll).sort(function(a,b){return a.due<b.due?-1:a.due>b.due?1:0}).slice(0,6);
  h+='<section class="card"><div class="sect"><h2>Coming up</h2><button class="link" data-act="tab" data-tab="bills">See all</button></div>';
  if(!S.items.some(function(i){return OBLIG.indexOf(i.type)>=0})&&!coming.length)h+='<p class="empty">No bills yet. Add your first one in Plan and we will keep watch.</p><button class="btn ghost block" data-act="tab" data-tab="plan">Open Plan</button>';
  else if(!coming.length)h+='<p class="empty">All caught up. Nice one, boss!</p>';
  else h+='<div class="list">'+coming.map(function(x){return x.c?dueRow(x.c,true):collectRow(x.owed)}).join('')+'</div>';
  h+='</section>';
  var sv=S.items.filter(function(i){return i.type==='emergency'||i.type==='saving'||i.type==='invest'}).sort(function(a,b){return (goalDone(a)-goalDone(b))||(SAVE.indexOf(a.type)-SAVE.indexOf(b.type))});
  h+='<section class="card"><div class="sect"><h2>Savings and investments</h2><b class="num">'+m(ns)+'</b></div>';
  h+=sv.length?'<div class="list">'+sv.map(function(i){return progRow(i,bal(i.id),TYPES[i.type].color)}).join('')+'</div>':'<p class="empty">Add savings goals and investments in Plan.</p>';
  h+='</section>';
  var owedTot=r2(S.owed.reduce(function(a,p){return a+p.balance},0)),owedN=S.owed.filter(function(p){return p.balance>0.005}).length;
  h+='<button class="card" data-act="tab" data-tab="owed"><div class="rowh"><div><p class="eyebrow">Who owes me</p><p class="small muted">'+(owedN?'From '+owedN+(owedN===1?' person':' people'):'No one yet')+'</p></div><span class="num h3">'+m(owedTot)+'</span></div></button>';
  if(S.sample)h+='<p class="small muted" style="text-align:center">You are looking at sample data. Erase it in Settings when you are ready to start with your own.</p>';
  return h;
}
function vBills(){
  var cur=today(),end=windowEnd(),D=dues();
  var open=D.filter(function(c){return !c.paid});
  var inWin=open.filter(function(c){return c.due<end});
  var left=r2(inWin.reduce(function(a,c){return a+c.left},0));
  var overdue=open.filter(function(c){return c.due<cur}),
      soon=open.filter(function(c){var d=daysBetween(cur,c.due);return d>=0&&d<=7&&c.due<end}),
      rest=open.filter(function(c){return daysBetween(cur,c.due)>7&&c.due<end}),
      after=open.filter(function(c){return c.due>=end&&daysBetween(cur,c.due)>=0});
  var done=D.filter(function(c){return c.paid&&c.month>=cur.slice(0,7)});
  var sortF=function(a,b){return a.due<b.due?-1:a.due>b.due?1:0};
  var h='<section class="card"><p class="eyebrow">Cash on hand</p><span class="num '+(bal('cash')<0?'bad':'')+'" style="font-size:34px;font-weight:700;display:block">'+m(bal('cash'))+'</span>'+
    '<div class="rowh" style="margin-top:10px;align-items:flex-start"><div><p class="small muted">Left to pay before '+(end==='9999-12-31'?'payday':fmtDate(end))+'</p><b class="num">'+m(left)+'</b></div><div style="text-align:right"><p class="small muted">Set aside for bills</p><b class="num">'+m(Math.max(0,bal('reserve')))+'</b></div></div>'+
    '<p class="small muted" style="margin-top:10px">Bills come out of what was set aside on payday. If one costs more, the rest comes out of cash on hand. No transfers needed.</p></section>';
  if(bal('cash')<0)h+='<p class="note bad">Cash on hand is below zero. Add extra income or hold back on spending.</p>';
  var sec=function(title,arr,cls){return arr.length?'<section class="card"><div class="sect"><h2 class="'+(cls||'')+'">'+title+'</h2><span class="small muted">'+arr.length+'</span></div><div class="list">'+arr.sort(sortF).map(function(c){return dueRow(c,true)}).join('')+'</div></section>':''};
  h+=sec('Overdue',overdue,'bad')+sec('Due this week',soon)+sec('Rest of this payday',rest)+sec('After next payday',after)+sec('Paid',done);
  if(!D.length)h+='<section class="card"><p class="empty">No bills or loans yet. Add them in Plan.</p><button class="btn ghost block" data-act="tab" data-tab="plan">Open Plan</button></section>';
  return h;
}
function itemRow(it){
  var sub,right,rsub='',done=itemDone(it);
  if(it.type==='bill'){sub='Due the '+ord(it.due);right=m(it.amount);rsub='a month'}
  else if(it.type==='loan'){sub=it.balance>0.005?m(it.balance)+' left · '+Math.ceil(it.balance/it.amount)+' months to go · due the '+ord(it.due):'Fully paid';right=m(it.amount);rsub='a month'}
  else if(it.type==='tithe'){sub=(it.mode==='pct'?it.value+'% of every pay':m(it.value)+' every payday')+' · give on the '+ord(it.due);right=m(monthly(it));rsub='a month'}
  else{sub=(it.mode==='pct'?it.value+'% of every pay':'Fixed amount')+(it.target?' · goal '+m(it.target):'');right=m(it.mode==='pct'?S.pay.amount*it.value/100:it.value);rsub='per payday';if(done){sub='Goal reached · '+m(it.target);right=m(bal(it.id));rsub='saved'}}
  if(done&&it.type==='loan'){right='Done';rsub=''}
  return '<button class="due'+(done?' fin':'')+'" style="width:100%;text-align:left" data-act="edititem" data-id="'+it.id+'"><span class="dot" style="background:'+TYPES[it.type].color+'"></span><span class="due-txt"><b>'+esc(it.name)+'</b><small>'+esc(sub)+'</small></span><span class="due-amt">'+right+'<small class="muted" style="display:block;font-weight:400;font-size:12px">'+rsub+'</small></span></button>';
}
function daysChips(days){return days.map(function(d){return ord(d)}).join(', ')}
function vPlan(){
  var P=upcoming();
  var h='<p class="note soft"><b>Set up one time.</b> Yamanly does the math every payday, so you never have to redo this. Easy.</p>';
  h+='<section class="card"><div class="rowh"><div><p class="eyebrow">Your pay</p><p class="h3 num">'+m(S.pay.amount)+'</p><p class="small muted">Paid on the '+daysChips(S.pay.days.slice().sort(function(a,b){return a-b}))+' of the month</p></div><button class="btn ghost sm" data-act="editpay">Edit</button></div></section>';
  h+='<section class="card"><h2>Payday on '+fmtDate(P.D)+'</h2><p class="small muted">Bills and loans due before '+fmtDate(P.N)+' are taken out in full on this payday. This changes each payday because bills fall on different dates.</p><div style="margin:12px 0 4px">'+splitBar(P)+'</div><div class="legend">';
  ['bill','loan','tithe','saving','invest','emergency'].forEach(function(t){
    if(P.by[t]>0){
      var names=t==='saving'||t==='invest'||t==='emergency'?'':'<br><small class="muted">'+esc(P.needs.list.filter(function(x){return x.it.type===t}).map(function(x){return x.it.name}).join(', '))+'</small>';
      h+='<div class="lg"><span class="dot" style="background:'+TYPES[t].color+'"></span><span class="nm">'+TYPES[t].label+names+'</span><span class="am">'+m(P.by[t])+'</span></div>';
    }
  });
  h+='<div class="lg"><span class="dot" style="background:'+TYPES.cash.color+'"></span><span class="nm"><b>Cash on hand</b><br><small class="muted">Whatever is left after the above</small></span><span class="am '+(P.cash<0?'bad':'')+'">'+m(P.cash)+'</span></div></div>';
  if(P.cash<0)h+='<p class="note bad" style="margin-top:8px">This payday is short by '+m(-P.cash)+'. Lower a saving or move a bill.</p>';
  h+='</section>';
  var blocks=[['bill','Monthly bills','Add a bill'],['loan','Loans','Add a loan'],['tithe','Tithes','Add tithes'],['saving','Savings','Add a savings goal'],['invest','Investments','Add an investment'],['emergency','Emergency fund','Set up emergency fund']];
  blocks.forEach(function(b){
    var rows=S.items.filter(function(i){return i.type===b[0]}).sort(function(a,c){return itemDone(a)-itemDone(c)});
    if(b[0]==='emergency'&&rows.length){h+='<section class="card"><div class="sect"><h2>'+b[1]+'</h2></div><div class="list">'+rows.map(itemRow).join('')+'</div></section>';return}
    h+='<section class="card"><div class="sect"><h2>'+b[1]+'</h2></div>'+(rows.length?'<div class="list">'+rows.map(itemRow).join('')+'</div>':'<p class="empty">Nothing here yet.</p>')+'<button class="btn ghost block" style="margin-top:8px" data-act="additem" data-type="'+b[0]+'">+ '+b[2]+'</button></section>';
  });
  return h;
}
function vOwed(){
  var open=S.owed.filter(function(p){return p.balance>0.005}),done=S.owed.filter(function(p){return p.balance<=0.005});
  var tot=r2(open.reduce(function(a,p){return a+p.balance},0));
  var h='<section class="card"><p class="eyebrow">Who owes me</p><div class="rowh"><div><span class="num" style="font-size:34px;font-weight:700">'+m(tot)+'</span><p class="small muted">'+(open.length?'from '+open.length+(open.length===1?' person':' people'):'No one owes you right now')+'</p></div><button class="btn" data-act="addowed">+ Add</button></div></section>';
  var row=function(p){
    var paid=r2(p.original-p.balance),pc=p.original>0?Math.min(100,paid/p.original*100):0;
    return '<button class="due'+(p.balance>0.005?'':' fin')+'" style="width:100%;text-align:left" data-act="owed" data-id="'+p.id+'"><span class="due-txt"><b>'+esc(p.name)+'</b><small>'+(p.balance>0.005?m(paid)+' paid of '+m(p.original):'Paid in full')+'</small><div class="prog" style="margin-top:6px"><i style="width:'+pc+'%"></i></div></span><span class="due-amt '+(p.balance>0.005?'':'good')+'">'+(p.balance>0.005?m(p.balance):'Done')+'</span></button>';
  };
  if(open.length)h+='<section class="card"><div class="list">'+open.map(row).join('')+'</div></section>';
  else h+='<section class="card"><p class="empty">Add a person and what they owe you. Log small payments until it is all paid off.</p></section>';
  if(done.length)h+='<section class="card"><div class="sect"><h2>Paid in full</h2></div><div class="list">'+done.map(row).join('')+'</div></section>';
  return h;
}
var TAGS={payday:'Payday',income:'Extra income',spend:'Expense',move:'Moved',paid:'Paid',adjust:'Fixed balance',owed:'Received'};
function logInfo(e){
  var k=e.d?Object.keys(e.d)[0]:'',title,sub,amt,cls='',sign=1;
  if(e.t==='payday'){title='Payday';sub='Split across your plan';amt=e.amount;cls='good'}
  else if(e.t==='income'){title=e.note||'Extra income';sub='Into '+bname(k);amt=e.amount;cls='good'}
  else if(e.t==='spend'){title=e.note||'Expense';sub='From '+bname(k);amt=e.amount;sign=-1}
  else if(e.t==='move'){title=(e.fromName||bname(e.from))+' to '+bname(e.to);sub='Not counted as income or spending';amt=e.amount;sign=0}
  else if(e.t==='paid'){title=e.name+(e.full?'':' (part)');sub=monthLabel(e.month)+(e.amount===0?' · skipped':'');amt=e.amount;sign=-1}
  else if(e.t==='owed'){title=e.name+' paid you';sub=e.d&&e.d.cash?'Added to cash on hand':'Tracked only';amt=e.amount;cls=e.d&&e.d.cash?'good':''}
  else{title='Balance corrected';sub=bname(k);var dv=e.d[k]||0;amt=Math.abs(dv);sign=dv>=0?1:-1}
  return {title:title,sub:sub,amt:amt,sign:sign,cls:cls};
}
function vActivity(){
  var h='<section class="card"><div class="rowh"><div><h2>Activity</h2><p class="small muted">Last 30 days \u00B7 '+recent().length+(recent().length===1?' entry':' entries')+'</p></div><button class="btn" data-act="pdf"'+(recent().length?'':' disabled')+'>Download PDF</button></div></section>';
  h+='<section class="card">';
  if(!recent().length)h+='<p class="empty">Nothing in the last 30 days. Log a payday or tick off a bill and it shows up here.</p>';
  else{
    h+='<div class="list">'+recent().slice(0,100).map(function(e){
      var i=logInfo(e),armed=ui.arm===e.id,amt=i.amt?(i.sign>0?'+':i.sign<0?'-':'')+m(i.amt):'';
      return '<div class="hrow"><div class="due-txt" style="flex:1;min-width:0"><span class="tag">'+TAGS[e.t]+' · '+fmtDate(e.date)+'</span><b style="overflow-wrap:anywhere">'+esc(i.title)+'</b><small class="muted">'+esc(i.sub)+'</small></div><div style="text-align:right"><div class="due-amt '+i.cls+'">'+amt+'</div><button class="link small '+(armed?'bad':'')+'" data-act="undolog" data-id="'+e.id+'">'+(armed?'Tap to confirm':'Undo')+'</button></div></div>';
    }).join('')+'</div>';
    if(recent().length>100)h+='<p class="small muted" style="margin-top:8px">Showing the latest 100. The PDF has all of them.</p>';
  }
  return h+'</section>';
}
var VIEWS={home:vHome,bills:vBills,plan:vPlan,owed:vOwed,activity:vActivity,groceries:vGroceries};
function render(){
  $('#tabs').innerHTML=TABS.map(function(t){return '<button class="tab'+(ui.tab===t[0]||(t[0]==='home'&&ui.tab==='groceries')?' on':'')+'" data-act="tab" data-tab="'+t[0]+'" aria-label="'+t[1]+'"'+(ui.tab===t[0]?' aria-current="page"':'')+'><span class="ti">'+ICON[t[0]]+'</span>'+t[1]+'</button>'}).join('');
  $('#view').innerHTML=VIEWS[ui.tab]();
}
function showMain(){$('#onboard').hidden=true;$('#lock').hidden=true;$('#main').hidden=false;render()}

/* ---------- PDF ---------- */
async function makePdf(){
  var J=window.jspdf;
  if(!J||!J.jsPDF){toast('The PDF tool did not load. Check your connection and try again.');return}
  var doc=new J.jsPDF({unit:'pt',format:'a4'}),M=40,W=595,H=842,y=54;
  var text=function(t,x,yy,o){doc.text(String(t),x,yy,o||{})};
  doc.setFont('helvetica','bold');doc.setFontSize(20);text('Yamanly activity (last 30 days)',M,y);
  doc.setFont('helvetica','normal');doc.setFontSize(10);y+=18;
  text('Printed '+new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}),M,y);
  y+=26;doc.setFont('helvetica','bold');doc.setFontSize(11);text('Summary',M,y);y+=16;doc.setFont('helvetica','normal');doc.setFontSize(10);
  var owedTot=r2(S.owed.reduce(function(a,p){return a+p.balance},0));
  [['Last 30 days',''],['Net savings',pm(netSavings())],['Cash on hand',pm(bal('cash'))],['Owed to you',pm(owedTot)]].forEach(function(r){text(r[0],M,y);text(r[1],W-M,y,{align:'right'});y+=15});
  y+=14;
  var head=function(){doc.setFont('helvetica','bold');doc.setFontSize(9);text('DATE',M,y);text('TYPE',M+70,y);text('DETAILS',M+150,y);text('AMOUNT',W-M,y,{align:'right'});y+=6;doc.setDrawColor(190);doc.line(M,y,W-M,y);y+=14;doc.setFont('helvetica','normal');doc.setFontSize(10)};
  head();
  recent().forEach(function(e){
    var i=logInfo(e),lines=doc.splitTextToSize(i.title+(i.sub?' ('+i.sub+')':''),W-M-150-90);
    var need=lines.length*13+6;
    if(y+need>H-50){doc.addPage();y=54;head()}
    text(parse(e.date).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}),M,y);
    text(TAGS[e.t],M+70,y);
    doc.text(lines,M+150,y);
    var a=i.amt?(i.sign>0?'+':i.sign<0?'-':'')+pm(Math.abs(i.amt)).replace('-',''):'';
    text(a,W-M,y,{align:'right'});
    y+=need;
  });
  var buf=doc.output('arraybuffer'),name='yamanly-activity-'+today()+'.pdf';
  var dl=null;
  try{dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null}catch(e){dl=null}
  if(dl){
    try{await dl.save({filename:name,data:buf});toast('PDF ready')}
    catch(e){if(!e||e.code!=='declined')toast('Could not save the PDF here.')}
    return;
  }
  try{
    var url=URL.createObjectURL(new Blob([buf],{type:'application/pdf'})),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000);toast('PDF downloaded');
  }catch(e){toast('Could not save the PDF here.')}
}

/* ---------- sheets ---------- */
function detailSheet(id,mk){
  var it=item(id);if(!it)return;var c=cycle(it,mk);
  var def=c.paid?c.amount:(c.left||c.amount);
  var h='<h2>'+esc(it.name)+'</h2><p class="muted">'+monthLabel(mk)+' · due '+fmtDate(c.due)+(it.type==='loan'?' · balance '+m(it.balance):'')+'</p>';
  h+='<div class="kv"><div><small>Expected</small><b>'+m(c.amount)+'</b></div><div><small>Paid</small><b>'+m(c.got)+'</b></div><div><small>Left</small><b>'+m(c.left)+'</b></div></div>';
  h+=amtField('f-amt','Amount',r2(def),'Change it if the real bill is different');
  h+='<div class="err" id="err"></div>';
  h+=c.paid?'<button class="link" data-act="payextra" data-id="'+id+'" data-m="'+mk+'">Add another payment</button>'
    :'<button class="btn block" data-act="payfull" data-id="'+id+'" data-m="'+mk+'">Mark paid</button><button class="btn ghost block" data-act="paypart" data-id="'+id+'" data-m="'+mk+'">Pay part only</button>';
  if(!c.paid)h+='<button class="link" data-act="skipcycle" data-id="'+id+'" data-m="'+mk+'">Skip '+monthLabel(mk)+'</button>';
  if(c.pays.length){
    h+='<div><p class="eyebrow">Payments</p><div class="list">'+c.pays.map(function(e){return '<div class="hrow"><div class="due-txt" style="flex:1"><b>'+(e.amount?m(e.amount):'Skipped')+'</b><small class="muted">'+fmtDate(e.date)+(e.full?' · marked paid':' · part')+'</small></div><button class="link" data-act="undopay" data-id="'+e.id+'" data-item="'+id+'" data-m="'+mk+'">Undo</button></div>'}).join('')+'</div></div>';
  }
  h+='<button class="link" data-act="edititem" data-id="'+id+'">Edit this '+TYPES[it.type].one+'</button><button class="btn ghost block" data-act="close">Close</button>';
  openSheet(h);
}
function undoSheet(eid,id,mk){
  var it=item(id),e=S.log.find(function(x){return x.id===eid});if(!it||!e)return;
  var h='<h2>'+esc(it.name)+'</h2><p class="muted">'+monthLabel(mk)+' · '+(e.amount?m(e.amount)+(e.full?' marked paid':' part payment'):'skipped')+' on '+fmtDate(e.date)+'</p>';
  var d='data-id="'+eid+'" data-item="'+id+'" data-m="'+mk+'"';
  h+='<button class="btn block" data-act="undoconfirm" '+d+'>'+(!e.amount?'Undo skip':e.full?'Undo paid mark':'Undo payment')+'</button>';
  h+=amtField('f-amt','Or change it to a part payment',r2(e.amount||0)||'','Enter what you really paid')+'<div class="err" id="err"></div>';
  h+='<button class="btn ghost block" data-act="undopart" '+d+'>Pay part only</button>';
  if(e.amount)h+='<button class="link" data-act="undoskip" '+d+'>Skip '+monthLabel(mk)+'</button>';
  h+='<button class="link" data-act="edititem" data-id="'+id+'">Edit this '+TYPES[it.type].one+'</button><button class="btn ghost block" data-act="detail" data-id="'+id+'" data-m="'+mk+'">Back</button>';
  openSheet(h);
}
function itemSheet(type,id){
  var it=id?item(id):null,T=TYPES[type];
  var v=it||{name:type==='tithe'?'Tithes':type==='emergency'?'Emergency fund':'',amount:'',due:'',balance:'',mode:'pct',value:type==='tithe'?10:'',target:''};
  var ph={bill:'e.g. Meralco',loan:'e.g. SSS salary loan',saving:'e.g. Travel fund',invest:'e.g. Pag-IBIG MP2',tithe:'e.g. Tithes',emergency:'Emergency fund'}[type];
  var h='<h2>'+(it?'Edit':'Add')+' '+T.one+'</h2>';
  h+='<label class="f">Name<input id="f-name" value="'+esc(v.name)+'" placeholder="'+ph+'" autocomplete="off"></label>';
  if(type==='bill'||type==='loan'){
    h+=amtField('f-amt',type==='loan'?'Monthly payment':'Amount each month',v.amount);
    if(type==='loan')h+=amtField('f-bal','Balance left',v.balance,'What you still owe');
    h+='<label class="f">Due on day of month <small>1 to 31</small><input id="f-due" inputmode="numeric" placeholder="e.g. 15" value="'+esc(v.due)+'"></label>';
  }else{
    h+='<div><p style="font-weight:600;font-size:14px;margin-bottom:6px">How much each payday</p>'+seg('f-mode',[['pct','% of my pay'],['amt','Fixed ₱']],v.mode)+'</div>';
    h+=amtField('f-val','Amount',v.value,'',v.mode==='pct'?'%':'₱');
    if(type==='tithe')h+='<label class="f">Give on day of month <small>1 to 31</small><input id="f-due" inputmode="numeric" placeholder="30" value="'+esc(v.due||30)+'"></label>';
    if(type!=='tithe')h+=amtField('f-target','Goal',v.target,'Optional');
    if(!it&&type!=='tithe')h+=amtField('f-start','Already saved',0,'Optional. What is in it today');
  }
  if(OBLIG.indexOf(type)>=0)h+='<label class="check"><input type="checkbox" id="f-remind"'+(v.remind!==false?' checked':'')+'><span>Remind me when it is due<br><small class="muted">You get a nudge before the date.</small></span></label>';
  if(!it&&OBLIG.indexOf(type)>=0)h+='<label class="check"><input type="checkbox" id="f-paidnow"><span>Already paid this month<br><small class="muted">Tick this if the due date already passed and you paid it.</small></span></label>';
  h+='<div class="err" id="err"></div><button class="btn block" data-act="saveitem" data-type="'+type+'" data-id="'+(id||'')+'">Save</button>';
  if(it)h+='<button class="link bad" data-act="delitem" data-id="'+id+'">Delete</button>';
  openSheet(h);
}
var editDays=[];
function chipsHtml(){return editDays.length?editDays.map(function(d){return '<span class="chip">'+ord(d)+'<button type="button" data-act="rmday" data-d="'+d+'" aria-label="Remove '+ord(d)+'">&times;</button></span>'}).join(''):'<span class="small muted">No dates yet</span>'}
function paySheet(first){
  editDays=S.pay.days.slice().sort(function(a,b){return a-b});
  return '<h2>'+(first?'Your pay':'Edit your pay')+'</h2>'+amtField('f-pay','Pay each payday',S.pay.amount||'','Before anything is set aside')+
    '<div><p style="font-weight:600;font-size:14px;margin-bottom:6px">Which dates are you paid each month?</p><div class="chips" id="days">'+chipsHtml()+'</div>'+
    '<div style="display:flex;gap:8px;margin-top:10px"><input id="f-day" inputmode="numeric" placeholder="Day, e.g. 15" aria-label="Pay date, day of the month"><button type="button" class="btn ghost" data-act="adddate">Add</button></div>'+
    '<div class="chips" style="margin-top:10px"><button type="button" class="chip" data-act="preset" data-v="15,30">15th and 30th</button><button type="button" class="chip" data-act="preset" data-v="30">Once a month</button><button type="button" class="chip" data-act="preset" data-v="7,14,21,28">Weekly</button></div>'+
    '<p class="small muted" style="margin-top:8px">Pay dates move around, so you can change the next payday any time. Yamanly asks again when you log a payday.</p></div>'+
    '<div class="err" id="err"></div><button class="btn block" data-act="savepay">'+(first?'Continue':'Save')+'</button>';
}
var pdTouched=false;
function paydaySheet(){
  var D=today(),N=defaultNext(D);pdTouched=false;
  var h='<h2>Got paid</h2><p class="muted">One tap puts the money into each bucket and sets aside every bill due before your next payday.</p>'+amtField('f-pdamt','Amount received',S.pay.amount||'')+
    '<label class="f">Payday date<input id="f-pddate" type="date" value="'+D+'"></label>'+
    '<label class="f">Next payday <small>Change it if it is not the usual date</small><input id="f-pdnext" type="date" value="'+N+'"></label><div id="pdprev"></div><div class="err" id="err"></div><button class="btn block" data-act="confirmpayday">Add to my buckets</button>';
  openSheet(h);updatePdPrev();
}
function updatePdPrev(){
  var el=document.getElementById('pdprev');if(!el)return;
  var a=num(gv('f-pdamt')),D=gv('f-pddate')||today(),N=gv('f-pdnext')||defaultNext(D);
  if(N<=D){el.innerHTML='<p class="note warn">Next payday should be after this one.</p>';return}
  var P=calc(a,D,N),lines=[];
  P.needs.list.forEach(function(x){lines.push([x.it.name+' · '+fmtDate(x.due),x.amount,TYPES[x.it.type].color])});
  P.rows.forEach(function(r){if(r.pp>0)lines.push([r.it.name,r.pp,TYPES[r.it.type].color])});
  if(P.R)lines.push(['Left over from last payday',P.R,TYPES.cash.color]);
  var last=S.log.find(function(e){return e.t==='payday'});
  var warn=last&&last.date===D?'<p class="note warn">You already logged a payday on this date. Check this is a new one.</p>':'';
  el.innerHTML=warn+'<p class="eyebrow">Where it goes</p><div class="legend">'+lines.map(function(l){return '<div class="lg"><span class="dot" style="background:'+l[2]+'"></span><span class="nm">'+esc(l[0])+'</span><span class="am">'+(l[1]>=0&&l[0].indexOf('Left over')===0?'+':'')+m(l[1])+'</span></div>'}).join('')+
    '<div class="lg"><span class="dot" style="background:'+TYPES.cash.color+'"></span><span class="nm"><b>Cash on hand</b></span><span class="am '+(P.cash<0?'bad':'')+'"><b>'+m(P.cash)+'</b></span></div></div>'+(P.cash<0?'<p class="note bad">That is short by '+m(-P.cash)+'.</p>':'');
}
function incomeSheet(){
  openSheet('<h2>Add Extra Income</h2><p class="muted">From your side hustles. Pick where it goes.</p>'+amtField('f-amt','Amount','')+
    '<label class="f">Where should it go?<select id="f-to">'+bucketOptions('cash')+'</select></label>'+
    '<label class="f">What was it for? <small>Optional</small><input id="f-note" placeholder="e.g. Freelance logo" autocomplete="off"></label><div class="err" id="err"></div><button class="btn block" data-act="saveincome">Add it</button>');
}
function spendSheet(){
  openSheet('<h2>Add expenses</h2>'+amtField('f-amt','Amount','')+
    '<div class="chips">'+['Food','Transport','Load','Groceries','Other'].map(function(c){return '<button type="button" class="chip" data-act="chip" data-v="'+c+'">'+c+'</button>'}).join('')+'</div>'+
    '<label class="f">Note <small>Optional</small><input id="f-note" placeholder="What was it?" autocomplete="off"></label>'+
    '<label class="f">Take it from<select id="f-from">'+bucketOptions('cash')+'</select></label><div class="err" id="err"></div><button class="btn block" data-act="savespend">Save</button>');
}
function bucketSheet(id){
  var b=buckets().find(function(x){return x.id===id});if(!b)return;
  openSheet('<h2>'+esc(b.name)+'</h2><p class="muted">Balance now '+m(bal(id))+'</p><label class="f">Correct the balance<small>Use this if the real amount is different</small><div class="amt"><span>₱</span><input id="f-bal" inputmode="decimal" value="'+bal(id)+'"></div></label><div class="err" id="err"></div><button class="btn block" data-act="savebucket" data-id="'+id+'">Save</button>'+(b.it?'<button class="link" data-act="edititem" data-id="'+id+'">Edit name, amount or goal</button>':''));
}
function owedSheet(id){
  var p=person(id);if(!p)return;
  var pays=S.log.filter(function(e){return e.t==='owed'&&e.owedId===id});
  var h='<h2>'+esc(p.name)+'</h2><div class="kv"><div><small>Owes</small><b>'+m(p.balance)+'</b></div><div><small>Paid</small><b>'+m(r2(p.original-p.balance))+'</b></div><div><small>Original</small><b>'+m(p.original)+'</b></div></div>';
  if(p.balance>0.005){
    h+=amtField('f-amt','Payment received','','Any amount, even a small one')+
      '<label class="check"><input type="checkbox" id="f-cash"><span>Also add it to my cash on hand</span></label><label class="f">Remind me to ask again on <small>Optional</small><input id="f-remind" type="date" value="'+esc(p.remindOn&&p.remindOn>today()?p.remindOn:'')+'"></label><div class="err" id="err"></div><button class="btn block" data-act="payowed" data-id="'+id+'">Save payment</button><button class="link" data-act="saveremind" data-id="'+id+'">Only save the reminder date</button>';
  }else h+='<p class="note good">Paid in full.</p>';
  if(pays.length)h+='<div><p class="eyebrow">Payments</p><div class="list">'+pays.map(function(e){return '<div class="hrow"><div class="due-txt" style="flex:1"><b>'+m(e.amount)+'</b><small class="muted">'+fmtDate(e.date)+'</small></div><button class="link" data-act="undoowed" data-id="'+e.id+'" data-p="'+id+'">Undo</button></div>'}).join('')+'</div></div>';
  h+='<button class="link" data-act="editowed" data-id="'+id+'">Edit name or amount</button><button class="link bad" data-act="delowed" data-id="'+id+'">Remove this person</button>';
  openSheet(h);
}
function addOwedSheet(){
  openSheet('<h2>Who owes you</h2><label class="f">Name<input id="f-name" placeholder="e.g. Ate Joy" autocomplete="off"></label>'+amtField('f-amt','How much they owe','')+'<label class="f">Remind me to ask for it <small>Optional</small><input id="f-remind" type="date"></label><div class="err" id="err"></div><button class="btn block" data-act="saveowed">Save</button>');
}
function editOwedSheet(id){
  var p=person(id);if(!p)return;
  openSheet('<h2>Edit</h2><label class="f">Name<input id="f-name" value="'+esc(p.name)+'" autocomplete="off"></label>'+amtField('f-amt','What they still owe',p.balance)+'<label class="f">Remind me to ask for it <small>Optional</small><input id="f-remind" type="date" value="'+esc(p.remindOn||'')+'"></label><div class="err" id="err"></div><button class="btn block" data-act="saveeditowed" data-id="'+id+'">Save</button>');
}
function settingsSheet(){
  var th=store.get(THEMEK)||'auto',bio=!!store.get(BIOK);
  var h='<h2>Settings</h2>'+
  (S.sample?'<p class="note warn">This is sample data so you can look around. Erase everything below to start with your own.</p>':'')+
  '<div><p style="font-weight:600;font-size:14px;margin-bottom:6px">Look</p>'+seg('f-theme',[['auto','Auto'],['light','Light'],['dark','Dark']],th)+'</div>'+
  '<div><p style="font-weight:600;font-size:14px;margin-bottom:6px">Reminders</p><button class="btn ghost block" data-act="'+(S.settings.notify?'disablenotif':'enablenotif')+'">'+(S.settings.notify?'Turn off reminders':'Turn on reminders')+'</button></div>'+
  (S.settings.notify?'<div>'+seg('f-lead',[['0','On the day'],['1','1 day before'],['3','3 days before']],String(S.settings.lead))+'</div><label class="f">Remind me at<input id="f-time" type="time" value="'+esc(S.settings.time)+'"></label><button class="btn ghost block" data-act="testnotif">Send a test reminder</button><p class="small muted" id="notifStatus">'+notifStatusText()+'</p>':'')+
  '<button class="btn ghost block" data-act="profile">Your details</button>'+
  '<button class="btn ghost block" data-act="changepin">Change PIN</button>'+
  '<button class="btn ghost block" data-act="bio">'+(bio?'Turn off fingerprint or face unlock':'Turn on fingerprint or face unlock')+'</button><p class="err" id="err"></p>'+
  '<button class="btn ghost block" data-act="backup">Back up or restore</button>'+
  '<button class="btn ghost block" data-act="locknow">Lock now</button>'+
  '<button class="btn danger block" data-act="reset">Erase everything</button>'+
  '<p class="small muted">Everything is stored on this device only. Nothing is sent anywhere.</p>';
  openSheet(h);
}
function notifStatusText(){
  var st=notifState();
  if(st==='granted')return 'Phone notifications are allowed.';
  if(st==='denied')return 'Phone notifications are blocked. Allow them in your browser or phone settings. Reminders still show inside the app.';
  if(st==='default')return 'Tap the test button to allow phone notifications.';
  return 'This view cannot show phone notifications. Reminders still show inside the app and under Coming up.';
}
function backupSheet(){
  openSheet('<h2>Back up or restore</h2><p class="muted">Copy this text and keep it somewhere safe, like a note to yourself. To restore, paste it below.</p><textarea id="f-back" readonly>'+esc(JSON.stringify(S))+'</textarea><button class="btn block" data-act="copyback">Copy backup</button><label class="f">Restore from a backup<textarea id="f-rest" placeholder="Paste your backup text here"></textarea></label><div class="err" id="err"></div><button class="btn ghost block" data-act="restore">Restore</button>');
}
var setErr=function(t){var e=document.getElementById('err');if(e)e.textContent=t;return false};

/* ---------- actions ---------- */
var act={
  tab:function(el){ui.tab=el.dataset.tab;render();window.scrollTo(0,0)},
  close:function(){closeSheet()},
  seg:function(el){
    var p=el.parentNode;Array.prototype.forEach.call(p.children,function(c){c.classList.remove('on')});el.classList.add('on');
    var id=p.dataset.seg;
    if(id==='f-mode'){var u=document.getElementById('f-val-u');if(u)u.textContent=el.dataset.v==='pct'?'%':'₱'}
    if(id==='f-lead'){S.settings.lead=+el.dataset.v;save()}
    if(id==='f-theme'){if(el.dataset.v==='auto')store.del(THEMEK);else store.set(THEMEK,el.dataset.v);applyTheme()}
  },
  chip:function(el){var n=document.getElementById('f-note');if(n)n.value=el.dataset.v},
  toastundo:function(){if(toast.undo){toast.undo();toast.undo=null}$('#toast').hidden=true},
  groceries:function(){ui.tab='groceries';render();window.scrollTo(0,0)},
  scancam:function(){var f=document.getElementById('scanFile');closeSheet();if(f)f.click()},
  scanpick:function(){var f=document.getElementById('scanPick');closeSheet();if(f)f.click()},
  stopscan:function(){if(scan.ctl)scan.ctl.abort();closeSheet()},
  addgrocery:function(){groceryForm(null,'','Add an item')},
  editgrocery:function(el){var i=S.cart.items.find(function(x){return x.id===el.dataset.id});if(i)groceryForm(i,'','Edit item')},
  savegrocery:function(el){
    var n=gv('f-gname').trim(),pr=r2(num(gv('f-gprice'))),q=Math.round(num(gv('f-gqty')));
    if(!n)return setErr('Give the item a name.');if(pr<=0)return setErr('Enter the price.');if(q<1||q>99)return setErr('How many? 1 to 99.');
    var id=el.dataset.id;
    if(id){var it=S.cart.items.find(function(x){return x.id===id});if(it){it.name=n;it.price=pr;it.qty=q}}
    else S.cart.items.push({id:uid(),name:n,price:pr,qty:q});
    save();closeSheet();render();toast('Added. Cart is '+m(cartTotal()));
  },
  delgrocery:function(el){S.cart.items=S.cart.items.filter(function(x){return x.id!==el.dataset.id});save();closeSheet();render()},
  qtyplus:function(el){var i=S.cart.items.find(function(x){return x.id===el.dataset.id});if(i&&i.qty<99){i.qty++;save();render()}},
  qtyminus:function(el){var i=S.cart.items.find(function(x){return x.id===el.dataset.id});if(!i)return;if(i.qty>1)i.qty--;else S.cart.items=S.cart.items.filter(function(x){return x.id!==i.id});save();render()},
  setbudget:function(){openSheet('<h2>Grocery budget</h2><p class="muted">How much do you want to spend this trip?</p>'+amtField('f-bud','Budget',S.cart.budget||'')+'<button class="btn ghost block" data-act="budcash">Use my cash on hand ('+m(Math.max(0,bal('cash')))+')</button><div class="err" id="err"></div><button class="btn block" data-act="savebudget">Save</button>')},
  budcash:function(){var el=document.getElementById('f-bud');if(el)el.value=Math.max(0,bal('cash'))},
  savebudget:function(){S.cart.budget=Math.max(0,r2(num(gv('f-bud'))));save();closeSheet();render()},
  doneshop:function(){
    var t=cartTotal();
    openSheet('<h2>Done shopping?</h2><div class="kv" style="grid-template-columns:1fr 1fr"><div><small>Total</small><b>'+m(t)+'</b></div><div><small>Items</small><b>'+S.cart.items.reduce(function(a,i){return a+i.qty},0)+'</b></div></div><p class="muted">This gets logged as an expense. Pick where the money comes from.</p><label class="f">Take it from<select id="f-from">'+bucketOptions('cash')+'</select></label><button class="btn block" data-act="confirmshop">Log it and clear the list</button>');
  },
  confirmshop:function(){
    var t=cartTotal(),fr=gv('f-from')||'cash',d={};d[fr]=-t;
    addEntry({t:'spend',amount:t,note:'Groceries',d:d});S.cart.items=[];save();closeSheet();render();
    toast('Groceries logged. Nice shopping, boss!');
  },
  clearcart:function(el){
    if(ui.arm!=='cart'){ui.arm='cart';el.textContent='Tap again to clear the list';return}
    ui.arm=null;S.cart.items=[];save();render();
  },
  settings:function(){settingsSheet()},
  enablenotif:async function(){
    var msg='Reminders on. We got you, boss!';
    if(notifOK()){
      var pr='denied';try{pr=await Notification.requestPermission()}catch(e){}
      if(pr!=='granted')msg='Reminders on inside the app. Allow notifications in your phone settings to get them when the app is closed.';
    }else msg='Reminders on inside the app. Phone notifications work in the installed app.';
    S.settings.notify=true;S.settings.dismissed=true;save();checkReminders();
    if($('#layer').innerHTML)settingsSheet();render();toast(msg);
  },
  disablenotif:function(){S.settings.notify=false;save();settingsSheet();render();toast('Reminders off')},
  dismissnotif:function(){S.settings.dismissed=true;save();render()},
  testnotif:async function(){
    if(notifOK()&&notifState()==='default'){try{await Notification.requestPermission()}catch(e){}}
    var ok=showNative('Hey boss! This is a test reminder','If you can read this, reminders work.','test');
    toast(ok?'Test sent. Check your notifications.':'No phone notification here, but in-app reminders still work.');
    var el=document.getElementById('notifStatus');if(el)el.textContent=notifStatusText();
  },
  profile:function(){
    var p=S.profile||{name:'',email:''};
    openSheet('<h2>Your details</h2><label class="f">Name<input id="f-rname" value="'+esc(p.name)+'" autocomplete="given-name"></label><label class="f">Email<input id="f-remail" type="email" value="'+esc(p.email)+'" autocomplete="email"></label><div class="err" id="err"></div><button class="btn block" data-act="saveprofile">Save</button>');
  },
  saveprofile:function(){
    var n=gv('f-rname').trim(),em=gv('f-remail').trim();
    if(!n)return setErr('Tell us your name, boss.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))return setErr('That email looks off. Check it?');
    S.profile={name:n,email:em};save();closeSheet();render();toast('Saved');
  },
  pdf:function(){makePdf()},
  quickpay:function(el){
    var it=item(el.dataset.id),c=cycle(it,el.dataset.m);if(!c.left&&c.paid)return;
    var e=recordPayment(it,el.dataset.m,c.left||c.amount,true);
    render();toast(it.name+' paid. Clean!',function(){undoEntry(e.id);render()});
  },
  detail:function(el){detailSheet(el.dataset.id,el.dataset.m)},
  payfull:function(el){
    var it=item(el.dataset.id),a=num(gv('f-amt'));if(a<=0)return setErr('Enter the amount you paid.');
    recordPayment(it,el.dataset.m,a,true);closeSheet();render();toast(it.name+' marked paid');
  },
  paypart:function(el){
    var it=item(el.dataset.id),a=num(gv('f-amt'));if(a<=0)return setErr('Enter the amount you paid.');
    recordPayment(it,el.dataset.m,a,false);closeSheet();render();toast('Part payment saved');
  },
  payextra:function(el){
    var it=item(el.dataset.id),a=num(gv('f-amt'));if(a<=0)return setErr('Enter the amount you paid.');
    recordPayment(it,el.dataset.m,a,false);closeSheet();render();toast('Payment added');
  },
  skipcycle:function(el){var it=item(el.dataset.id);recordPayment(it,el.dataset.m,0,true);closeSheet();render();toast(monthLabel(el.dataset.m)+' skipped for '+it.name)},
  undopay:function(el){undoSheet(el.dataset.id,el.dataset.item,el.dataset.m)},
  undoconfirm:function(el){
    var it=item(el.dataset.item),i=S.log.findIndex(function(e){return e.id===el.dataset.id});if(!it||i<0)return;
    var e=S.log[i];undoEntry(e.id);closeSheet();render();
    toast(it.name+' is back to unpaid',function(){applyEntry(e,1);S.log.unshift(e);save();render()},'Mark paid again');
  },
  undopart:function(el){
    var it=item(el.dataset.item),i=S.log.findIndex(function(e){return e.id===el.dataset.id}),a=num(gv('f-amt'));if(!it||i<0)return;
    if(a<=0)return setErr('Enter the amount you paid.');
    undoEntry(el.dataset.id);recordPayment(it,el.dataset.m,a,false,true);closeSheet();render();toast('Changed to a part payment');
  },
  undoskip:function(el){
    var it=item(el.dataset.item),i=S.log.findIndex(function(e){return e.id===el.dataset.id});if(!it||i<0)return;
    undoEntry(el.dataset.id);recordPayment(it,el.dataset.m,0,true,true);closeSheet();render();toast(monthLabel(el.dataset.m)+' skipped for '+it.name);
  },
  undolog:function(el){
    if(ui.arm!==el.dataset.id){ui.arm=el.dataset.id;render();return}
    ui.arm=null;undoEntry(el.dataset.id);render();toast('Entry removed and balances restored');
  },
  gotpaid:function(){
    if(!S.pay.amount){toast('Set your pay first in Plan');ui.tab='plan';render();return}
    paydaySheet();
  },
  confirmpayday:function(){
    var a=num(gv('f-pdamt')),D=gv('f-pddate')||today(),N=gv('f-pdnext')||defaultNext(D);
    if(a<=0)return setErr('Enter how much you received.');
    if(N<=D)return setErr('Next payday should be after this one.');
    var P=calc(a,D,N),dd={};
    dd.reserve=r2(P.needs.total-P.R);
    P.rows.forEach(function(r){if(r.pp)dd[r.it.id]=r.pp});
    dd.cash=P.cash;
    var e=addEntry({t:'payday',amount:a,date:D,d:dd});
    var prevNext=S.pay.next;S.pay.next=N;save();closeSheet();render();
    toast('Payday logged. Let\'s grow it! Next is '+fmtDate(N),function(){undoEntry(e.id);S.pay.next=prevNext;save();render()});
  },
  changenext:function(){
    openSheet('<h2>Next payday</h2><p class="muted">Pay dates move. Set the one that is coming.</p><label class="f">Date<input id="f-next" type="date" value="'+(S.pay.next||today())+'"></label><div class="err" id="err"></div><button class="btn block" data-act="savenext">Save</button>');
  },
  savenext:function(){var n=gv('f-next');if(!n)return setErr('Pick a date.');S.pay.next=n;save();closeSheet();render()},
  income:function(){incomeSheet()},
  saveincome:function(){
    var a=num(gv('f-amt'));if(a<=0)return setErr('Enter an amount.');
    var to=gv('f-to'),d={};d[to]=r2(a);addEntry({t:'income',amount:r2(a),note:gv('f-note').trim(),d:d});
    closeSheet();render();toast('Side hustle win! '+m(a)+' added to '+bname(to));
  },
  spend:function(){spendSheet()},
  savespend:function(){
    var a=num(gv('f-amt'));if(a<=0)return setErr('Enter an amount.');
    var fr=gv('f-from'),d={};d[fr]=-r2(a);addEntry({t:'spend',amount:r2(a),note:gv('f-note').trim(),d:d});
    closeSheet();render();toast('Saved. '+bname(fr)+' is now '+m(bal(fr)));
  },
  bucket:function(el){bucketSheet(el.dataset.id)},
  savebucket:function(el){
    var id=el.dataset.id,v=r2(num(gv('f-bal'))),delta=r2(v-bal(id));
    if(delta!==0){var d={};d[id]=delta;addEntry({t:'adjust',amount:Math.abs(delta),d:d})}
    closeSheet();render();toast('Balance saved');
  },
  additem:function(el){itemSheet(el.dataset.type,'')},
  edititem:function(el){var it=item(el.dataset.id);if(it)itemSheet(it.type,it.id)},
  saveitem:function(el){
    var type=el.dataset.type,id=el.dataset.id,name=gv('f-name').trim();
    if(!name)return setErr('Give it a name.');
    var o={name:name};
    if(type==='bill'||type==='loan'){
      o.amount=r2(num(gv('f-amt')));if(o.amount<=0)return setErr('Enter the monthly amount.');
      o.due=Math.round(num(gv('f-due')));if(o.due<1||o.due>31)return setErr('Due day should be 1 to 31.');
      if(type==='loan'){o.balance=r2(num(gv('f-bal')));if(o.balance<=0)return setErr('Enter what you still owe.')}
    }else{
      o.mode=segv('f-mode')||'pct';o.value=num(gv('f-val'));
      if(o.value<=0)return setErr('Enter an amount.');
      if(o.mode==='pct'&&o.value>100)return setErr('That is more than your whole pay.');
      if(type==='tithe'){o.due=Math.round(num(gv('f-due')))||30;if(o.due<1||o.due>31)return setErr('Day should be 1 to 31.')}
      else o.target=r2(num(gv('f-target')));
    }
    var rm=document.getElementById('f-remind');if(rm)o.remind=rm.checked;
    var it;
    if(id){it=item(id);Object.assign(it,o)}
    else{
      if(type==='emergency'&&S.items.some(function(i){return i.type==='emergency'}))return setErr('You already have an emergency fund.');
      it=Object.assign({id:uid(),type:type,start:today().slice(0,7)},o);S.items.push(it);
      var st=num(gv('f-start'));if(st>0)S.b[it.id]=r2(st);
      var pn=document.getElementById('f-paidnow');
      if(pn&&pn.checked)recordPayment(it,today().slice(0,7),0,true,true);
    }
    save();closeSheet();render();toast(name+' saved');
  },
  delitem:function(el){
    if(ui.arm!==el.dataset.id){ui.arm=el.dataset.id;el.textContent='Tap again to delete';return}
    var id=el.dataset.id,it=item(id);ui.arm=null;
    var v=bal(id);if(v!==0){var d={cash:v};d[id]=-v;addEntry({t:'move',amount:Math.abs(v),from:id,fromName:it?it.name:'',to:'cash',d:d})}
    S.items=S.items.filter(function(x){return x.id!==id});save();closeSheet();render();
    toast((it?it.name:'Item')+' deleted'+(v>0?'. '+m(v)+' moved to cash on hand.':''));
  },
  editpay:function(){openSheet(paySheet(false))},
  adddate:function(){
    var n=Math.round(num(gv('f-day')));if(n<1||n>31)return setErr('Use a day from 1 to 31.');
    setErr('');if(editDays.indexOf(n)<0)editDays.push(n);editDays.sort(function(a,b){return a-b});
    document.getElementById('days').innerHTML=chipsHtml();document.getElementById('f-day').value='';
  },
  rmday:function(el){editDays=editDays.filter(function(d){return d!==+el.dataset.d});document.getElementById('days').innerHTML=chipsHtml()},
  preset:function(el){editDays=el.dataset.v.split(',').map(Number);document.getElementById('days').innerHTML=chipsHtml()},
  savepay:function(){
    var a=r2(num(gv('f-pay')));
    if(a<=0)return setErr('Enter how much you get paid.');
    if(!editDays.length)return setErr('Add at least one pay date.');
    var changed=JSON.stringify(editDays)!==JSON.stringify(S.pay.days.slice().sort(function(x,y){return x-y}));
    S.pay.amount=a;S.pay.days=editDays.slice();
    if(changed||!S.pay.next)S.pay.next=nextOnOrAfter(today(),S.pay.days);
    var first=!S.ready;S.ready=true;save();closeSheet();
    if(first){ui.tab='plan';showMain();toast('Now add your bills, loans and savings. You got this!')}else render();
  },
  addowed:function(){addOwedSheet()},
  saveowed:function(){
    var n=gv('f-name').trim(),a=r2(num(gv('f-amt')));
    if(!n)return setErr('Add a name.');if(a<=0)return setErr('Enter how much they owe.');
    S.owed.push({id:uid(),name:n,original:a,balance:a,created:today(),remindOn:gv('f-remind')||''});save();closeSheet();render();toast(n+' is on your list. We will help you collect.');
  },
  owed:function(el){owedSheet(el.dataset.id)},
  payowed:function(el){
    var p=person(el.dataset.id),a=r2(num(gv('f-amt')));
    if(a<=0)return setErr('Enter the amount received.');
    if(a>p.balance+0.005)return setErr('That is more than the '+m(p.balance)+' they owe.');
    var cash=document.getElementById('f-cash').checked,d=cash?{cash:a}:{};
    addEntry({t:'owed',owedId:p.id,name:p.name,amount:a,owed:a,d:d});
    var rem=gv('f-remind');p.remindOn=(rem&&rem>today()&&p.balance>0.005)?rem:'';save();
    closeSheet();render();toast(p.balance<=0.005?p.name+' paid in full. Collected!':m(a)+' received. '+m(p.balance)+' to go.');
  },
  saveremind:function(el){var p=person(el.dataset.id);p.remindOn=gv('f-remind');save();closeSheet();render();toast(p.remindOn?'Got it. We will remind you on '+fmtDate(p.remindOn)+'.':'Reminder cleared.')},
  undoowed:function(el){undoEntry(el.dataset.id);owedSheet(el.dataset.p);render()},
  editowed:function(el){editOwedSheet(el.dataset.id)},
  saveeditowed:function(el){
    var p=person(el.dataset.id),n=gv('f-name').trim(),b=r2(num(gv('f-amt')));
    if(!n)return setErr('Add a name.');
    p.name=n;p.balance=Math.max(0,b);if(p.balance>p.original)p.original=p.balance;p.remindOn=p.balance>0.005?gv('f-remind'):'';save();closeSheet();render();
  },
  delowed:function(el){
    if(ui.arm!==el.dataset.id){ui.arm=el.dataset.id;el.textContent='Tap again to remove';return}
    ui.arm=null;S.owed=S.owed.filter(function(x){return x.id!==el.dataset.id});save();closeSheet();render();toast('Removed');
  },
  changepin:async function(){
    closeSheet();
    openGate({title:'Enter your current PIN',sub:''});
    while(true){var p=await gateInput();if(await checkPin(p))break;gateMsg('Wrong PIN.',true)}
    await createPin('Choose a new PIN');showMain();toast('PIN changed');
  },
  bio:async function(){
    if(store.get(BIOK)){store.del(BIOK);settingsSheet();toast('Fingerprint unlock is off');return}
    try{await bioSetup();settingsSheet();toast('Fingerprint or face unlock is on')}
    catch(e){setErr('This device or preview cannot set that up here. It works once Yamanly is installed on your phone. Your PIN works everywhere.')}
  },
  backup:function(){backupSheet()},
  copyback:function(){
    var ta=document.getElementById('f-back');
    var fallback=function(){ta.select();toast('Press copy on your keyboard')};
    try{navigator.clipboard.writeText(ta.value).then(function(){toast('Backup copied')},fallback)}catch(e){fallback()}
  },
  restore:function(){
    try{var d=JSON.parse(gv('f-rest'));if(!d||d.v!==1||!Array.isArray(d.items))throw 0;S=migrate(d);S.ready=true;save();closeSheet();render();toast('Backup restored')}
    catch(e){setErr('That text is not a valid backup. Copy it again in full.')}
  },
  locknow:function(){lockNow()},
  reset:function(el){
    if(ui.arm!=='reset'){ui.arm='reset';el.textContent='Tap again to erase everything';return}
    ui.arm=null;wipe();
  },
  forgot:function(){$('#forgotBox').hidden=false;$('#gForgot').hidden=true},
  forgotno:function(){$('#forgotBox').hidden=true;$('#gForgot').hidden=false},
  erase:function(){wipe()},
  start:function(){registerForm('real')},
  sample:function(){registerForm('sample')},
  register:async function(el){
    var n=gv('f-rname').trim(),em=gv('f-remail').trim(),mode=el.dataset.mode;
    if(!n)return setErr('Tell us your name, boss.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))return setErr('That email looks off. Check it?');
    await createPin();
    if(mode==='sample'){loadSample();S.profile={name:n,email:em};save();lastActive=Date.now();showMain()}
    else{S=fresh();S.profile={name:n,email:em};save();$('#onboard').hidden=true;onboardPay()}
  }
};
function wipe(){[KEY,PINK,BIOK].forEach(store.del);S=fresh();ui={tab:'home',arm:null};closeSheet();closeGate();boot()}
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-act]');if(!el)return;
  var f=act[el.dataset.act];if(f){e.preventDefault();f(el,e)}
});
var pdIds={'f-pdamt':1,'f-pddate':1,'f-pdnext':1};
function onPd(e){
  var id=e.target&&e.target.id;if(!pdIds[id])return;
  if(id==='f-pddate'&&e.target.value){var n=document.getElementById('f-pdnext');if(n)n.value=defaultNext(e.target.value)}
  updatePdPrev();
}
document.addEventListener('input',onPd);document.addEventListener('change',function(e){onPd(e);if(e.target&&(e.target.id==='scanFile'||e.target.id==='scanPick')){var f=e.target.files&&e.target.files[0];e.target.value='';doScan(f);return}if(e.target&&e.target.id==='f-time'&&e.target.value){S.settings.time=e.target.value;save()}});

/* ---------- onboarding ---------- */
function welcome(){
  var o=$('#onboard');o.hidden=false;$('#lock').hidden=true;$('#main').hidden=true;
  o.innerHTML='<div class="gate-in welcome"><div class="logo">Yamanly</div><h1>Make every sahod count.</h1>'+
    '<p class="muted">Tell Yamanly your pay once. It sets aside your bills, grows your ipon, and shows what you can actually spend. Less stress, more flex.</p>'+
    '<div class="wform" style="margin-top:8px"><button class="btn block" data-act="start">Let\'s go</button><button class="btn ghost block" data-act="sample">Peek with sample data</button></div>'+
    '<p class="small muted">Next up: your name, a 4-digit PIN, and your pay. Everything stays on this phone.</p></div>';
}
function registerForm(mode){
  var o=$('#onboard');o.hidden=false;
  o.innerHTML='<div class="gate-in welcome" style="text-align:left"><div class="logo">Yamanly</div><h1>First things first. Who are you?</h1><div class="wform">'+
    '<label class="f">Name<input id="f-rname" autocomplete="given-name" placeholder="What should we call you?"></label>'+
    '<label class="f">Email<input id="f-remail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com"></label>'+
    '<div class="err" id="err"></div><button class="btn block" data-act="register" data-mode="'+mode+'">Next</button><p class="small muted">Stays on this phone. We only use it to say hi.</p></div></div>';
}
function onboardPay(){
  var o=$('#onboard');o.hidden=false;
  o.innerHTML='<div class="gate-in welcome" style="text-align:left"><div class="logo">Yamanly</div><div class="wform">'+paySheet(true)+'</div></div>';
}
function loadSample(){
  var cur=today(),mk=cur.slice(0,7);
  S=fresh();S.ready=true;S.sample=true;
  S.pay={amount:15000,days:[15,30],next:nextOnOrAfter(cur,[15,30])};
  var mk_=function(type,name,o){var it=Object.assign({id:uid(),type:type,name:name,start:mk},o);S.items.push(it);return it};
  mk_('bill','Rent',{amount:6500,due:5});mk_('bill','Meralco',{amount:2400,due:12});mk_('bill','Converge internet',{amount:1699,due:20});mk_('bill','Phone plan',{amount:799,due:18});
  mk_('loan','SSS salary loan',{amount:1200,balance:14400,due:30});mk_('loan','Phone installment',{amount:1850,balance:11100,due:25});
  mk_('tithe','Tithes',{mode:'pct',value:10,due:30});
  var a=mk_('saving','Travel fund',{mode:'pct',value:5,target:60000}),b=mk_('saving','Gadget fund',{mode:'amt',value:500,target:25000});
  var c=mk_('invest','Pag-IBIG MP2',{mode:'amt',value:1000,target:0}),d=mk_('invest','UITF',{mode:'amt',value:500,target:0});
  var e=mk_('emergency','Emergency fund',{mode:'pct',value:4,target:120000});
  S.b={cash:3200,reserve:3000};S.b[a.id]=12500;S.b[b.id]=2500;S.b[c.id]=36000;S.b[d.id]=8000;S.b[e.id]=21000;
  S.items.forEach(function(it){if(OBLIG.indexOf(it.type)>=0&&dueDate(mk,it.due)<cur){S.log.unshift({id:uid(),t:'paid',itemId:it.id,month:mk,amount:0,full:true,name:it.name,d:{},date:cur})}});
  var tmr=iso(new Date(Date.now()+864e5));
  S.owed=[{id:uid(),name:'Ate Joy',original:3000,balance:1800,created:cur,remindOn:tmr},{id:uid(),name:'Kuya Mark',original:1500,balance:1500,created:cur,remindOn:''}];
  save();
}

/* ---------- boot ---------- */
async function boot(){
  applyTheme();
  if(!store.get(PINK)){welcome();return}
  await unlockFlow();
  if(!S.ready){onboardPay();return}
  showMain();
}
window.__hatiin={celebrate:celebrate,winOpen:winOpen,checkReminders:checkReminders,render:render,calc:calc,needsFor:needsFor,nextOnOrAfter:nextOnOrAfter,nextAfter:nextAfter,dues:dues,get S(){return S},recordPayment:recordPayment,addEntry:addEntry,act:act};
boot();
})();
