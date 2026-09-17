(function brandRuntime(art) {
  'use strict';
  const demo = new URLSearchParams(location.search).get('brand-preview');
  const isDemo = demo === 'loader' || demo === 'endcard';
  const style = document.createElement('style');
  style.textContent = `
    .pp-brand-screen{position:fixed!important;inset:0!important;transform:none!important;width:100%!important;height:100%!important;max-width:none!important;margin:0!important;padding:24px!important;box-sizing:border-box!important;border:0!important;border-radius:0!important;z-index:20000!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:min(4vh,24px);background:#244936!important;color:white!important;font:700 20px system-ui!important;text-align:center!important;overflow:hidden}
    .pp-brand-screen[hidden]{display:none!important}
    .pp-brand-backdrop{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.55);z-index:-1}
    .pp-brand-logo{display:block;width:min(58vw,27vh,220px);height:auto;object-fit:contain;filter:drop-shadow(0 3px 5px #0005)}
    .pp-brand-hero{display:block;width:min(49vw,25vh,210px);height:auto;aspect-ratio:1;border-radius:26%;border:3px solid #fff8;box-sizing:border-box;box-shadow:0 10px 24px #0004}
    #radar-brand-hud{position:fixed;z-index:9000;top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));width:clamp(54px,20vw,116px);height:auto;pointer-events:none}
    #radar-brand-hud[hidden]{display:none}
    .pp-brand-button{position:relative;display:grid;place-items:center;width:min(65vw,34vh,280px);aspect-ratio:776/281;border:0;padding:10px;background:transparent;cursor:pointer;color:white;font:900 clamp(15px,4vw,23px) system-ui;text-shadow:0 2px 2px #254b0a;isolation:isolate}
    .pp-brand-button img{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
    .pp-brand-track{position:relative;width:min(52vw,27vh,210px);height:26px;border:9px solid transparent;border-image:var(--pp-track) 22 fill stretch;box-sizing:border-box}
    .pp-brand-fill{position:absolute;inset:-3px;overflow:hidden;border-radius:20px}
    .pp-brand-fill:after{content:'';position:absolute;top:0;bottom:0;width:42%;border:6px solid transparent;border-image:var(--pp-fill) 12 fill stretch;box-sizing:border-box;animation:pp-loading 1.1s ease-in-out infinite alternate}
    .pp-brand-ready .pp-brand-fill:after{width:100%;animation:none;left:0}
    .pp-brand-label{font-size:clamp(14px,3.6vw,20px);text-shadow:0 2px 4px #0007}
    .pp-brand-pop{animation:pp-pop .42s cubic-bezier(.2,1.5,.5,1) both}
    .pp-brand-pop:nth-of-type(3){animation-delay:.17s}.pp-brand-pop:nth-of-type(4){animation-delay:.34s}
    .pp-brand-demo{position:fixed;z-index:21000;inset:0 0 auto;padding:8px 10px;background:#183125ee;color:#fff;font:12px system-ui;display:flex;justify-content:space-between;gap:10px}
    .pp-brand-demo a{color:white;text-decoration:underline}
    @keyframes pp-pop{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
    @keyframes pp-loading{from{left:0}to{left:58%}}
    @media(prefers-reduced-motion:reduce){.pp-brand-pop,.pp-brand-fill:after{animation:none}}
  `;
  document.head.appendChild(style);
  const image = (role, className, alt = '') => {
    const img = document.createElement('img');
    img.src = art[role];
    img.className = className;
    img.alt = alt;
    img.draggable = false;
    return img;
  };
  const restart = () => {
    const url = new URL(location.href);
    url.searchParams.delete('brand-preview');
    location.replace(url.href);
  };
  const button = (text, action) => {
    const node = document.createElement('button');
    node.className = 'pp-brand-button';
    node.type = 'button';
    node.append(image('button', '', ''), document.createTextNode(text));
    node.onclick = action;
    return node;
  };
  const screen = (id, label) => {
    const node = document.createElement('section');
    node.id = id;
    node.className = 'pp-brand-screen';
    node.setAttribute('aria-label', label);
    node.append(image('backdrop', 'pp-brand-backdrop'));
    return node;
  };
  const hud = image('logo', '', 'Pines Peak');
  hud.id = 'radar-brand-hud';
  hud.hidden = true;
  document.body.append(hud);
  const loader = screen('radar-brand-loader', 'Загрузка Pines Peak');
  loader.append(
    image('hero', 'pp-brand-hero', 'Алекс'),
    image('logo', 'pp-brand-logo', 'Pines Peak'),
  );
  const bar = document.createElement('div');
  bar.className = 'pp-brand-track';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Подготовка игры');
  bar.style.setProperty('--pp-track', `url("${art.track}")`);
  bar.style.setProperty('--pp-fill', `url("${art.fill}")`);
  const fill = document.createElement('div');
  fill.className = 'pp-brand-fill';
  bar.append(fill);
  loader.append(bar);
  const label = document.createElement('div');
  label.className = 'pp-brand-label';
  label.textContent = 'Загрузка…';
  loader.append(label);
  document.body.append(loader);
  const mounted = performance.now();
  let ended = false,
    dismissed = false,
    armed = false;
  const showEnd = (target) => {
    if (ended) return;
    ended = true;
    hud.hidden = true;
    loader.hidden = true;
    target.className = 'pp-brand-screen';
    target.setAttribute('aria-label', 'Пэкшот Pines Peak');
    target.replaceChildren(image('backdrop', 'pp-brand-backdrop'));
    target.append(
      image('logo', 'pp-brand-logo pp-brand-pop', 'Pines Peak'),
      image('hero', 'pp-brand-hero pp-brand-pop', 'Алекс'),
    );
    const play = button('Сыграть снова', restart);
    play.id = 'local-game-restart';
    play.classList.add('pp-brand-pop');
    target.append(play);
  };
  const lookForEnd = () => {
    const target = document.getElementById('local-game-end');
    if (target && !isDemo) {
      showEnd(target);
      observer.disconnect();
    }
  };
  const observer = new MutationObserver(lookForEnd);
  observer.observe(document.body, { childList: true, subtree: true });
  lookForEnd();
  if (isDemo) {
    const notice = document.createElement('div');
    notice.className = 'pp-brand-demo';
    notice.textContent =
      demo === 'loader' ? 'Просмотр прелоадера' : 'Просмотр пэкшота';
    const link = document.createElement('a');
    const url = new URL(location.href);
    url.searchParams.delete('brand-preview');
    link.href = url.href;
    link.textContent = 'К игре';
    notice.append(link);
    document.body.append(notice);
    if (demo === 'endcard') {
      const target = screen('radar-brand-demo-end', 'Пэкшот Pines Peak');
      document.body.append(target);
      showEnd(target);
    }
    observer.disconnect();
    return;
  }
  const readyImages = Promise.all(
    [...loader.querySelectorAll('img')].map((img) =>
      img.decode().catch(() => null),
    ),
  );
  const finish = async () => {
    await readyImages;
    const delay = Math.max(0, 800 - (performance.now() - mounted));
    setTimeout(() => {
      if (ended) return;
      dismissed = true;
      clearInterval(timer);
      clearTimeout(deadline);
      bar.classList.add('pp-brand-ready');
      bar.setAttribute('aria-valuenow', '100');
      label.textContent = 'Готово';
      setTimeout(() => {
        loader.remove();
        if (!ended) hud.hidden = false;
      }, 200);
    }, delay);
  };
  const timer = setInterval(() => {
    const cc = window.cclegacy || window.cc;
    const scene = cc?.director?.getScene?.();
    const canvas = document.querySelector('canvas');
    if (
      armed || !window.riverWorkshop?.polishReady ||
      scene?.name !== 'Game' ||
      !scene.children?.length ||
      document.getElementById('brand-guard') ||
      !canvas?.width ||
      !canvas?.height
    )
      return;
    armed = true;
    cc.director.once(cc.Director.EVENT_AFTER_DRAW, finish);
  }, 25);
  const deadline = setTimeout(() => {
    if (dismissed || ended) return;
    label.textContent = 'Загрузка занимает больше времени';
    loader.append(button('Повторить', restart));
  }, 20000);
})({"logo":"./radar-brand/logo.webp","hero":"./radar-brand/hero.webp","backdrop":"./radar-brand/backdrop.webp","button":"./radar-brand/button.webp","track":"./radar-brand/track.png","fill":"./radar-brand/fill.png"});