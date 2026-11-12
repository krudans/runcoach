/* 앱은 웹 주소(krudans.github.io/runcoach)의 화면을 불러온다 — 화면·규칙 수정은 재설치 없이 반영.
   여기서는 인터넷이 없어 처음 열지 못했을 때 보여 줄 안내 화면만 앱에 넣는다. */
const fs=require('fs'), path=require('path');
const here=path.join(__dirname,'..'), root=process.env.WEB_ROOT||path.join(here,'..'), www=path.join(here,'www');
fs.rmSync(www,{recursive:true,force:true}); fs.mkdirSync(www,{recursive:true});
const page=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>가지런</title><style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
background:#F3EFF8;color:#24152F;font-family:system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
h1{font-size:20px;margin:0}p{font-size:14px;color:#5E546B;margin:0;line-height:1.6}
button{height:48px;padding:0 28px;border:0;border-radius:999px;background:#5B2D86;color:#fff;font-size:16px;font-weight:700}</style></head>
<body><h1>인터넷 연결이 필요해요</h1><p>처음 열 때 한 번만 필요해요.<br>그 뒤로는 신호가 없어도 열려요.</p>
<button onclick="location.replace('https://krudans.github.io/runcoach/')">다시 열기</button></body></html>`;
fs.writeFileSync(path.join(www,'index.html'),page); fs.writeFileSync(path.join(www,'offline.html'),page);
const h=fs.readFileSync(path.join(root,'index.html'),'utf8');
const v=(h.match(/APPVER='([\d.]+)'/)||[])[1]||'0.0';
fs.writeFileSync(path.join(here,'.appver'),v);
console.log('www 준비됨 — 웹 버전',v);
