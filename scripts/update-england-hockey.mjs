import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const SOURCE='https://west.englandhockey.co.uk/clubs/bude-hc/fixtures';
const OUT=new URL('../public/fixtures.json',import.meta.url);

const TEAMS=[
  {key:'m1',name:'Bude M1',aliases:['Bude M1']},
  {key:'m2',name:"Men's Development",aliases:['Bude M2 Dev','Bude M2']},
  {key:'w1',name:'Ladies 1',aliases:['Bude W1']},
  {key:'w2',name:'Ladies Development',aliases:['Bude W2 Dev','Bude W2']}
];
const LEAGUES={m1:"Men's Piran Division 1",m2:"Men's Piran Division 3",w1:"Women's Trelawney Division 2",w2:"Women's Trelawney Division 3"};
const MONTHS={January:0,February:1,March:2,April:3,May:4,June:5,July:6,August:7,September:8,October:9,November:10,December:11};

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const teamFor=s=>TEAMS.find(t=>t.aliases.some(a=>clean(s).toLowerCase()===a.toLowerCase()||clean(s).toLowerCase().includes(a.toLowerCase())));
const scoreRx=/\b(\d{1,2})\s*[–-]\s*(\d{1,2})\b/;
const dtRx=/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\s*\|\s*(\d{1,2}:\d{2})/i;

function toStamp(day,month,year,time){
  const [hh,mm]=time.split(':').map(Number);
  const m=Object.entries(MONTHS).find(([k])=>k.toLowerCase()===month.toLowerCase())?.[1]??0;
  return Date.UTC(Number(year),m,Number(day),hh,mm);
}
function shortDate(stamp){
  return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/London'}).format(new Date(stamp));
}
function extractVenue(lines,dateLineIndex){
  const bad=/^(match details|competition group|competition name|last updated|venue details|teams|head to head|more info|view match details|fixtures|results)$/i;
  for(let i=dateLineIndex+1;i<Math.min(lines.length,dateLineIndex+10);i++){
    const x=clean(lines[i]);
    if(!x||bad.test(x)||/^\d{1,2}:\d{2}$/.test(x)) continue;
    if(teamFor(x)||/\bHC\b/.test(x)) continue;
    if(/^[A-Z\s-]+GROUP$/.test(x)) continue;
    if(/division|piran|trelawney/i.test(x)) continue;
    return x;
  }
  const vi=lines.findIndex(x=>/^Venue Details$/i.test(clean(x)));
  if(vi>=0){
    for(let i=vi+1;i<Math.min(lines.length,vi+5);i++){
      const x=clean(lines[i]);
      if(x&&!bad.test(x)) return x;
    }
  }
  return '';
}
function parseFixturePage(title,body,url){
  const titleText=clean(title).replace(/\s*\|\s*West Hockey\s*$/i,'');
  const tm=titleText.match(/^(.*?)\s+vs\s+(.*?)$/i);
  if(!tm) return null;
  const home=clean(tm[1]),away=clean(tm[2]);
  const budeTeam=teamFor(home)||teamFor(away);
  if(!budeTeam) return null;
  const bodyClean=clean(body);
  const dt=bodyClean.match(dtRx);
  if(!dt) return null;
  const stamp=toStamp(dt[1],dt[2],dt[3],dt[4]);
  const lines=String(body||'').split(/\n+/).map(clean).filter(Boolean);
  const dateNeedle=`${dt[1]} ${dt[2]} ${dt[3]}`;
  const dateLineIndex=Math.max(0,lines.findIndex(x=>x.includes(dateNeedle)));
  const venue=extractVenue(lines,dateLineIndex);
  const sm=bodyClean.match(scoreRx);
  const isHome=teamFor(home)?.key===budeTeam.key;
  const opponent=isHome?away:home;
  let budeScore=null,oppScore=null;
  if(sm){
    const a=Number(sm[1]),b=Number(sm[2]);
    budeScore=isHome?a:b; oppScore=isHome?b:a;
  }
  return {
    team:budeTeam.name,key:budeTeam.key,league:LEAGUES[budeTeam.key],
    home,away,isHome,opponent,dateStamp:stamp,date:shortDate(stamp),
    time:dt[4],venue,source:url,budeScore,oppScore
  };
}

async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1200}});
    await page.goto(SOURCE,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForTimeout(12000);
    try{await page.waitForLoadState('networkidle',{timeout:15000});}catch{}
    const links=await page.evaluate(()=>[...new Set([...document.querySelectorAll('a[href*="/fixtures/"]')].map(a=>a.href.split('?')[0]))]);
    if(!links.length) throw new Error('England Hockey loaded but no fixture links were found; refusing to keep stale data as a successful sync.');

    const parsed=[];
    for(const url of links.slice(0,120)){
      const p=await browser.newPage({viewport:{width:1280,height:1000}});
      try{
        await p.goto(url+'?tab=moreinfo',{waitUntil:'domcontentloaded',timeout:45000});
        await p.waitForTimeout(1200);
        const data=parseFixturePage(await p.title(),await p.locator('body').innerText(),url);
        if(data) parsed.push(data);
      }catch(e){console.warn('Skipped fixture',url,e.message)}
      finally{await p.close()}
    }
    if(!parsed.length) throw new Error('No Bude fixtures could be parsed from England Hockey.');

    const now=Date.now();
    const fixtures=[];
    const results=[];
    for(const t of TEAMS){
      const teamMatches=parsed.filter(x=>x.key===t.key).sort((a,b)=>a.dateStamp-b.dateStamp);
      const next=teamMatches.find(x=>x.dateStamp>=now-6*60*60*1000 && x.budeScore===null);
      if(next){
        fixtures.push({
          team:next.team,league:next.league,date:next.date,
          fixture:`${next.home} v ${next.away}`,
          meta:[next.time,next.isHome?'Home':'Away',next.venue].filter(Boolean).join(' • '),
          location:next.venue,source:next.source
        });
      }
      const previous=teamMatches.filter(x=>x.dateStamp<now && x.budeScore!==null).sort((a,b)=>b.dateStamp-a.dateStamp)[0];
      if(previous){
        results.push({
          team:previous.team,league:previous.league,date:previous.date,
          score:`${previous.budeScore}–${previous.oppScore}`,
          opponent:previous.opponent,
          venue:previous.isHome?'Home':'Away',
          location:previous.venue,source:previous.source
        });
      }
    }
    if(fixtures.length<2) throw new Error(`Only ${fixtures.length} upcoming Bude fixtures parsed; refusing to overwrite the site with incomplete data.`);
    const payload={updated:new Date().toISOString(),source:SOURCE,automatic:true,fixtures,results};
    await fs.writeFile(OUT,JSON.stringify(payload,null,2)+'\n','utf8');
    console.log(JSON.stringify(payload,null,2));
  }finally{await browser.close()}
}
main().catch(err=>{console.error(err);process.exit(1)});