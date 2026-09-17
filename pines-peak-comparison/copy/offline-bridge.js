(function () {
  "use strict";
  const blocked = function () {
    console.info("[internal-prototype] external navigation blocked");
    return null;
  };
  window.open = blocked;
  window.st_showNavigationBanner = blocked;
  window.FbPlayableAd = {
    initializeLogging() {}, logButtonClick() {}, logLevelComplete() {},
    logGameLoad() {}, logEndCardShowUp() {}, onCTAClick: blocked
  };
})();
