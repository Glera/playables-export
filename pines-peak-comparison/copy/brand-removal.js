(function () {
  "use strict";
  const guardStyle = document.createElement("style");
  guardStyle.id = "brand-guard";
  guardStyle.textContent = "canvas{visibility:hidden!important}";
  document.head.appendChild(guardStyle);
  const brandFrames = new Set([
    "16642537-72e8-45e4-aaad-7393cd1f8f9c",
    "abdcda82-a8dd-401d-982d-f4840da572bc"
  ]);
  let overlay;
  const neutralizeSdk = () => {
    if (window.super_html) {
      window.super_html.download = () => null;
      for (const key of ["google_play_url", "appstore_url", "google_play_cpp_url", "appstore_cpp_url"])
        window.super_html[key] = "about:blank";
      window.super_html.is_hide_download = () => true;
    }
  };
  const showLocalEnd = () => {
    if (overlay || !document.body) return;
    overlay = document.createElement("section");
    overlay.id = "local-game-end";
    overlay.setAttribute("aria-label", "Игра завершена");
    overlay.style.cssText = "position:fixed;z-index:10000;left:50%;top:50%;transform:translate(-50%,-50%);width:min(280px,80vw);box-sizing:border-box;padding:24px;border-radius:16px;background:#fff;color:#173927;text-align:center;font:600 20px system-ui;box-shadow:0 8px 32px #0004";
    const title = document.createElement("div");
    title.textContent = "Готово!";
    const button = document.createElement("button");
    button.id = "local-game-restart";
    button.type = "button";
    button.textContent = "Сыграть снова";
    button.style.cssText = "margin-top:18px;width:100%;padding:14px;border:0;border-radius:10px;background:#277b50;color:white;font:600 16px system-ui;cursor:pointer";
    button.addEventListener("click", () => window.location.reload());
    overlay.append(title, button);
    document.body.appendChild(overlay);
  };
  neutralizeSdk();
  const sdkTimer = setInterval(neutralizeSdk, 500);
  setTimeout(() => clearInterval(sdkTimer), 60000);
  const sceneTimer = setInterval(() => {
    const cc = window.cclegacy || window.cc;
    const scene = cc?.director?.getScene?.();
    if (!scene?.children?.length) return;
    const hidden = [];
    let end;
    const visit = node => {
      const components = node.components || node._components || [];
      const branded = components.some(c => brandFrames.has((c.spriteFrame?.uuid || "").split("@")[0]));
      const download = components.some(c => (cc.js?.getClassName?.(c) || c.constructor?.name) === "DownloadBtn");
      if (node.name === "Logo" || node.name === "LogoNode" || branded || download) hidden.push(node);
      if (node.name === "EndWin") end = node;
      (node.children || []).forEach(visit);
    };
    visit(scene);
    const beforeDraw = () => {
      // Settlement activates its portrait/landscape adapters every update.
      // Remove only confirmed brand/CTA children before the frame is drawn.
      for (const node of hidden) if (node.isValid) node.active = false;
      if (end?.activeInHierarchy) showLocalEnd();
    };
    beforeDraw();
    cc.director.on(cc.Director.EVENT_BEFORE_DRAW, beforeDraw);
    guardStyle.remove();
    clearInterval(sceneTimer);
  }, 16);
})();
