#!/usr/bin/env python3
"""Builds www/ from src/head.html + src/app.js + src/native.js. Run from the project root."""
import os, re, shutil
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd=lambda p:open(os.path.join(R,p),encoding='utf-8').read()
head=rd('src/head.html'); app=rd('src/app.js'); native=rd('src/native.js')

def rep(s,old,new,n=1):
    assert s.count(old)==n,('patch missed',old[:70],s.count(old))
    return s.replace(old,new)

# ---- app.js patches (the web version stays untouched) ----
app=rep(app,"async function bioSetup(){\n","async function bioSetup(){\n  if(window.NATIVE&&NATIVE.bio){await NATIVE.bio.setup();store.set(BIOK,'native');return}\n")
app=rep(app,"async function bioAuth(){\n  try{\n","async function bioAuth(){\n  if(window.NATIVE&&NATIVE.bio)return store.get(BIOK)?NATIVE.bio.auth():false;\n  try{\n")
app=rep(app,"function ensureScan(){\n  if(scan.state!=='idle')return;","function ensureScan(){\n  if(window.NATIVE&&NATIVE.scan){scan.ok=true;scan.fn=NATIVE.scan;scan.state='done';return}\n  if(scan.state!=='idle')return;")
app=rep(app,"var notifOK=function(){return 'Notification' in window};","var notifOK=function(){return !!window.NATIVE||'Notification' in window};\nasync function reqPerm(){if(window.NATIVE)return NATIVE.requestPerm();try{return await Notification.requestPermission()}catch(e){return 'denied'}}")
app=rep(app,"function notifState(){if(!notifOK())return 'unsupported';","function notifState(){if(window.NATIVE)return NATIVE.notifState();if(!notifOK())return 'unsupported';")
app=rep(app,"function showNative(title,body,tag){\n  if(notifState()!=='granted')return false;","function showNative(title,body,tag){\n  if(notifState()!=='granted')return false;\n  if(window.NATIVE)return NATIVE.notify(title,body,tag);")
app=rep(app,"var pr='denied';try{pr=await Notification.requestPermission()}catch(e){}","var pr=await reqPerm();")
app=rep(app,"if(notifOK()&&notifState()==='default'){try{await Notification.requestPermission()}catch(e){}}","if(notifOK()&&notifState()==='default'){await reqPerm()}")
app=rep(app,"  var dl=null;\n","  if(window.NATIVE){try{await NATIVE.savePdf(name,buf);toast('PDF ready')}catch(e){if(!e||!/cancel|dismiss/i.test(String(e.message||e)))toast('Could not save the PDF.')}return}\n  var dl=null;\n")
app=rep(app,"function save(){store.set(KEY,JSON.stringify(S))}","function save(){store.set(KEY,JSON.stringify(S));if(window.NATIVE)NATIVE.sync()}")
app=rep(app,"BETA. The photo goes to Claude only to read the tag. Nothing is saved. Always check the price it reads.","BETA. The tag is read on your phone, nothing is uploaded or saved. Always check the price it reads.")
app=rep(app,"scanFail('Scanning needs your OK to use Claude. You can still type items in.')","scanFail('Scanning needs camera access. Allow it in your phone settings, or type items in.')")
# scheduled reminders + back button hook, placed right before showNative
hook='''function upcomingReminders(){
  var out=[],cur=today(),lead=+S.settings.lead||0;
  if(!S.ready||!S.settings.notify)return out;
  dues().forEach(function(c){
    if(c.paid||c.it.remind===false||c.due<cur)return;
    out.push({key:'due:'+c.it.id+':'+c.month+':'+lead,at:atTime(c.due,lead),title:'Hey boss! Due date for '+c.it.name+' is coming!',body:m(c.left||c.amount)+' due '+fmtDate(c.due)+'. Tap to mark it paid.'});
  });
  S.owed.forEach(function(p){
    if(!p.remindOn||p.balance<=0.005)return;
    out.push({key:'owed:'+p.id+':'+p.remindOn,at:atTime(p.remindOn,0),title:'Hey boss! Time to claim your money',body:p.name+' still owes you '+m(p.balance)+'.'});
  });
  return out;
}
window.__yam={upcoming:upcomingReminders,back:function(){
  if(G.open)return true;
  if($('#layer').innerHTML){closeSheet();return true}
  if(ui.tab!=='home'){ui.tab='home';render();window.scrollTo(0,0);return true}
  return false;
}};
'''
app=rep(app,"function showNative(title,body,tag){",hook+"function showNative(title,body,tag){")
app=rep(app,"Phone notifications are blocked. Allow them in your browser or phone settings.","Phone notifications are blocked. Allow them in your phone settings.")
app=rep(app,"Phone notifications work in the installed app.","Phone notifications work in the installed app.")

# ---- head.html -> full document ----
head=re.sub(r'<title>.*?</title>\n<meta name="claude:viewport-fit-sides"[^>]*>\n','',head,flags=re.S)
head=re.sub(r'<link rel="preconnect"[^>]*>\n','',head)
head=re.sub(r'<link href="https://fonts.googleapis.com[^>]*>\n','',head)
fonts=''
for fam,w,file in [('Bricolage Grotesque',600,'bricolage-grotesque-latin-600-normal'),('Bricolage Grotesque',700,'bricolage-grotesque-latin-700-normal'),('Figtree',400,'figtree-latin-400-normal'),('Figtree',500,'figtree-latin-500-normal'),('Figtree',600,'figtree-latin-600-normal'),('Figtree',700,'figtree-latin-700-normal')]:
    fonts+="@font-face{font-family:'%s';font-weight:%d;font-style:normal;font-display:swap;src:url(fonts/%s.woff2) format('woff2')}\n"%(fam,w,file)
shell_css='''html{color-scheme:light}html:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}
'''
k=head.rindex('</style>')+len('</style>')
head=head[:k]+'\n</head>\n<body>'+head[k:]
doc=('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n'
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
 '<meta name="theme-color" content="#0D3B2E"><title>Yamanly</title>\n<style>\n'+fonts+shell_css+'</style>\n'+head+
 '\n<script src="capacitor.js"></script>\n<script src="jspdf.umd.min.js"></script>\n<script>\n'+native+'\n</script>\n<script>\n'+app+'\n</script>\n</body></html>\n')
out=os.path.join(R,'www');os.makedirs(out+'/fonts',exist_ok=True)
open(out+'/index.html','w',encoding='utf-8').write(doc)
nm=os.path.join(R,'node_modules')
shutil.copy(nm+'/@capacitor/core/dist/capacitor.js',out+'/capacitor.js')
shutil.copy(nm+'/jspdf/dist/jspdf.umd.min.js',out+'/jspdf.umd.min.js')
for fam in ['bricolage-grotesque','figtree']:
    d=nm+'/@fontsource/%s/files/'%fam
    for f in os.listdir(d):
        if re.search(r'-latin-(400|500|600|700)-normal\.woff2$',f): shutil.copy(d+f,out+'/fonts/'+f)
print('www built',len(doc),'bytes')
