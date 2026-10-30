/* Native bridge for the Android app. Loads before app.js. Does nothing in a normal browser. */
(function(){
  var C=window.Capacitor;
  if(!C||!C.isNativePlatform||!C.isNativePlatform())return;
  var P=function(n){try{return C.registerPlugin(n)}catch(e){return null}};
  var LN=P('LocalNotifications'),FS=P('Filesystem'),SH=P('Share'),APP=P('App'),SB=P('SystemBars'),
      BIO=P('BiometricAuthNative'),OCR=P('TextRecognition');
  var N=window.NATIVE={},perm='default';

  /* ---------- notifications ---------- */
  N.notifState=function(){return perm};
  N.refreshPerm=async function(){try{var r=await LN.checkPermissions();perm=r.display==='granted'?'granted':r.display==='denied'?'denied':'default'}catch(e){}return perm};
  N.requestPerm=async function(){try{var r=await LN.requestPermissions();perm=r.display==='granted'?'granted':'denied'}catch(e){}return perm};
  var hash=function(s){var h=7;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)%2000000000+1};
  N.notify=function(title,body,tag){
    if(perm!=='granted')return false;
    LN.schedule({notifications:[{id:hash('now:'+tag+Date.now()),title:title,body:body,schedule:{at:new Date(Date.now()+700),allowWhileIdle:true},smallIcon:'ic_stat_yamanly'}]}).catch(function(){});
    return true;
  };
  var syncT=null;
  N.sync=function(){
    clearTimeout(syncT);
    syncT=setTimeout(async function(){
      try{
        if(perm!=='granted'||!window.__yam)return;
        var pend=await LN.getPending();
        if(pend&&pend.notifications&&pend.notifications.length)await LN.cancel({notifications:pend.notifications.map(function(n){return{id:n.id}})});
        var list=window.__yam.upcoming().filter(function(x){return x.at.getTime()>Date.now()+5000}).slice(0,60);
        if(!list.length)return;
        await LN.schedule({notifications:list.map(function(x){return{id:hash(x.key),title:x.title,body:x.body,schedule:{at:x.at,allowWhileIdle:true},smallIcon:'ic_stat_yamanly'}})});
      }catch(e){}
    },900);
  };

  /* ---------- biometrics ---------- */
  N.bio={
    available:async function(){try{var r=await BIO.checkBiometry();return !!r.isAvailable}catch(e){return false}},
    setup:async function(){
      if(!BIO)throw new Error('Fingerprint unlock is not available in this version.');
      var r;try{r=await BIO.checkBiometry()}catch(e){throw new Error('Could not reach the fingerprint sensor. Please try again.')}
      if(!r.isAvailable){
        var why=String(r.code||r.reason||'');
        throw new Error(/NotEnrolled|biometryNotEnrolled/i.test(why)?'No fingerprint or face is saved on this phone yet. Add one in your phone Settings under Security, then try again.':/NotAvailable|biometryNotAvailable|none/i.test(why)?'This phone does not support fingerprint or face unlock.':'Fingerprint or face unlock is not ready on this phone. Check your phone Settings under Security.');
      }
      try{await BIO.authenticate({reason:'Turn on fingerprint or face unlock',cancelTitle:'Cancel',allowDeviceCredential:false,androidTitle:'Yamanly',androidSubtitle:'Confirm it is you'})}
      catch(e){var c=String((e&&(e.code||e.message))||'');throw new Error(/cancel/i.test(c)?'Cancelled. Nothing was changed.':/lockout/i.test(c)?'Too many tries. Wait a bit, then try again.':'That did not work. Please try again.')}
    },
    auth:async function(){
      try{await BIO.authenticate({reason:'Unlock Yamanly',cancelTitle:'Use PIN',allowDeviceCredential:false,androidTitle:'Yamanly',androidSubtitle:'Unlock with fingerprint or face'});return true}catch(e){return false}
    }
  };

  /* ---------- PDF ---------- */
  var toB64=function(buf){var b=new Uint8Array(buf),s='',i=0;for(;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s)};
  N.savePdf=async function(name,buf){
    await FS.writeFile({path:name,data:toB64(buf),directory:'CACHE'});
    var u=await FS.getUri({path:name,directory:'CACHE'});
    await SH.share({title:'Yamanly activity',files:[u.uri],dialogTitle:'Save or share your activity PDF'});
  };

  /* ---------- price tag reading (on the phone, no internet) ---------- */
  var PRICE=/(?:₱|PHP|Php|P)?\s*(\d{1,3}(?:,\d{3})+|\d{1,5})(?:[.,](\d{2}))?(?!\d)/g;
  N.parseTag=function(res){
    var lines=[];
    (res.blocks||[]).forEach(function(b){(b.lines||[]).forEach(function(l){
      var bb=l.boundingBox||{},h=Math.abs(bb.height||((bb.bottom||0)-(bb.top||0))||0);
      lines.push({t:String(l.text||'').trim(),h:h,top:bb.top||bb.y||0});
    })});
    var cands=[],kilo=false,per100=false;
    lines.forEach(function(L){
      var low=L.t.toLowerCase();
      var isOld=/\b(was|dating|orig|regular|reg\.?|srp|save|off|disc)\b/.test(low);
      var perKg=/(\/|per\s*)(kg|kilo)|\bkg\b/.test(low),per100g=/100\s?g|per\s?100/.test(low);
      var m;PRICE.lastIndex=0;
      while((m=PRICE.exec(L.t))){
        var raw=m[1].replace(/,/g,''),dec=m[2]?m[2]:null,val=parseFloat(raw+(dec?'.'+dec:''));
        var hasSym=/₱|php|\bp\s*\d/i.test(m[0]);
        if(!(val>0)||val>99999)continue;
        if(!dec&&!hasSym&&val>500)continue;                 // likely a barcode piece or weight
        if(/\b\d{1,4}\s?(g|ml|kg|l|pcs|pc|oz)\b/i.test(L.t.slice(m.index,m.index+m[0].length+4))&&!hasSym&&!dec)continue; // sizes
        var sc=(L.h||10)+(dec?25:0)+(hasSym?35:0)-(isOld?60:0)-(perKg||per100g?40:0);
        cands.push({val:val,sc:sc,perKg:perKg,per100g:per100g});
      }
    });
    if(!cands.length)return {error:'unreadable'};
    cands.sort(function(a,b){return b.sc-a.sc});
    var best=cands[0];
    var nameLine=lines.filter(function(L){return /[A-Za-z]{3,}/.test(L.t)&&!/^(₱|php|p)?\s*[\d.,]+\s*$/i.test(L.t)&&!/\b(srp|sale|promo|barcode|price)\b/i.test(L.t)})
      .sort(function(a,b){return (b.t.replace(/[^A-Za-z]/g,'').length)-(a.t.replace(/[^A-Za-z]/g,'').length)})[0];
    var out={name:nameLine?nameLine.t.slice(0,60):'',price:best.val,note:''};
    if(best.perKg)out.note='price per kg';else if(best.per100g)out.note='price per 100g';
    return out;
  };
  N.scan={
    json:async function(prompt,opts){
      var blob=opts&&opts.images;if(!blob||!OCR)throw {code:'images_unavailable'};
      var name='scan-'+Date.now()+'.jpg',data=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(String(r.result).split(',')[1])};r.onerror=rej;r.readAsDataURL(blob)});
      await FS.writeFile({path:name,data:data,directory:'CACHE'});
      var u=await FS.getUri({path:name,directory:'CACHE'});
      var res;try{res=await OCR.processImage({path:u.uri})}finally{FS.deleteFile({path:name,directory:'CACHE'}).catch(function(){})}
      return N.parseTag(res);
    },
    limits:async function(){return {images:{maxCount:1}}}
  };

  /* ---------- back button, status bar, resume ---------- */
  if(APP){
    APP.addListener('backButton',function(){
      var handled=false;try{handled=window.__yam&&window.__yam.back()}catch(e){}
      if(!handled)APP.minimizeApp();
    });
    APP.addListener('resume',function(){N.refreshPerm().then(function(){N.sync()})});
  }
  function bar(){
    if(!SB)return;
    var dark=document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches);
    SB.setStyle({style:dark?'DARK':'LIGHT'}).catch(function(){});
  }
  document.addEventListener('DOMContentLoaded',function(){bar();N.refreshPerm().then(function(){N.sync()})});
  new MutationObserver(bar).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();
