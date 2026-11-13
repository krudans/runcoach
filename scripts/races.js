/* 하루 한 번 깃허브 액션이 돌린다 — 마라톤온라인(roadrun.co.kr) 국내 대회 일정 → races.json
   · 올해·내년 목록 + 지역별·접수중 목록으로 지역과 접수 여부를 붙인다 (요청 약 40번, 사이에 1초 쉼)
   · 원본 링크를 항상 남긴다. 너무 적게 읽히면(사이트 형식 변경) 기존 파일을 덮어쓰지 않고 실패로 끝낸다 */
const fs=require('fs'), path=require('path');
const iconv=require('iconv-lite');
const {DOMParser}=require('linkedom');
const {parseRaces}=require('./races-parse.js');
const URL='http://www.roadrun.co.kr/schedule/list.php';
const AREAS=['서울','경기','인천','강원','충북','충남','대전','전북','전남','광주','경북','대구','경남','부산','울산','제주','세종','해외','기타'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const enc=s=>[...iconv.encode(String(s),'euc-kr')].map(b=>'%'+b.toString(16).toUpperCase().padStart(2,'0')).join('');
async function list(params){
  const body=Object.entries(params).map(([k,v])=>`${k}=${enc(v)}`).join('&');
  const r=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'GAJI-RUN race calendar (personal app; daily)'},body});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const html=iconv.decode(Buffer.from(await r.arrayBuffer()),'euc-kr');
  await sleep(1000);
  return parseRaces(new DOMParser().parseFromString(html,'text/html'),+params.syear_key);
}
(async()=>{
  const now=new Date(Date.now()+9*3600e3), y=now.getUTCFullYear(), today=now.toISOString().slice(0,10);
  const all=new Map();
  for(const yr of [y,y+1]){
    for(const r of await list({syear_key:yr}))all.set(r.id,r);
    for(const a of AREAS){ for(const r of await list({syear_key:yr,area_key:a})){ const x=all.get(r.id); if(x)x.area=a; } }
    for(const r of await list({syear_key:yr,take_key:'접수중'})){ const x=all.get(r.id); if(x)x.open=true; }
  }
  const races=[...all.values()].filter(r=>r.date>=today).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0)
    .map(r=>Object.assign(r,{area:r.area||null,open:!!r.open}));
  /* 접수 마감 — 사이트는 '접수중'만 알려 준다. 어제 파일에서 접수중(또는 이미 마감)이었는데 오늘 접수중이 아니면 마감으로 적는다.
     오늘 접수중이 하나도 안 읽혔으면(사이트 오류) 어제 표시를 그대로 둔다 */
  { let prev={}; try{ for(const r of JSON.parse(fs.readFileSync(path.join(__dirname,'..','races.json'),'utf8')).races||[])prev[r.id]=r; }catch(e){}
    const anyOpen=races.some(r=>r.open);
    for(const r of races){ const p=prev[r.id]; if(r.open)continue; if(p&&(p.closed||(anyOpen&&p.open)))r.closed=true; } }
  if(races.length<20)throw new Error('너무 적게 읽힘: '+races.length+'개 — 사이트 형식이 바뀌었을 수 있음');
  const out={updated:new Date().toISOString(),source:'마라톤온라인 (roadrun.co.kr · marathon.pe.kr)',sourceUrl:'http://www.marathon.pe.kr/schedule_index.html',count:races.length,races};
  fs.writeFileSync(path.join(__dirname,'..','races.json'),JSON.stringify(out));
  console.log('races',races.length);
})().catch(e=>{ console.error(e); process.exit(1); });
