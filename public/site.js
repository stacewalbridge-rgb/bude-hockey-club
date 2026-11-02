const menuBtn=document.querySelector('.menu-btn');
const mobileNav=document.querySelector('.mobile-nav');
if(menuBtn&&mobileNav){
  menuBtn.addEventListener('click',()=>{
    const open=mobileNav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded',open?'true':'false');
  });
  mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    mobileNav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded','false');
  }));
}
function updateHomeGameBanner(){
  const cards=[...document.querySelectorAll('.fixture-card')];
  const home=cards.filter(card=>(card.querySelector('.fixture-meta')?.textContent||'').toLowerCase().includes('home'));
  cards.forEach(card=>card.classList.remove('home-fixture'));
  home.forEach(card=>card.classList.add('home-fixture'));
  const banner=document.getElementById('home-game-banner');
  if(banner) banner.hidden=home.length===0;
}
async function loadFixtures(){
  const grid=document.getElementById('fixtures-grid');
  const resultsGrid=document.getElementById('results-grid');
  if(!grid) return;
  try{
    const res=await fetch('/fixtures.json',{cache:'no-store'});
    if(!res.ok) return;
    const data=await res.json();
    if(Array.isArray(data.fixtures)&&data.fixtures.length){
      grid.innerHTML=data.fixtures.map(f=>`
        <article class="fixture-card">
          <div class="fixture-team">${f.team}</div>
          <div class="fixture-league">${f.league||''}</div>
          <div class="fixture-date">${f.date}</div>
          <div class="fixture-opponent">${f.fixture}</div>
          <div class="fixture-meta">${f.meta||''}</div>
          <div class="fixture-home-badge" style="${(f.meta||'').toLowerCase().includes('home')?'':'display:none'}">HOME GAME • BUDEHAVEN ASTRO TURF PITCH</div>
          <div class="fixture-source"><a class="link" href="${f.source}" target="_blank" rel="noreferrer">England Hockey ↗</a></div>
        </article>`).join('');
    }
    if(resultsGrid && Array.isArray(data.results) && data.results.length){
      resultsGrid.innerHTML=data.results.map(r=>{
        const m=String(r.score||'').match(/(\d+)\s*[-–:]\s*(\d+)/);
        const win=m && Number(m[1])>Number(m[2]);
        return `
        <div class="result-card ${win?'win-result':''}">
          <div class="result-topline"><strong>${r.team}</strong>${win?'<span class="win-stars" title="Bude win" aria-label="Bude win">★ ★ ★</span>':''}</div>
          <div class="score">${r.score}</div>
          <div>${r.opponent||''}${r.venue?' • '+r.venue:''}</div>
          ${Array.isArray(r.scorers)&&r.scorers.length?'<div class="goal-scorers"><strong>Goal scorers</strong><div>'+r.scorers.map(s=>'<span class="scorer-chip">'+(s.name||'Name Withheld')+(s.minute?' <small>'+s.minute+'’</small>':'')+'</span>').join('')+'</div></div>':''}
          ${win?'<div class="win-splash" aria-hidden="true"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>':''}
        </div>`;
      }).join('');
    } else if(resultsGrid){
      resultsGrid.innerHTML='<div class="result-card">Results are being updated from England Hockey.</div>';
    }
    updateHomeGameBanner();
  }catch(e){console.warn('Automatic England Hockey data failed',e)}
}
loadFixtures();
updateHomeGameBanner();


/* Load the supplied full-quality team images without the old tiny thumbnails. */
const teamImagePayloads={
  'assets/team-m1.webp':['/assets/data/final-team-m1.b64'],
  'assets/team-mens-development.webp':['/assets/data/final-team-mens-development.b64'],
  'assets/team-ladies-1.webp':['/assets/data/final-team-ladies-1.b64'],
  'assets/team-ladies-development.webp':['/assets/data/final-team-ladies-development-0.b64','/assets/data/final-team-ladies-development-1.b64'],
  'assets/team-juniors.webp':['/assets/data/final-team-juniors-0.b64','/assets/data/final-team-juniors-1.b64']
};
async function loadTeamImagePayload(img){
  const raw=(img.getAttribute('src')||'').replace(/^\//,'');
  const parts=teamImagePayloads[raw];
  if(!parts) return;
  try{
    const chunks=await Promise.all(parts.map(async p=>{
      const res=await fetch(p,{cache:'force-cache'});
      if(!res.ok) throw new Error('image payload '+res.status);
      return (await res.text()).trim();
    }));
    img.src='data:image/webp;base64,'+chunks.join('');
  }catch(e){console.warn('Team image upgrade failed:',raw,e);}
}
document.querySelectorAll('img').forEach(loadTeamImagePayload);

async function loadSponsorshipAvailability(){
  const target=document.getElementById('sponsorship-availability');
  if(!target) return;
  try{
    const res=await fetch('/fixtures.json',{cache:'no-store'});
    if(!res.ok) throw new Error('fixtures '+res.status);
    const data=await res.json();
    let days=Array.isArray(data.sponsorshipDays)?data.sponsorshipDays:[];
    if(!days.length && Array.isArray(data.fixtures)){
      const grouped={};
      data.fixtures.filter(f=>(f.meta||'').toLowerCase().includes('home')).forEach(f=>{
        const key=f.date||'Upcoming home game';
        grouped[key]=grouped[key]||{date:key,venue:'Budehaven Astro Turf Pitch',fullMatchDayEligible:false,halfMatchDayEligible:true,matchBallSlots:[]};
        grouped[key].matchBallSlots.push({team:f.team,fixture:f.fixture,time:(f.meta||'').split(' • ')[0],source:f.source});
      });
      days=Object.values(grouped);
    }
    if(!days.length){
      target.innerHTML='<div class="sponsor-empty">No future Bude home fixtures are currently available in the England Hockey feed. Please contact the club for later dates.</div>';
      return;
    }
    target.innerHTML=days.map(day=>{
      const games=Array.isArray(day.matchBallSlots)?day.matchBallSlots:[];
      const full=day.fullMatchDayEligible===true;
      const subjectBase=encodeURIComponent('Bude Hockey Club sponsorship – '+day.date);
      return `<article class="sponsor-date-card">
        <div class="sponsor-date-head">
          <div><div class="eyebrow">Available to sponsor</div><h3>${day.date}</h3><div class="sponsor-venue">${day.venue||'Budehaven Astro Turf Pitch'}</div></div>
          <span class="availability-pill">AVAILABLE</span>
        </div>
        <div class="home-games-list">
          ${games.map(g=>`<div class="home-game-row"><div><strong>${g.team}</strong><span>${g.fixture}</span></div><b>${g.time||''}</b></div>`).join('')}
        </div>
        <div class="sponsor-options">
          ${full?`<a class="sponsor-option featured-option" href="mailto:budehockey@gmail.com?subject=${subjectBase}%20-%20Full%20Match%20Day%20%C2%A3360"><strong>Full Match Day</strong><span>£360</span><small>${games.length} home games</small></a>`:''}
          <a class="sponsor-option" href="mailto:budehockey@gmail.com?subject=${subjectBase}%20-%20Half%20Match%20Day%20%C2%A3180"><strong>Half Match Day</strong><span>£180</span><small>Enquire for this date</small></a>
          ${games.map(g=>`<a class="sponsor-option ball-option" href="mailto:budehockey@gmail.com?subject=${encodeURIComponent('Match Ball Sponsor £50 – '+day.date+' – '+g.fixture)}"><strong>Match Ball</strong><span>£50</span><small>${g.team} v ${g.fixture.replace(/^.*? v /,'')}</small></a>`).join('')}
        </div>
      </article>`;
    }).join('');
    const first=days[0], game=first?.matchBallSlots?.[0];
    const md=document.getElementById('sponsor-mock-date');
    const mf=document.getElementById('sponsor-mock-fixture');
    if(md) md.textContent=first?.date||'BUDE HOME MATCH DAY';
    if(mf) mf.textContent=game?.fixture||'BUDE HOCKEY CLUB • HOME FIXTURE';
  }catch(e){
    console.warn('Sponsorship availability failed',e);
    target.innerHTML='<div class="sponsor-empty">Sponsorship dates are being updated from England Hockey.</div>';
  }
}
loadSponsorshipAvailability();
