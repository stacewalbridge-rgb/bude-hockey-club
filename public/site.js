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
async function loadFixtures(){
  const grid=document.getElementById('fixtures-grid');
  if(!grid) return;
  try{
    const res=await fetch('/fixtures.json',{cache:'no-store'});
    if(!res.ok) return;
    const data=await res.json();
    if(!Array.isArray(data.fixtures)||!data.fixtures.length) return;
    grid.innerHTML=data.fixtures.map(f=>`
      <article class="fixture-card">
        <div class="fixture-team">${f.team}</div>
        <div class="fixture-league">${f.league}</div>
        <div class="fixture-date">${f.date}</div>
        <div class="fixture-opponent">${f.fixture}</div>
        <div class="fixture-meta">${f.meta}</div>
        <div class="fixture-source"><a class="link" href="${f.source}" target="_blank" rel="noreferrer">England Hockey ↗</a></div>
      </article>`).join('');
  }catch(e){}
}
loadFixtures();
