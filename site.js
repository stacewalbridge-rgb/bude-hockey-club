const menuBtn=document.querySelector('.menu-btn');
const nav=document.querySelector('.nav');
if(menuBtn){menuBtn.addEventListener('click',()=>{nav.style.display=nav.style.display==='flex'?'none':'flex';nav.style.position='absolute';nav.style.top='68px';nav.style.left='10px';nav.style.right='10px';nav.style.padding='18px';nav.style.background='white';nav.style.borderRadius='16px';nav.style.boxShadow='0 18px 50px rgba(0,0,0,.15)';nav.style.flexDirection='column';nav.style.alignItems='stretch';});}
