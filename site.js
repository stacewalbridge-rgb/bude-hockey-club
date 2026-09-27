const menuBtn=document.querySelector('.menu-btn');
const nav=document.querySelector('.nav');
if(menuBtn){menuBtn.addEventListener('click',()=>{nav.style.display=nav.style.display==='flex'?'none':'flex';nav.style.position='absolute';nav.style.top='68px';nav.style.left='10px';nav.style.right='10px';nav.style.padding='18px';nav.style.background='white';nav.style.borderRadius='16px';nav.style.boxShadow='0 18px 50px rgba(0,0,0,.15)';nav.style.flexDirection='column';nav.style.alignItems='stretch';});}


function updateHomeGameNotices(){
  const cards=[...document.querySelectorAll('.fixture-card')];
  const homeCards=cards.filter(card=>{
    if(card.dataset.home==='true') return true;
    const meta=card.querySelector('.fixture-meta');
    if(!meta) return false;
    const text=meta.textContent.toLowerCase().trim();
    if(text.includes('home/away') || text.includes('home or away')) return false;
    return /(^|[•·\-–—|,\s])home($|[•·\-–—|,\s])/.test(text);
  });

  document.querySelectorAll('.home-game-banner').forEach(el=>el.remove());
  if(!homeCards.length) return;

  const fixtures=document.querySelector('#fixtures .wrap');
  if(!fixtures) return;

  const banner=document.createElement('div');
  banner.className='home-game-banner';
  banner.innerHTML='<strong>HOME GAME AT BUDEHAVEN ASTRO TURF PITCH</strong><span>Come and support Bude Hockey Club</span>';
  const grid=fixtures.querySelector('.fixtures-grid');
  fixtures.insertBefore(banner,grid||null);

  homeCards.forEach(card=>card.classList.add('home-fixture'));
}
updateHomeGameNotices();
