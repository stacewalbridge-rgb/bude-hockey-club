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
          ${win?'<div class="win-message">Brilliant Bude — great win!</div>':''}
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
