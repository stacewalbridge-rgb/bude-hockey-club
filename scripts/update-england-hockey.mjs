import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const SOURCE = 'https://west.englandhockey.co.uk/clubs/bude-hc/fixtures';
const OUT = new URL('../public/fixtures.json', import.meta.url);

const TEAMS = [
  { key:'m1', name:'Bude M1', aliases:['Bude M1','Bude 1','Bude Mens 1','Bude Men\'s 1'] },
  { key:'m2', name:"Men's Development", aliases:['Bude M2 Dev','Bude M2','Bude Mens 2','Bude Men\'s Development','Bude Development'] },
  { key:'w1', name:'Ladies 1', aliases:['Bude W1','Bude Ladies 1','Bude Womens 1','Bude Women\'s 1'] },
  { key:'w2', name:'Ladies Development', aliases:['Bude W2 Dev','Bude W2','Bude Ladies Development','Bude Womens 2','Bude Women\'s Development'] },
];

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const lines=s=>String(s||'').split(/\n+/).map(clean).filter(Boolean);
const hasAny=(s,arr)=>arr.some(a=>s.toLowerCase().includes(a.toLowerCase()));
const dateRx=/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i;
const timeRx=/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/;
const scoreRx=/\b\d{1,2}\s*[-–:]\s*\d{1,2}\b/;

function leagueFor(k){
  return ({m1:"Men's Piran Division 1",m2:"Men's Piran Division 3",w1:"Women's Trelawney Division 2",w2:"Women's Trelawney Division 3"})[k];
}
function classifyTeam(text){
  return TEAMS.find(t=>hasAny(text,t.aliases));
}
function dedupe(items, keyFn){
  const m=new Map();
  for(const x of items){ const k=keyFn(x); if(!m.has(k)) m.set(k,x); }
  return [...m.values()];
}
function scoreParts(s){
  const m=s.match(/(\d{1,2})\s*[-–:]\s*(\d{1,2})/); return m?[+m[1],+m[2]]:null;
}
function parseBlock(raw){
  const text=clean(raw);
  const team=classifyTeam(text);
  if(!team) return null;
  const ls=lines(raw);
  const date=(text.match(dateRx)||[])[0]||'';
  const time=(text.match(timeRx)||[])[0]||'';
  const score=(text.match(scoreRx)||[])[0]||'';
  const venueLine=ls.find(x=>/(venue|pitch|school|college|sports|astro|leisure|road|street|lane|centre|center|club|ground|park|truro|bude|bodmin|plymouth|newquay|falmouth|st austell|penair)/i.test(x) && !classifyTeam(x))||'';
  const isHome=/\bhome\b/i.test(text);
  const isAway=/\baway\b/i.test(text);
  const opponentLine=ls.find(x=>{
    if(classifyTeam(x)) return false;
    if(dateRx.test(x)||timeRx.test(x)||scoreRx.test(x)) return false;
    if(/fixtures|results|venue|home|away|league|division|push|report|details/i.test(x)) return false;
    return x.length>2 && x.length<100;
  })||'';
  return {team, text, date, time, score, venueLine, isHome, isAway, opponentLine, rawLines:ls};
}

async function main(){
  let previous={fixtures:[],results:[]};
  try{ previous=JSON.parse(await fs.readFile(OUT,'utf8')); }catch{}
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1200}});
  try{
    await page.goto(SOURCE,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForTimeout(10000);
    try{ await page.waitForLoadState('networkidle',{timeout:15000}); }catch{}
    const blocks=await page.evaluate(()=>{
      const selectors=['tr','article','li','[class*="fixture"]','[class*="result"]','[class*="match"]','[class*="card"]','[role="row"]'];
      const out=[];
      for(const sel of selectors){
        for(const el of document.querySelectorAll(sel)){
          const t=(el.innerText||'').trim();
          if(t.length>=10 && t.length<=1800) out.push(t);
        }
      }
      out.push(document.body.innerText||'');
      return [...new Set(out)];
    });
    const parsed=blocks.map(parseBlock).filter(Boolean);
    const now=new Date();
    const fixtures=[];
    const results=[];
    for(const p of parsed){
      const source=SOURCE;
      if(p.score){
        const sp=scoreParts(p.score);
        const budeFirst=p.text.toLowerCase().indexOf('bude')<=p.text.toLowerCase().search(/\d{1,2}\s*[-–:]\s*\d{1,2}/);
        const score=sp?(budeFirst?sp.join('–'):sp.reverse().join('–')):p.score.replace(':','–');
        results.push({
          team:p.team.name,
          league:leagueFor(p.team.key),
          date:p.date,
          score,
          opponent:p.opponentLine,
          venue:p.isHome?'Home':p.isAway?'Away':p.venueLine,
          location:p.venueLine,
          source
        });
      } else if(p.date || p.time || p.isHome || p.isAway){
        fixtures.push({
          team:p.team.name,
          league:leagueFor(p.team.key),
          date:p.date,
          fixture:p.opponentLine || p.rawLines.slice(0,4).join(' • '),
          meta:[p.time,p.isHome?'Home':p.isAway?'Away':'',p.venueLine].filter(Boolean).join(' • '),
          location:p.venueLine,
          source
        });
      }
    }
    const cleanFixtures=dedupe(fixtures,x=>[x.team,x.date,x.fixture,x.meta].join('|')).slice(0,12);
    const cleanResults=dedupe(results,x=>[x.team,x.date,x.score,x.opponent].join('|')).slice(0,12);
    if(!cleanFixtures.length && !cleanResults.length) throw new Error('No Bude fixture/result blocks found');
    const payload={
      updated:new Date().toISOString(),
      source:SOURCE,
      automatic:true,
      fixtures:cleanFixtures.length?cleanFixtures:previous.fixtures||[],
      results:cleanResults.length?cleanResults:previous.results||[]
    };
    await fs.writeFile(OUT,JSON.stringify(payload,null,2)+'\n','utf8');
    console.log('Updated',payload.fixtures.length,'fixtures and',payload.results.length,'results');
  } finally { await browser.close(); }
}
main().catch(err=>{ console.error(err); process.exit(1); });
