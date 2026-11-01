/* 마라톤온라인(roadrun.co.kr) 대회 목록 한 페이지(DOM) → 대회 배열. 브라우저와 Node(linkedom)에서 똑같이 쓴다 */
function parseRaces(doc, year){
  const out=[];
  const trs=[...doc.querySelectorAll('tr')].filter(t=>t.children&&t.children.length===4&&/\d{1,2}\/\d{1,2}\s*\(/.test(t.textContent));
  for(const t of trs){
    const c=[...t.children];
    const dm=c[0].textContent.replace(/\s+/g,' ').match(/(?:(\d{4})\s*)?(\d{1,2})\/(\d{1,2})/); if(!dm)continue;
    const y=+(dm[1]||year), m=+dm[2], d=+dm[3];
    const a=c[1].querySelector('a'); if(!a)continue;
    const no=((a.getAttribute('href')||'').match(/no=(\d+)/)||[])[1]||null;
    const name=a.textContent.replace(/\s+/g,' ').trim();
    const cf=c[1].querySelector('font font')||[...c[1].querySelectorAll('font')].pop();
    const courses=(cf?cf.textContent:'').split(',').map(s=>s.trim()).filter(Boolean);
    const place=c[2].textContent.replace(/\s+/g,' ').trim();
    const t3=c[3].textContent.replace(/\s+/g,' ').trim();
    const tel=(t3.match(/☎\s*([\d\-]+)/)||[])[1]||null;
    const host=t3.split('☎')[0].trim();
    const home=[...c[3].querySelectorAll('a')].map(x=>x.getAttribute('href')||'').find(h=>/^https?:\/\//.test(h))||null;
    const pad=n=>String(n).padStart(2,'0');
    out.push({id:no||`${y}${pad(m)}${pad(d)}-${name}`,date:`${y}-${pad(m)}-${pad(d)}`,name,courses,place,host,tel,home,view:no?`http://www.roadrun.co.kr/schedule/view.php?no=${no}`:null});
  }
  return out;
}
if(typeof module!=='undefined')module.exports={parseRaces};
