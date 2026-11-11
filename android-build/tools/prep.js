/* 웹앱 파일을 앱에 넣을 폴더(www)로 복사하고, 안드로이드 다리 스크립트를 끼운다. */
const fs=require('fs'), path=require('path');
const here=path.join(__dirname,'..'), root=process.env.WEB_ROOT||path.join(here,'..'), www=path.join(here,'www');
fs.rmSync(www,{recursive:true,force:true}); fs.mkdirSync(www,{recursive:true});
const skip=new Set(['admin.html','sw.js']);
for(const f of fs.readdirSync(root)){
  const p=path.join(root,f); if(!fs.statSync(p).isFile())continue;
  if(skip.has(f)||!/\.(html|png|jpg|jpeg|svg|json|ico|webp|woff2?|css|js|txt)$/i.test(f))continue;
  if(/^package(-lock)?\.json$/.test(f))continue;
  fs.copyFileSync(p,path.join(www,f));
}
fs.copyFileSync(path.join(here,'node_modules/@capacitor/core/dist/capacitor.js'),path.join(www,'capacitor-core.js'));
fs.copyFileSync(path.join(here,'native/native.js'),path.join(www,'native.js'));
let h=fs.readFileSync(path.join(www,'index.html'),'utf8');
const m=h.match(/<head[^>]*>/i); if(!m)throw new Error('index.html: <head> 없음');
h=h.replace(m[0],m[0]+'\n<script src="capacitor-core.js"></script>\n<script src="native.js"></script>');
fs.writeFileSync(path.join(www,'index.html'),h);
const v=(h.match(/APPVER='([\d.]+)'/)||[])[1]||'0.0';
fs.writeFileSync(path.join(here,'.appver'),v);
console.log('www 준비됨 — 앱 버전',v,'· 파일',fs.readdirSync(www).length);
