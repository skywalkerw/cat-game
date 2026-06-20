(function () {
  "use strict";

  const STORAGE_KEY = "cat-game-save";
  const TICK_MS = 5000;
  const SAVE_INTERVAL_MS = 30000;

  const DECAY = {
    hunger: 1.2,
    energy: 0.55,
    play: 1.5,
    bladder: 0.35,
  };

  const THRESHOLDS = {
    low: 30,
    critical: 15,
  };

  const CAT_NAME = "小金";

  const state = {
    hunger: 80,
    energy: 75,
    happiness: 80,
    play: 70,
    bladder: 25,
    isSleeping: false,
    lastUpdate: Date.now(),
    lastInteraction: Date.now(),
    lastSelfPlayAt: 0,
    totalPlayTime: 0,
    floorMess: false,
    litterMess: false,
    currentLayer: "home",
  };

  const SCOOP_SITES = {
    floor: { left: "50%", bottom: "14px", transform: "translateX(-50%)" },
    litter: { left: "128px", bottom: "18px", transform: "translateX(-50%)" },
  };

  const elements = {
    hungerBar: document.getElementById("hunger-bar"),
    energyBar: document.getElementById("energy-bar"),
    happinessBar: document.getElementById("happiness-bar"),
    playBar: document.getElementById("play-bar"),
    bladderBar: document.getElementById("bladder-bar"),
    cat: document.getElementById("cat"),
    catContainer: document.getElementById("cat-container"),
    moodText: document.getElementById("mood-text"),
    room: document.getElementById("room"),
    foodBowl: document.getElementById("food-bowl"),
    litterBox: document.getElementById("litter-box"),
    cardboardBox: document.getElementById("cardboard-box"),
    roomDoor: document.getElementById("room-door"),
    litterWaste: document.getElementById("litter-waste"),
    trashBin: document.getElementById("trash-bin"),
    poopScoop: document.getElementById("poop-scoop"),
    floorMess: document.getElementById("floor-mess"),
    playToy: document.getElementById("play-toy"),
    gardenInsects: document.getElementById("garden-insects"),
    gardenPond: document.getElementById("garden-pond"),
    gardenFish: document.getElementById("garden-fish"),
    purrBubbles: document.getElementById("purr-bubbles"),
    logList: document.getElementById("log-list"),
    timeDisplay: document.getElementById("time-display"),
    toast: document.getElementById("toast"),
    btnFeed: document.getElementById("btn-feed"),
    btnPlay: document.getElementById("btn-play"),
    btnPet: document.getElementById("btn-pet"),
    btnSleep: document.getElementById("btn-sleep"),
    btnToilet: document.getElementById("btn-toilet"),
  };

  const moodMessages = {
    happy: [
      "喵～ 今天心情超好！",
      "呼噜呼噜～ 主人最好了",
      "蹭蹭～ 再摸摸我嘛",
      "阳光真好，想晒太阳",
    ],
    neutral: [
      "喵？有什么事吗？",
      "主人，我在这儿呢",
      "嗯……还行吧",
    ],
    hungry: [
      "喵呜…… 肚子好饿",
      "主人，该吃饭啦！",
      "碗空了喵……",
    ],
    tired: [
      "哈欠～ 好困啊",
      "想睡个午觉……",
      "眼睛睁不开了喵",
    ],
    bored: [
      "好无聊啊喵……",
      "主人，陪我玩嘛！",
      "逗猫棒呢？想玩！",
    ],
    sad: [
      "呜…… 不开心",
      "主人好久都没理我了",
      "喵…… 有点难过",
    ],
    sleeping: [
      "Zzz…… 别吵我",
      "呼呼……",
    ],
    needsToilet: [
      "喵…… 想去猫砂盆",
      "肚子吃饱了，该上厕所啦",
      "哼，猫砂盆在哪儿？",
    ],
    outdoor: [
      "哇～ 好大的绿草地！",
      "在这里打滚真舒服",
      "阳光晒晒尾巴～",
      "蝴蝶飞飞，蜜蜂嗡嗡～",
      "池塘里好像有小鱼在游…",
    ],
  };

  const catInitiatives = [
    { text: "喵～ 主人！看我一眼！", action: "call", effect: () => bumpStat("happiness", 3) },
    { text: "蹭蹭你的腿～", action: "rub", effect: () => bumpStat("happiness", 5) },
    { text: "把逗猫棒推到你脚边", action: "push-toy", effect: () => { bumpStat("play", -5); bumpStat("happiness", 2); } },
    { text: "在你面前翻了个肚皮", action: "belly-up", effect: () => bumpStat("happiness", 8) },
    { text: "轻轻咬了一下你的手（没用力）", action: "nip", effect: () => bumpStat("happiness", 4) },
    { text: "踩奶中…… 呼噜呼噜", action: "knead", effect: () => bumpStat("happiness", 6) },
    { text: "用头蹭了蹭你", action: "head-rub", effect: () => bumpStat("happiness", 5) },
  ];

  const selfPlayActivities = [
    { text: "自己追着尾巴转圈圈", type: "tail" },
    { text: "把毛线球拍来拍去", type: "mouse" },
    { text: "对着空气扑来扑去", type: "pounce" },
  ];

  let actionCooldown = false;
  let initiativeTimer = null;
  let activeAnimation = null;
  let animationTimer = null;
  let scoopDrag = null;
  let chaseFrame = null;
  let wandPlay = null;
  let gardenInsects = [];
  let outdoorInsectLoop = null;
  let insectChase = null;
  let lastInsectTick = 0;
  let outdoorCat = null;
  let pondFish = [];
  let inPond = false;
  let fishChase = null;
  let pondEnterAnim = null;

  const POND_FISH_CONFIG = [
    { palette: "orange" },
    { palette: "blue" },
    { palette: "gold" },
    { palette: "silver" },
    { palette: "coral" },
  ];

  const GARDEN_INSECT_CONFIG = [
    { type: "butterfly", palette: "pink" },
    { type: "butterfly", palette: "orange" },
    { type: "butterfly", palette: "blue" },
    { type: "butterfly", palette: "purple" },
    { type: "bee" },
    { type: "bee" },
    { type: "bee" },
  ];

  const CHASE_PATHS = {
    mouse: [
      { toy: 78, cat: 54, rot: 0, toyBottom: 36 },
      { toy: 22, cat: 28, rot: 0, toyBottom: 38 },
      { toy: 74, cat: 52, rot: 0, toyBottom: 34 },
      { toy: 18, cat: 26, rot: 0, toyBottom: 36 },
      { toy: 62, cat: 46, rot: 0, toyBottom: 35 },
      { toy: 48, cat: 42, rot: 0, toyBottom: 36 },
    ],
  };

  const ANIM = {
    eat: 1950,
    play: 6000,
    pet: 1320,
    sleep: 670,
    toilet: 2100,
    accident: 2380,
    door: 670,
    initiative: 1680,
    selfPlay: 1800,
  };

  const WAND_CAT_FOLLOW = 0.2;
  const BOX_DIVE_DIST = 34;
  const BOX_FOLLOW_MULT = 2.5;

  const IDLE_SELF_PLAY_MS = 120000;

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  function bumpStat(key, delta) {
    state[key] = clamp(state[key] + delta);
  }

  function isBladderCriticalFull() {
    return state.bladder >= 100 - THRESHOLDS.critical;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function isPointInZone(x, y, zone) {
    return x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
  }

  function getBoxLayout() {
    const roomRect = elements.room.getBoundingClientRect();
    const opening = elements.cardboardBox.querySelector(".box-opening");
    if (!opening) return null;

    const openingRect = opening.getBoundingClientRect();
    return {
      wandZone: {
        left: openingRect.left - roomRect.left - 6,
        right: openingRect.right - roomRect.left + 6,
        top: openingRect.top - roomRect.top - 6,
        bottom: openingRect.bottom - roomRect.top + 6,
      },
      entryX: openingRect.left - roomRect.left + openingRect.width * 0.35,
      entryY: openingRect.top - roomRect.top + openingRect.height * 0.55,
    };
  }

  function enterCatBox(wp, layout, roomH, cat) {
    wp.inBox = true;
    wp.catX = layout.entryX;
    wp.catBottom = roomH - layout.entryY;
    cat.classList.add("in-box");
    cat.classList.remove("chasing");
    cat.style.opacity = "0";
    cat.style.pointerEvents = "none";
    elements.cardboardBox.classList.add("has-cat");
    elements.moodText.textContent = "躲进小纸箱啦，只露出尾巴～";
  }

  function exitCatBox(wp, cat) {
    wp.inBox = false;
    cat.classList.remove("in-box");
    cat.classList.add("chasing");
    cat.style.opacity = "";
    cat.style.pointerEvents = "";
    elements.cardboardBox.classList.remove("has-cat");
  }

  function stopToyChase() {
    if (chaseFrame) {
      cancelAnimationFrame(chaseFrame);
      chaseFrame = null;
    }

    if (wandPlay) {
      document.removeEventListener("pointermove", wandPlay.onMove);
      elements.room.classList.remove("wand-play");
      wandPlay = null;
    }

    elements.cardboardBox.classList.remove("wand-inside", "has-cat");

    const cat = elements.catContainer;
    const toy = elements.playToy;

    cat.classList.remove("chasing", "in-box");
    elements.cat.classList.remove("box-peek", "in-box-tail");
    cat.style.opacity = "";
    cat.style.pointerEvents = "";
    cat.style.transition = "";
    cat.style.left = "";
    cat.style.bottom = "";
    cat.style.top = "";
    cat.style.transform = "";
    toy.style.transition = "";
    toy.style.left = "";
    toy.style.top = "";
    toy.style.bottom = "";
    toy.style.transform = "";
    toy.style.opacity = "";
    elements.cat.style.transform = "";
    if (state.currentLayer === "outdoor") {
      if (outdoorCat) syncOutdoorCatEl(false);
      else applyOutdoorCatPosition();
    }
  }

  const DOOR_ZONE = { right: 82, bottom: 100 };

  function getOutdoorCatPosition() {
    const roomW = elements.room.clientWidth || 360;
    const roomH = elements.room.clientHeight || 280;
    return { x: roomW * 0.5, y: roomH * 0.5 };
  }

  function applyOutdoorCatPosition(cat = elements.catContainer) {
    const pos = getOutdoorCatPosition();
    cat.style.transition = "";
    cat.style.left = `${pos.x}px`;
    cat.style.top = `${pos.y}px`;
    cat.style.bottom = "auto";
    cat.style.transform = "translateX(-50%)";
  }

  function getOutdoorCatBounds(roomW, roomH) {
    return {
      minX: 78,
      maxX: roomW - 48,
      minY: roomH * 0.22,
      maxY: roomH * 0.82,
    };
  }

  function clampOutdoorCat(roomW, roomH) {
    if (!outdoorCat) return;
    const bounds = getOutdoorCatBounds(roomW, roomH);
    outdoorCat.x = clamp(outdoorCat.x, bounds.minX, bounds.maxX);
    outdoorCat.y = clamp(outdoorCat.y, bounds.minY, bounds.maxY);
    if (isInDoorZone(outdoorCat.x, outdoorCat.y)) {
      outdoorCat.x = Math.max(outdoorCat.x, DOOR_ZONE.right + 14);
      outdoorCat.y = Math.max(outdoorCat.y, DOOR_ZONE.bottom + 6);
    }
  }

  function pickOutdoorCatTarget(roomW, roomH) {
    if (!outdoorCat) return;
    const bounds = getOutdoorCatBounds(roomW, roomH);
    for (let i = 0; i < 16; i++) {
      let x;
      let y;
      if (Math.random() < 0.55) {
        const band = Math.floor(Math.random() * 3);
        const span = bounds.maxY - bounds.minY;
        const bandMin = bounds.minY + span * (band / 3);
        const bandMax = bounds.minY + span * ((band + 1) / 3);
        x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        y = bandMin + Math.random() * (bandMax - bandMin);
      } else {
        x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
      }
      if (isInDoorZone(x, y)) continue;
      outdoorCat.targetX = x;
      outdoorCat.targetY = y;
      return;
    }
    outdoorCat.targetX = bounds.minX + 80;
    outdoorCat.targetY = bounds.minY + 64;
  }

  function initOutdoorCatMotion() {
    const pos = getOutdoorCatPosition();
    outdoorCat = {
      x: pos.x,
      y: pos.y,
      targetX: pos.x,
      targetY: pos.y,
      pauseUntil: performance.now() + 350,
      facing: 1,
    };
    syncOutdoorCatEl(false);
  }

  function syncOutdoorCatEl(walking) {
    if (!outdoorCat) return;
    const cat = elements.catContainer;
    cat.style.transition = "none";
    cat.style.left = `${outdoorCat.x}px`;
    cat.style.top = `${outdoorCat.y}px`;
    cat.style.bottom = "auto";
    cat.style.transform = "translateX(-50%)";

    const dx = outdoorCat.targetX - outdoorCat.x;
    if (dx > 4) outdoorCat.facing = 1;
    else if (dx < -4) outdoorCat.facing = -1;
    if (!outdoorCat.facing) outdoorCat.facing = 1;

    cat.style.transform = `translateX(-50%) scaleX(${outdoorCat.facing})`;
    elements.cat.style.transform = "";
    cat.classList.toggle("outdoor-walking", walking && !state.isSleeping && !inPond);
  }

  function readOutdoorCatFromDom() {
    const cat = elements.catContainer;
    const roomRect = elements.room.getBoundingClientRect();
    const catRect = cat.getBoundingClientRect();
    return {
      x: catRect.left - roomRect.left + catRect.width / 2,
      y: catRect.top - roomRect.top + catRect.height * 0.82,
    };
  }

  function tickOutdoorCatWander(dt, now, roomW, roomH) {
    if (!outdoorCat || insectChase || actionCooldown || activeAnimation || wandPlay || state.isSleeping || inPond || pondEnterAnim || fishChase) {
      if (outdoorCat) syncOutdoorCatEl(false);
      return;
    }

    if (now < outdoorCat.pauseUntil) {
      syncOutdoorCatEl(false);
      return;
    }

    const dist = Math.hypot(outdoorCat.targetX - outdoorCat.x, outdoorCat.targetY - outdoorCat.y);
    if (dist < 10) {
      outdoorCat.pauseUntil = now + 500 + Math.random() * 1000;
      pickOutdoorCatTarget(roomW, roomH);
      syncOutdoorCatEl(false);
      return;
    }

    const step = Math.min(82 * dt, dist);
    outdoorCat.x += ((outdoorCat.targetX - outdoorCat.x) / dist) * step;
    outdoorCat.y += ((outdoorCat.targetY - outdoorCat.y) / dist) * step;
    clampOutdoorCat(roomW, roomH);
    syncOutdoorCatEl(true);
  }

  function resumeOutdoorCatAfterChase(catX, catY, roomW, roomH) {
    if (!outdoorCat) initOutdoorCatMotion();
    outdoorCat.x = catX;
    outdoorCat.y = catY + 20;
    outdoorCat.pauseUntil = performance.now() + 700 + Math.random() * 900;
    pickOutdoorCatTarget(roomW, roomH);
    syncOutdoorCatEl(false);
  }

  function getInsectMoveBounds(type, roomW, roomH) {
    return {
      minX: type === "butterfly" ? 92 : 68,
      maxX: roomW - 36,
      minY: 28,
      maxY: roomH * 0.74,
    };
  }

  function isInDoorZone(x, y) {
    return x < DOOR_ZONE.right && y < DOOR_ZONE.bottom;
  }

  function randomInsectPosition(type, roomW, roomH, avoidX, avoidY) {
    const bounds = getInsectMoveBounds(type, roomW, roomH);
    for (let i = 0; i < 28; i++) {
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
      if (isInDoorZone(x, y)) continue;
      if (avoidX != null && Math.hypot(x - avoidX, y - avoidY) < 90) continue;
      return { x, y };
    }
    return { x: bounds.minX + 48, y: bounds.minY + 72 };
  }

  function buildInsectMarkup(type, palette) {
    if (type === "butterfly") {
      return `
        <span class="insect-sprite butterfly-sprite insect-${palette}">
          <span class="insect-wing wing-left" aria-hidden="true"></span>
          <span class="insect-wing wing-right" aria-hidden="true"></span>
          <span class="butterfly-body" aria-hidden="true"></span>
          <span class="butterfly-antenna antenna-left" aria-hidden="true"></span>
          <span class="butterfly-antenna antenna-right" aria-hidden="true"></span>
        </span>`;
    }
    return `
      <span class="insect-sprite bee-sprite">
        <span class="insect-wing wing-left bee-wing" aria-hidden="true"></span>
        <span class="insect-wing wing-right bee-wing" aria-hidden="true"></span>
        <span class="bee-head" aria-hidden="true"></span>
        <span class="bee-thorax" aria-hidden="true"></span>
        <span class="bee-abdomen" aria-hidden="true"></span>
      </span>`;
  }

  function syncInsectEl(insect) {
    insect.el.style.left = `${insect.x}px`;
    insect.el.style.top = `${insect.y}px`;
    const sprite = insect.el.querySelector(".insect-sprite");
    if (sprite) {
      sprite.style.transform = `scaleX(${insect.vx >= 0 ? 1 : -1})`;
    }
  }

  function steerInsectFromDoor(insect, dt) {
    if (!isInDoorZone(insect.x, insect.y)) return;
    const strength = insect.type === "butterfly" ? 130 : 70;
    insect.vx += ((DOOR_ZONE.right - insect.x) + 24) * strength * dt * 0.08;
    insect.vy += ((DOOR_ZONE.bottom - insect.y) + 12) * strength * dt * 0.05;
    if (insect.type === "butterfly" && insect.x < DOOR_ZONE.right + 6) {
      insect.x = DOOR_ZONE.right + 6;
      insect.vx = Math.abs(insect.vx) + 18;
    }
  }

  function scatterInsect(insect, roomW, roomH, avoidX, avoidY) {
    const pos = randomInsectPosition(insect.type, roomW, roomH, avoidX, avoidY);
    insect.x = pos.x;
    insect.y = pos.y;
    const angle = Math.random() * Math.PI * 2;
    const speed = insect.type === "bee" ? 62 : 44;
    insect.vx = Math.cos(angle) * speed;
    insect.vy = Math.sin(angle) * speed;
    insect.turnTimer = 1.2 + Math.random() * 2;
    syncInsectEl(insect);
  }

  function getPondLayout() {
    const pond = elements.gardenPond;
    if (!pond) return null;
    const roomRect = elements.room.getBoundingClientRect();
    const pondRect = pond.getBoundingClientRect();
    const left = pondRect.left - roomRect.left;
    const top = pondRect.top - roomRect.top;
    return {
      left,
      top,
      width: pondRect.width,
      height: pondRect.height,
      centerX: left + pondRect.width * 0.5,
      centerY: top + pondRect.height * 0.58,
      padX: 14,
      padY: 12,
    };
  }

  function getPondFishBounds(layout) {
    return {
      minX: layout.padX,
      maxX: layout.width - layout.padX,
      minY: layout.padY + 6,
      maxY: layout.height - layout.padY - 4,
    };
  }

  function buildFishMarkup(palette) {
    return `<span class="pond-fish fish-${palette}"><span class="fish-body"></span><span class="fish-tail"></span></span>`;
  }

  function syncFishEl(fish, layout) {
    fish.el.style.left = `${fish.x}px`;
    fish.el.style.top = `${fish.y}px`;
    fish.el.style.transform = `translate(-50%, -50%) scaleX(${fish.vx >= 0 ? 1 : -1})`;
  }

  function randomFishPosition(bounds, avoidX, avoidY) {
    for (let i = 0; i < 16; i++) {
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
      if (avoidX != null && Math.hypot(x - avoidX, y - avoidY) < 28) continue;
      return { x, y };
    }
    return {
      x: bounds.minX + (bounds.maxX - bounds.minX) * 0.5,
      y: bounds.minY + (bounds.maxY - bounds.minY) * 0.5,
    };
  }

  function spawnPondFish() {
    const container = elements.gardenFish;
    const layout = getPondLayout();
    if (!container || !layout) return;

    container.innerHTML = "";
    pondFish = [];
    const bounds = getPondFishBounds(layout);

    POND_FISH_CONFIG.forEach((cfg) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "pond-fish-btn";
      el.setAttribute("aria-label", "小鱼");
      el.innerHTML = buildFishMarkup(cfg.palette);

      const pos = randomFishPosition(bounds);
      const fish = {
        el,
        palette: cfg.palette,
        x: pos.x,
        y: pos.y,
        vx: (Math.random() > 0.5 ? 1 : -1) * (26 + Math.random() * 18),
        vy: (Math.random() - 0.5) * 12,
        turnTimer: 0.8 + Math.random() * 1.6,
        catchCooldownUntil: 0,
      };

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        startFishChase(fish);
      });

      pondFish.push(fish);
      container.appendChild(el);
      syncFishEl(fish, layout);
    });
  }

  function tickPondFish(dt, layout) {
    if (!layout) return;
    const bounds = getPondFishBounds(layout);
    const fleeing = fishChase?.target;

    for (const fish of pondFish) {
      if (fish.catchCooldownUntil && performance.now() < fish.catchCooldownUntil) {
        fish.el.style.opacity = "0";
        continue;
      }
      fish.el.style.opacity = "1";

      fish.turnTimer -= dt;
      if (fish.turnTimer <= 0) {
        fish.turnTimer = 1 + Math.random() * 2;
        fish.vx = (fish.vx >= 0 ? 1 : -1) * (24 + Math.random() * 22);
        fish.vy = (Math.random() - 0.5) * 16;
      }

      if (fleeing === fish && fishChase) {
        const dx = fish.x - fishChase.catX;
        const dy = fish.y - fishChase.catY;
        const dist = Math.hypot(dx, dy) || 1;
        fish.vx += (dx / dist) * 55 * dt;
        fish.vy += (dy / dist) * 55 * dt;
        const speed = Math.hypot(fish.vx, fish.vy);
        const maxSpeed = 58;
        if (speed > maxSpeed) {
          fish.vx = (fish.vx / speed) * maxSpeed;
          fish.vy = (fish.vy / speed) * maxSpeed;
        }
      }

      fish.x += fish.vx * dt;
      fish.y += fish.vy * dt;

      if (fish.x < bounds.minX) {
        fish.x = bounds.minX;
        fish.vx = Math.abs(fish.vx);
      } else if (fish.x > bounds.maxX) {
        fish.x = bounds.maxX;
        fish.vx = -Math.abs(fish.vx);
      }
      if (fish.y < bounds.minY) {
        fish.y = bounds.minY;
        fish.vy = Math.abs(fish.vy);
      } else if (fish.y > bounds.maxY) {
        fish.y = bounds.maxY;
        fish.vy = -Math.abs(fish.vy);
      }

      syncFishEl(fish, layout);
    }
  }

  function stopFishChaseQuiet() {
    fishChase = null;
    elements.catContainer.classList.remove("fish-chasing");
    elements.cat.classList.remove("playing");
  }

  function startFishChase(fish) {
    if (!inPond || state.isSleeping || actionCooldown) return;
    if (fish.catchCooldownUntil && performance.now() < fish.catchCooldownUntil) return;

    const layout = getPondLayout();
    if (!layout || !outdoorCat) return;

    const bounds = getPondFishBounds(layout);
    const catX = outdoorCat.x - layout.left;
    const catY = outdoorCat.y - layout.top;

    if (fishChase) {
      if (fishChase.target === fish) return;
      fishChase.target = fish;
      fishChase.endAt = performance.now() + 7000;
      fishChase.startAt = performance.now();
      fishChase.followRate = 0.36;
      addLog(`${CAT_NAME} 去追另一条小鱼！`);
      showToast("换一条鱼追！");
      return;
    }

    fishChase = {
      target: fish,
      catX,
      catY,
      followRate: 0.36,
      startAt: performance.now(),
      endAt: performance.now() + 7000,
    };

    elements.catContainer.classList.add("fish-chasing");
    elements.cat.classList.add("playing");
    addLog(`${CAT_NAME} 扑向小鱼！`);
    showToast("抓鱼啦！");
  }

  function endFishChase(caught, fish, layout) {
    const catchX = fishChase?.catX;
    const catchY = fishChase?.catY;
    fishChase = null;
    elements.catContainer.classList.remove("fish-chasing");
    elements.cat.classList.remove("playing");

    if (!fish || !layout) return;
    const bounds = getPondFishBounds(layout);

    if (caught) {
      state.happiness = clamp(state.happiness + 10);
      state.play = clamp(state.play + 14);
      state.energy = clamp(state.energy - 3);
      elements.moodText.textContent = "哗啦～ 抓到一条小鱼！";
      addLog(`${CAT_NAME} 在池塘里抓到了一条小鱼（其实没真吃）`);
      showToast("抓到了！");
      fish.catchCooldownUntil = performance.now() + 2200;
      const pos = randomFishPosition(bounds, catchX, catchY);
      fish.x = pos.x;
      fish.y = pos.y;
      syncFishEl(fish, layout);
      saveGame();
      return;
    }

    elements.moodText.textContent = "小鱼溜走了～";
  }

  function tickPondCat(dt, now, layout) {
    if (!layout || !outdoorCat) return;
    const cat = elements.catContainer;

    if (pondEnterAnim) {
      const t = Math.min((now - pondEnterAnim.startAt) / pondEnterAnim.duration, 1);
      const e = easeInOut(t);
      outdoorCat.x = lerp(pondEnterAnim.fromX, pondEnterAnim.toX, e);
      outdoorCat.y = lerp(pondEnterAnim.fromY, pondEnterAnim.toY, e);
      syncOutdoorCatEl(t < 1);
      if (t >= 1) {
        pondEnterAnim = null;
        inPond = true;
        cat.classList.add("in-pond");
        elements.gardenPond.classList.add("has-cat");
        elements.moodText.textContent = "扑通～ 在池塘里玩水";
        addLog(`${CAT_NAME} 跳进池塘摸鱼啦`);
        showToast("点击小鱼来抓！再点池塘上岸");
      }
      return;
    }

    if (fishChase) {
      if (state.isSleeping) {
        stopFishChaseQuiet();
        return;
      }
      const target = fishChase.target;
      const aimX = target.x;
      const aimY = target.y;
      fishChase.catX += (aimX - fishChase.catX) * fishChase.followRate;
      fishChase.catY += (aimY - fishChase.catY) * fishChase.followRate;

      outdoorCat.x = layout.left + fishChase.catX;
      outdoorCat.y = layout.top + fishChase.catY + 8;
      syncOutdoorCatEl(true);

      const dist = Math.hypot(target.x - fishChase.catX, target.y - fishChase.catY);
      if (dist < 16 || now >= fishChase.endAt) {
        endFishChase(dist < 16, target, layout);
      }
      return;
    }

    if (inPond) {
      outdoorCat.x = layout.centerX;
      outdoorCat.y = layout.centerY + 6;
      syncOutdoorCatEl(false);
    }
  }

  function handlePondClick() {
    if (state.currentLayer !== "outdoor" || state.isSleeping || actionCooldown || wandPlay) return;
    if (pondEnterAnim) return;

    if (inPond) {
      exitPond();
      return;
    }

    if (insectChase) stopInsectChaseQuiet();

    const layout = getPondLayout();
    if (!layout || !outdoorCat) return;

    const fromDom = readOutdoorCatFromDom();
    pondEnterAnim = {
      fromX: outdoorCat?.x ?? fromDom.x,
      fromY: outdoorCat?.y ?? fromDom.y,
      toX: layout.centerX,
      toY: layout.centerY + 6,
      startAt: performance.now(),
      duration: 580,
    };
    elements.catContainer.classList.remove("outdoor-sleep");
    addLog(`${CAT_NAME} 走向池塘…`);
    showToast("游向池塘…");
  }

  function exitPond() {
    if (!inPond && !pondEnterAnim) return;
    stopFishChaseQuiet();
    pondEnterAnim = null;
    inPond = false;
    elements.catContainer.classList.remove("in-pond");
    elements.gardenPond?.classList.remove("has-cat");

    const layout = getPondLayout();
    if (layout && outdoorCat) {
      outdoorCat.x = layout.centerX;
      outdoorCat.y = layout.top + layout.height + 34;
      outdoorCat.pauseUntil = performance.now() + 500;
      pickOutdoorCatTarget(elements.room.clientWidth, elements.room.clientHeight);
      clampOutdoorCat(elements.room.clientWidth, elements.room.clientHeight);
      syncOutdoorCatEl(false);
    }

    addLog(`${CAT_NAME} 从池塘上岸了`);
    showToast("上岸啦～");
  }

  function spawnGardenInsects() {
    const container = elements.gardenInsects;
    if (!container) return;

    container.innerHTML = "";
    gardenInsects = [];

    const roomW = elements.room.clientWidth;
    const roomH = elements.room.clientHeight;

    GARDEN_INSECT_CONFIG.forEach((cfg) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `garden-insect garden-${cfg.type}`;
      el.setAttribute("aria-label", cfg.type === "bee" ? "蜜蜂" : "蝴蝶");
      el.innerHTML = buildInsectMarkup(cfg.type, cfg.palette);

      const pos = randomInsectPosition(cfg.type, roomW, roomH);
      const insect = {
        el,
        type: cfg.type,
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 36,
        turnTimer: 1 + Math.random() * 2,
        chaseCooldownUntil: 0,
      };

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        startInsectChase(insect);
      });

      gardenInsects.push(insect);
      container.appendChild(el);
      syncInsectEl(insect);
    });
  }

  function tickGardenInsects(now) {
    if (state.currentLayer !== "outdoor") {
      outdoorInsectLoop = null;
      return;
    }

    const dt = Math.min((now - lastInsectTick) / 1000, 0.05);
    lastInsectTick = now;

    const roomW = elements.room.clientWidth;
    const roomH = elements.room.clientHeight;

    for (const insect of gardenInsects) {
      const fleeing = insectChase?.target === insect;
      const bounds = getInsectMoveBounds(insect.type, roomW, roomH);

      insect.turnTimer -= dt;
      if (insect.turnTimer <= 0) {
        insect.turnTimer = 1.4 + Math.random() * 2.4;
        let angle = Math.random() * Math.PI * 2;
        if (isInDoorZone(insect.x, insect.y) || (insect.type === "butterfly" && insect.x < bounds.minX + 20)) {
          angle = Math.random() * Math.PI * 0.8 + Math.PI * 0.1;
        }
        const speed = (insect.type === "bee" ? 52 : 36) * (fleeing ? 1.55 : 1);
        insect.vx = Math.cos(angle) * speed;
        insect.vy = Math.sin(angle) * speed;
      }

      if (fleeing && insectChase) {
        const dx = insect.x - insectChase.catX;
        const dy = insect.y - insectChase.catY;
        const dist = Math.hypot(dx, dy) || 1;
        insect.vx += (dx / dist) * 105 * dt;
        insect.vy += (dy / dist) * 105 * dt;
        const maxSpeed = insect.type === "bee" ? 98 : 72;
        const speed = Math.hypot(insect.vx, insect.vy);
        if (speed > maxSpeed) {
          insect.vx = (insect.vx / speed) * maxSpeed;
          insect.vy = (insect.vy / speed) * maxSpeed;
        }
      }

      insect.x += insect.vx * dt;
      insect.y += insect.vy * dt;
      steerInsectFromDoor(insect, dt);

      if (insect.x < bounds.minX) {
        insect.x = bounds.minX;
        insect.vx = Math.abs(insect.vx);
      } else if (insect.x > bounds.maxX) {
        insect.x = bounds.maxX;
        insect.vx = -Math.abs(insect.vx);
      }

      if (insect.y < bounds.minY) {
        insect.y = bounds.minY;
        insect.vy = Math.abs(insect.vy);
      } else if (insect.y > bounds.maxY) {
        insect.y = bounds.maxY;
        insect.vy = -Math.abs(insect.vy);
      }

      syncInsectEl(insect);
    }

    const pondLayout = getPondLayout();
    if (pondLayout) {
      tickPondFish(dt, pondLayout);
      tickPondCat(dt, now, pondLayout);
    }

    if (insectChase) {
      if (state.isSleeping) {
        stopInsectChaseQuiet();
      } else {
      const target = insectChase.target;
      const lead = 0.42;
      const aimX = target.x + target.vx * lead;
      const aimY = target.y + target.vy * lead;
      const follow = insectChase.followRate;
      insectChase.catX += (aimX - insectChase.catX) * follow;
      insectChase.catY += (aimY - insectChase.catY) * follow;

      const cat = elements.catContainer;
      cat.style.transition = "none";
      cat.style.left = `${insectChase.catX}px`;
      cat.style.top = `${insectChase.catY + 20}px`;
      cat.style.bottom = "auto";
      cat.style.transform = "translateX(-50%)";

      if (aimX - insectChase.catX > 6) {
        elements.cat.style.transform = "scaleX(1)";
      } else if (insectChase.catX - aimX > 6) {
        elements.cat.style.transform = "scaleX(-1)";
      }

      const dist = Math.hypot(target.x - insectChase.catX, target.y - insectChase.catY);
      if (now - insectChase.startAt > 1800 && dist >= (insectChase.lastDist ?? dist) - 4) {
        insectChase.followRate = Math.min(insectChase.followRate + 0.02, 0.48);
      }
      insectChase.lastDist = dist;

      if (dist < 28 || now >= insectChase.endAt) {
        endInsectChase(dist < 28, target);
      }
      }
    } else if (!inPond && !pondEnterAnim && !fishChase) {
      tickOutdoorCatWander(dt, now, roomW, roomH);
    }

    outdoorInsectLoop = requestAnimationFrame(tickGardenInsects);
  }

  function startOutdoorInsects() {
    stopOutdoorInsects();
    initOutdoorCatMotion();
    spawnGardenInsects();
    spawnPondFish();
    lastInsectTick = performance.now();
    outdoorInsectLoop = requestAnimationFrame(tickGardenInsects);
  }

  function stopOutdoorInsects() {
    if (outdoorInsectLoop) {
      cancelAnimationFrame(outdoorInsectLoop);
      outdoorInsectLoop = null;
    }
    insectChase = null;
    inPond = false;
    pondEnterAnim = null;
    fishChase = null;
    outdoorCat = null;
    gardenInsects = [];
    pondFish = [];
    elements.catContainer.classList.remove("outdoor-walking", "in-pond", "fish-chasing");
    elements.gardenPond?.classList.remove("has-cat");
    if (elements.gardenInsects) elements.gardenInsects.innerHTML = "";
    if (elements.gardenFish) elements.gardenFish.innerHTML = "";
  }

  function stopInsectChaseQuiet() {
    insectChase = null;
    elements.catContainer.classList.remove("chasing");
    elements.cat.classList.remove("playing");
  }

  function startInsectChase(insect) {
    if (state.currentLayer !== "outdoor" || actionCooldown || wandPlay || state.isSleeping || inPond || pondEnterAnim) return;
    if (insect.chaseCooldownUntil && performance.now() < insect.chaseCooldownUntil) return;

    const cat = elements.catContainer;
    const fromDom = readOutdoorCatFromDom();
    const catX = outdoorCat?.x ?? fromDom.x;
    const catY = outdoorCat?.y ?? fromDom.y;

    if (insectChase) {
      if (insectChase.target === insect) {
        const dist = Math.hypot(insect.x - catX, insect.y - catY);
        if (dist < 36) return;
      }
      insectChase.target = insect;
      insectChase.endAt = performance.now() + 8000;
      insectChase.startAt = performance.now();
      insectChase.lastDist = null;
      insectChase.followRate = 0.34;
      addLog(`${CAT_NAME} 转头去追${insect.type === "bee" ? "另一只蜜蜂" : "另一只蝴蝶"}！`);
      showToast("换目标啦，追追追！");
      return;
    }

    insectChase = {
      target: insect,
      catX,
      catY: catY - 20,
      startAt: performance.now(),
      endAt: performance.now() + 8000,
      followRate: 0.34,
      lastDist: null,
    };

    cat.classList.add("chasing");
    elements.cat.classList.add("playing");
    cat.classList.remove("outdoor-walking");
    addLog(`${CAT_NAME} 去追${insect.type === "bee" ? "蜜蜂" : "蝴蝶"}啦！`);
    showToast("追追追！");
  }

  function endInsectChase(caught, insect) {
    const catX = insectChase?.catX;
    const catY = insectChase?.catY;
    insectChase = null;
    elements.catContainer.classList.remove("chasing");
    elements.cat.classList.remove("playing");

    if (!insect) return;

    insect.chaseCooldownUntil = performance.now() + (caught ? 2800 : 1400);
    const roomW = elements.room.clientWidth;
    const roomH = elements.room.clientHeight;
    if (catX != null && catY != null) {
      resumeOutdoorCatAfterChase(catX, catY, roomW, roomH);
    }

    if (caught) {
      state.happiness = clamp(state.happiness + 10);
      state.play = clamp(state.play + 12);
      state.energy = clamp(state.energy - 4);
      elements.moodText.textContent =
        insect.type === "bee" ? "嗡嗡～ 蜜蜂飞走啦" : "扑棱棱～ 蝴蝶飞走啦";
      addLog(`${CAT_NAME} 扑了个空，${insect.type === "bee" ? "蜜蜂" : "蝴蝶"}飞走了`);
      showToast("差一点就抓到了！");
      scatterInsect(insect, roomW, roomH, catX, catY);
      saveGame();
      return;
    }

    elements.moodText.textContent = "跑太快啦～ 追别的去！";
    scatterInsect(insect, roomW, roomH, catX, catY);
  }

  function startWandPlay(duration) {
    stopToyChase();

    const room = elements.room;
    const cat = elements.catContainer;
    const toy = elements.playToy;
    const roomW = room.clientWidth;
    const roomH = room.clientHeight;
    const startX = roomW * 0.5;
    const startY = roomH * 0.45;

    wandPlay = {
      wandX: startX,
      wandY: startY,
      catX: roomW * 0.5,
      catBottom: 24,
      angle: -10,
      inBox: false,
      endAt: performance.now() + duration,
      onMove(e) {
        if (!wandPlay) return;
        const rect = room.getBoundingClientRect();
        wandPlay.wandX = clamp(e.clientX - rect.left, 18, rect.width - 18);
        wandPlay.wandY = clamp(e.clientY - rect.top, 28, rect.height - 24);
      },
    };

    elements.cat.classList.add("playing");
    cat.classList.add("chasing");
    cat.style.transition = "none";
    toy.style.transition = "none";
    toy.style.opacity = "1";
    toy.className = "play-toy active wand wand-follow";
    room.classList.add("wand-play");

    document.addEventListener("pointermove", wandPlay.onMove);

    function tick(now) {
      if (!wandPlay) return;

      const wp = wandPlay;
      const layout = getBoxLayout();
      const wandInBox = layout && isPointInZone(wp.wandX, wp.wandY, layout.wandZone);

      elements.cardboardBox.classList.toggle("wand-inside", Boolean(wandInBox));

      if (wp.inBox) {
        if (!wandInBox) {
          exitCatBox(wp, cat);
        } else {
          toy.style.left = `${wp.wandX}px`;
          toy.style.top = `${wp.wandY}px`;
          toy.style.bottom = "auto";
          toy.style.transform = `translate(-50%, 0) rotate(${wp.angle}deg)`;
          if (now >= wp.endAt) {
            toy.style.opacity = "0";
            stopToyChase();
            return;
          }
          chaseFrame = requestAnimationFrame(tick);
          return;
        }
      }

      let follow = WAND_CAT_FOLLOW;
      let targetX = wp.wandX;
      let targetBottom = clamp(roomH - wp.wandY + 8, 18, roomH - 70);

      if (wandInBox && layout) {
        follow = WAND_CAT_FOLLOW * BOX_FOLLOW_MULT;
        targetX = layout.entryX;
        targetBottom = clamp(roomH - layout.entryY, 18, roomH - 70);
      }

      wp.catX += (targetX - wp.catX) * follow;
      wp.catBottom += (targetBottom - wp.catBottom) * follow;

      if (wandInBox && layout) {
        const entryBottom = roomH - layout.entryY;
        const dist = Math.hypot(layout.entryX - wp.catX, entryBottom - wp.catBottom);
        if (dist < BOX_DIVE_DIST) {
          enterCatBox(wp, layout, roomH, cat);
        }
      }

      const dx = wp.wandX - (wp.lastWandX ?? wp.wandX);
      const dy = wp.wandY - (wp.lastWandY ?? wp.wandY);
      if (Math.abs(dx) + Math.abs(dy) > 0.8) {
        wp.angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      }
      wp.lastWandX = wp.wandX;
      wp.lastWandY = wp.wandY;

      toy.style.left = `${wp.wandX}px`;
      toy.style.top = `${wp.wandY}px`;
      toy.style.bottom = "auto";
      toy.style.transform = `translate(-50%, 0) rotate(${wp.angle}deg)`;

      cat.style.left = `${wp.catX}px`;
      cat.style.bottom = `${wp.catBottom}px`;
      cat.style.top = "auto";
      cat.style.transform = "translateX(-50%)";

      if (wp.wandX - wp.catX > 6) {
        elements.cat.style.transform = "scaleX(1)";
      } else if (wp.catX - wp.wandX > 6) {
        elements.cat.style.transform = "scaleX(-1)";
      }

      if (now >= wp.endAt) {
        toy.style.opacity = "0";
        stopToyChase();
        return;
      }

      chaseFrame = requestAnimationFrame(tick);
    }

    chaseFrame = requestAnimationFrame(tick);
  }

  function startToyChase(type, duration) {
    stopToyChase();

    const path = CHASE_PATHS[type];
    const cat = elements.catContainer;
    const toy = elements.playToy;
    const start = performance.now();

    cat.classList.add("chasing");
    cat.style.transition = "none";
    toy.style.transition = "none";
    toy.style.opacity = "1";

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const segments = path.length - 1;
      const scaled = progress * segments;
      const index = Math.min(Math.floor(scaled), segments - 1);
      const local = easeInOut(scaled - index);
      const from = path[index];
      const to = path[index + 1];

      const toyLeft = lerp(from.toy, to.toy, local);
      const catLeft = lerp(from.cat, to.cat, local);
      const toyBottom = lerp(from.toyBottom, to.toyBottom, local);

      toy.style.left = `${toyLeft}%`;
      toy.style.bottom = `${toyBottom}px`;
      toy.style.top = "auto";
      cat.style.left = `${catLeft}%`;
      cat.style.transform = "translateX(-50%)";
      toy.style.transform = "";

      const moveDir = to.cat - from.cat;
      if (Math.abs(moveDir) > 0.4) {
        elements.cat.style.transform = moveDir > 0 ? "scaleX(1)" : "scaleX(-1)";
      }

      if (progress < 1) {
        chaseFrame = requestAnimationFrame(tick);
        return;
      }

      toy.style.opacity = "0";
      chaseFrame = null;
    }

    chaseFrame = requestAnimationFrame(tick);
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.assign(state, saved);
      if (typeof state.bladder !== "number") state.bladder = 25;
      if (typeof state.floorMess !== "boolean") state.floorMess = false;
      if (typeof state.litterMess !== "boolean") state.litterMess = false;
      if (state.currentLayer !== "outdoor") state.currentLayer = "home";
      applyOfflineDecay();
    } catch {
      /* ignore corrupt save */
    }
  }

  function saveGame() {
    state.lastUpdate = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }

  function applyOfflineDecay() {
    const elapsed = Date.now() - state.lastUpdate;
    if (elapsed <= 0) return;

    const ticks = Math.floor(elapsed / TICK_MS);
    if (ticks <= 0) return;

    for (let i = 0; i < ticks; i++) {
      tickStats(true);
    }

    addLog(`你离开了 ${formatDuration(elapsed)}，${CAT_NAME} 一直在等你`);
  }

  function formatDuration(ms) {
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "一会儿";
    if (mins < 60) return `${mins} 分钟`;
    const hours = Math.floor(mins / 60);
    return `${hours} 小时`;
  }

  function tickStats(silent) {
    if (state.isSleeping) {
      state.energy = clamp(state.energy + 6.5);
      state.hunger = clamp(state.hunger - DECAY.hunger * 0.5);
      if (state.energy >= 95) {
        wakeUp(true);
      }
    } else {
      state.hunger = clamp(state.hunger - DECAY.hunger);
      state.energy = clamp(state.energy - DECAY.energy);
      state.play = clamp(state.play - DECAY.play);
      state.bladder = clamp(state.bladder + DECAY.bladder);
    }

    updateHappiness();

    if (!silent) {
      render();
      maybeCatInitiative();
      maybeSelfPlay();
      maybeAutoToilet();
    }
  }

  function updateHappiness() {
    let target = 75;

    if (state.hunger < THRESHOLDS.critical) target -= 25;
    else if (state.hunger < THRESHOLDS.low) target -= 14;

    if (state.play < THRESHOLDS.critical) target -= 22;
    else if (state.play < THRESHOLDS.low) target -= 12;

    if (state.bladder > 100 - THRESHOLDS.critical) target -= 14;
    else if (state.bladder > 100 - THRESHOLDS.low) target -= 6;

    if (state.floorMess) target -= 12;
    if (state.litterMess) target -= 6;

    if (state.energy < THRESHOLDS.critical) target -= 10;
    else if (state.energy < THRESHOLDS.low) target -= 5;

    const idleTime = Date.now() - state.lastInteraction;
    if (idleTime > 180000) target -= 5;
    if (idleTime > 420000) target -= 8;

    if (state.isSleeping && state.energy > 50) target += 10;
    if (state.hunger > 70 && state.play > 70 && state.energy > 50) target += 15;

    state.happiness = clamp(state.happiness + (target - state.happiness) * 0.08);
  }

  function getMoodCategory() {
    if (state.currentLayer === "outdoor") return "outdoor";
    if (state.isSleeping) return "sleeping";
    if (state.bladder > 100 - THRESHOLDS.low) return "needsToilet";
    if (state.hunger < THRESHOLDS.low) return "hungry";
    if (state.play < THRESHOLDS.low) return "bored";
    if (state.energy < THRESHOLDS.low) return "tired";
    if (state.happiness < THRESHOLDS.low) return "sad";
    if (state.happiness >= 70) return "happy";
    return "neutral";
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function applyMoodClasses() {
    elements.cat.classList.remove("happy", "sad", "sleeping", "show-zzz");
    if (state.isSleeping) {
      elements.cat.classList.add("sleeping", "show-zzz");
    } else if (state.happiness >= 70) {
      elements.cat.classList.add("happy");
    } else if (state.happiness < THRESHOLDS.low) {
      elements.cat.classList.add("sad");
    }
  }

  function applyPositionClasses() {
    elements.catContainer.classList.remove(
      "at-bowl", "on-bed", "at-litter", "chasing", "rubbing", "self-pounce", "outdoor-sleep"
    );
    if (state.isSleeping) {
      if (state.currentLayer === "outdoor") {
        elements.catContainer.classList.add("outdoor-sleep");
      } else {
        elements.catContainer.classList.add("on-bed");
      }
    }
  }

  function clearAnimationClasses() {
    stopToyChase();
    elements.cat.classList.remove(
      "eating", "playing", "purring", "show-heart", "sleeping", "show-zzz",
      "belly-up", "nipping", "kneading", "chase-tail", "call-attention", "head-rubbing",
      "toileting", "accident"
    );
    elements.catContainer.classList.remove(
      "at-bowl", "on-bed", "at-litter", "chasing", "rubbing", "self-pounce", "outdoor-sleep"
    );
    elements.foodBowl.classList.remove("eating-food", "bounce");
    elements.litterBox.classList.remove("in-use");
    elements.trashBin.classList.remove("receiving");
    elements.playToy.className = "play-toy";
    elements.purrBubbles.classList.remove("active");
  }

  function runAnimation(name, duration, setup, teardown) {
    if (animationTimer) clearTimeout(animationTimer);
    clearAnimationClasses();
    activeAnimation = name;
    if (setup) setup();

    animationTimer = setTimeout(() => {
      if (teardown) teardown();
      clearAnimationClasses();
      activeAnimation = null;
      applyPositionClasses();
      applyMoodClasses();
      render();
    }, duration);
  }
  function setBar(el, value) {
    el.style.width = `${value}%`;
    el.classList.remove("low", "mid");
    if (value < THRESHOLDS.critical) el.classList.add("low");
    else if (value < THRESHOLDS.low) el.classList.add("mid");
  }

  function setUrgencyBar(el, value) {
    el.style.width = `${value}%`;
    el.classList.remove("low", "mid");
    if (value >= 100 - THRESHOLDS.critical) el.classList.add("low");
    else if (value >= 100 - THRESHOLDS.low) el.classList.add("mid");
  }

  function getActiveScoopSite() {
    if (state.floorMess) return "floor";
    if (state.litterMess) return "litter";
    return null;
  }

  function placeScoopAtSite(site) {
    const pos = SCOOP_SITES[site];
    const scoop = elements.poopScoop;
    scoop.style.left = pos.left;
    scoop.style.bottom = pos.bottom;
    scoop.style.top = "auto";
    scoop.style.right = "auto";
    scoop.style.transform = pos.transform;
    scoop.dataset.site = site;
  }

  function updateScoopDisplay() {
    if (scoopDrag) return;

    const site = getActiveScoopSite();
    const scoop = elements.poopScoop;

    if (!site) {
      scoop.classList.remove("visible", "has-poop", "ready", "dragging");
      scoop.style.left = "";
      scoop.style.bottom = "";
      scoop.style.top = "";
      scoop.style.transform = "";
      delete scoop.dataset.site;
      return;
    }

    placeScoopAtSite(site);
    scoop.classList.add("visible", "has-poop", "ready");
  }

  function isPointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function dumpScoopAtTrash(site) {
    if (site === "floor") state.floorMess = false;
    else if (site === "litter") state.litterMess = false;

    state.happiness = clamp(state.happiness + 8);
    elements.trashBin.classList.add("receiving");
    setTimeout(() => elements.trashBin.classList.remove("receiving"), 500);

    addLog(
      site === "floor"
        ? `你把 ${CAT_NAME} 拉在地上的猫屎倒进垃圾桶了`
        : "你把猫砂盆里的猫屎倒进垃圾桶了"
    );
    showToast("猫屎已清理");
    state.lastInteraction = Date.now();
    saveGame();
  }

  function initScoopDrag() {
    const scoop = elements.poopScoop;
    const room = elements.room;

    scoop.addEventListener("pointerdown", (e) => {
      if (!scoop.classList.contains("has-poop") || actionCooldown || scoopDrag) return;
      e.preventDefault();
      e.stopPropagation();

      const scoopRect = scoop.getBoundingClientRect();
      scoopDrag = {
        site: scoop.dataset.site,
        offsetX: e.clientX - scoopRect.left,
        offsetY: e.clientY - scoopRect.top,
        pointerId: e.pointerId,
      };

      scoop.classList.add("dragging");
      scoop.classList.remove("ready");
      elements.floorMess.classList.remove("visible");
      elements.litterWaste.classList.remove("visible");
      scoop.setPointerCapture(e.pointerId);
    });

    scoop.addEventListener("pointermove", (e) => {
      if (!scoopDrag || e.pointerId !== scoopDrag.pointerId) return;

      const roomRect = room.getBoundingClientRect();
      const x = clamp(e.clientX - roomRect.left - scoopDrag.offsetX, 0, roomRect.width - 38);
      const y = clamp(e.clientY - roomRect.top - scoopDrag.offsetY, 0, roomRect.height - 22);

      scoop.style.left = `${x}px`;
      scoop.style.top = `${y}px`;
      scoop.style.bottom = "auto";
      scoop.style.transform = "none";

      elements.trashBin.classList.toggle(
        "can-dump",
        isPointInRect(e.clientX, e.clientY, elements.trashBin.getBoundingClientRect())
      );
    });

    function endScoopDrag(e) {
      if (!scoopDrag || e.pointerId !== scoopDrag.pointerId) return;

      const site = scoopDrag.site;
      scoop.classList.remove("dragging");
      elements.trashBin.classList.remove("can-dump");

      if (isPointInRect(e.clientX, e.clientY, elements.trashBin.getBoundingClientRect())) {
        dumpScoopAtTrash(site);
      }

      scoopDrag = null;
      try {
        scoop.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      render();
    }

    scoop.addEventListener("pointerup", endScoopDrag);
    scoop.addEventListener("pointercancel", endScoopDrag);
  }

  function applyCurrentLayer() {
    elements.room.classList.toggle("is-outdoor", state.currentLayer === "outdoor");
  }

  function setOutdoorLayer(outdoor) {
    state.currentLayer = outdoor ? "outdoor" : "home";
    applyCurrentLayer();
    stopToyChase();
    clearAnimationClasses();
    elements.catContainer.style.transition = "";
    elements.cat.style.transform = "";
    applyPositionClasses();
    applyMoodClasses();
    if (outdoor) {
      applyOutdoorCatPosition();
      startOutdoorInsects();
      state.happiness = clamp(state.happiness + 5);
    } else {
      stopOutdoorInsects();
      elements.catContainer.style.left = "";
      elements.catContainer.style.top = "";
      elements.catContainer.style.bottom = "";
      elements.catContainer.style.transform = "";
    }
    render();
    saveGame();
  }

  function enterOutdoor() {
    if (state.currentLayer === "outdoor" || actionCooldown || wandPlay || insectChase) return;
    withCooldown(ANIM.door, () => {
      runAnimation("door-exit", ANIM.door, () => {
        const cat = elements.catContainer;
        const roomRect = elements.room.getBoundingClientRect();
        const catRect = cat.getBoundingClientRect();
        cat.style.transition = "left 0.38s ease, top 0.38s ease, bottom 0.38s ease";
        cat.style.left = `${catRect.left - roomRect.left + catRect.width / 2}px`;
        cat.style.top = `${catRect.top - roomRect.top}px`;
        cat.style.bottom = "auto";
        cat.style.transform = "translateX(-50%)";
        requestAnimationFrame(() => {
          const pos = getOutdoorCatPosition();
          cat.style.left = `${pos.x}px`;
          cat.style.top = `${pos.y}px`;
        });
      }, () => {
        setOutdoorLayer(true);
        elements.moodText.textContent = "哇～ 好大的绿草地！";
      });
      addLog(`${CAT_NAME} 钻过门，跑到绿草地上了`);
      showToast("来到绿草地啦！");
    });
  }

  function exitOutdoor() {
    if (state.currentLayer !== "outdoor" || actionCooldown || wandPlay || insectChase || fishChase || pondEnterAnim) return;
    withCooldown(ANIM.door, () => {
      setOutdoorLayer(false);
      addLog(`${CAT_NAME} 从绿草地回到家中`);
      showToast("回到家了～");
    });
  }

  function handleCatClick() {
    if (actionCooldown || activeAnimation || wandPlay || insectChase || fishChase || inPond || pondEnterAnim) return;
    pet();
  }

  function render() {
    setBar(elements.hungerBar, state.hunger);
    setBar(elements.energyBar, state.energy);
    setBar(elements.happinessBar, state.happiness);
    setBar(elements.playBar, state.play);
    setUrgencyBar(elements.bladderBar, state.bladder);

    if (!activeAnimation) {
      const mood = getMoodCategory();
      elements.moodText.textContent = pickRandom(moodMessages[mood]);
      applyMoodClasses();
      applyPositionClasses();
    }

    applyCurrentLayer();

    elements.btnFeed.disabled = state.isSleeping || actionCooldown || state.currentLayer === "outdoor";
    elements.btnPlay.disabled =
      state.isSleeping || state.energy < 10 || actionCooldown || state.currentLayer === "outdoor";
    elements.btnPet.disabled = actionCooldown;
    elements.btnSleep.disabled = actionCooldown;
    elements.btnToilet.disabled =
      state.isSleeping || actionCooldown || state.bladder < 20 || state.currentLayer === "outdoor";

    elements.floorMess.classList.toggle("visible", state.floorMess);
    elements.litterWaste.classList.toggle("visible", state.litterMess);
    elements.litterBox.classList.toggle("has-waste", state.litterMess);
    updateScoopDisplay();

    elements.btnSleep.classList.toggle("active", state.isSleeping);

    elements.timeDisplay.textContent = new Date().toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function addLog(message) {
    const li = document.createElement("li");
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    li.textContent = `[${time}] ${message}`;
    elements.logList.prepend(li);
    while (elements.logList.children.length > 20) {
      elements.logList.removeChild(elements.logList.lastChild);
    }
  }

  function showToast(msg) {
    elements.toast.textContent = msg;
    elements.toast.classList.add("show");
    setTimeout(() => elements.toast.classList.remove("show"), 2000);
  }

  function withCooldown(duration, fn) {
    if (actionCooldown) return;
    actionCooldown = true;
    fn();
    state.lastInteraction = Date.now();
    render();
    saveGame();
    setTimeout(() => {
      actionCooldown = false;
      render();
    }, duration);
  }

  function feed() {
    if (state.isSleeping) return;
    if (isBladderCriticalFull()) {
      feedAccident();
      return;
    }
    withCooldown(ANIM.eat, () => {
      state.hunger = clamp(state.hunger + 25);
      state.happiness = clamp(state.happiness + 5);
      state.bladder = clamp(state.bladder + 8);
      elements.moodText.textContent = "啊呜啊呜～ 好好吃！";
      runAnimation("eat", ANIM.eat, () => {
        elements.catContainer.classList.add("at-bowl");
        elements.cat.classList.add("eating");
        elements.foodBowl.classList.add("has-food", "bounce", "eating-food");
        setTimeout(() => elements.foodBowl.classList.remove("bounce"), 500);
      }, () => {
        elements.foodBowl.classList.remove("has-food");
      });
      addLog(`你给 ${CAT_NAME} 投喂了猫粮，它埋头猛吃`);
      showToast("投喂成功！");
    });
  }

  function feedAccident() {
    if (state.currentLayer === "outdoor") return;
    withCooldown(ANIM.accident, () => {
      state.hunger = clamp(state.hunger + 10);
      state.happiness = clamp(state.happiness - 25);
      state.bladder = clamp(state.bladder - 60);
      state.floorMess = true;
      elements.moodText.textContent = "喵…… 对不起，憋不住了";
      runAnimation("accident", ANIM.accident, () => {
        elements.cat.classList.add("accident", "sad");
        elements.foodBowl.classList.add("bounce");
        setTimeout(() => elements.foodBowl.classList.remove("bounce"), 500);
      });
      addLog(`如厕需求已经爆表，你硬塞饭给 ${CAT_NAME}，它直接拉在地上了……`);
      showToast("糟糕！拖动铲子到垃圾桶清理");
    });
  }

  function play() {
    if (state.isSleeping || state.energy < 10) return;
    withCooldown(ANIM.play, () => {
      state.play = clamp(state.play + 30);
      state.happiness = clamp(state.happiness + 15);
      state.energy = clamp(state.energy - 8);
      state.hunger = clamp(state.hunger - 5);
      elements.moodText.textContent = "追追追！羽毛别跑！";
      runAnimation("play", ANIM.play, () => {
        startWandPlay(ANIM.play);
      });
      addLog(`${CAT_NAME} 追着逗猫棒满屋子跑，玩得很开心`);
      showToast("移动鼠标拖动逗猫棒！");
    });
  }

  function pet() {
    withCooldown(ANIM.pet, () => {
      if (state.isSleeping) {
        state.happiness = clamp(state.happiness + 3);
        elements.moodText.textContent = "呼…… 别吵，在做梦呢";
        addLog(`你轻轻摸了摸 ${CAT_NAME}，它睡得很香`);
      } else {
        state.happiness = clamp(state.happiness + 12);
        elements.moodText.textContent = "呼噜呼噜～ 好舒服";
        runAnimation("pet", ANIM.pet, () => {
          elements.cat.classList.add("purring", "show-heart");
          elements.purrBubbles.classList.add("active");
        });
        addLog(`${CAT_NAME} 呼噜呼噜～ 享受你的抚摸`);
      }
      showToast("抚摸成功！");
    });
  }

  function toilet() {
    if (state.isSleeping || actionCooldown) return;
    if (state.currentLayer === "outdoor") return;
    if (state.bladder < 20) return;
    withCooldown(ANIM.toilet, () => {
      state.bladder = clamp(state.bladder - 45);
      state.happiness = clamp(state.happiness + 8);
      state.litterMess = true;
      elements.moodText.textContent = "嗯…… 舒服多了";
      runAnimation("toilet", ANIM.toilet, () => {
        elements.catContainer.classList.add("at-litter");
        elements.cat.classList.add("toileting");
        elements.litterBox.classList.add("in-use");
      });
      addLog(`${CAT_NAME} 在猫砂盆里上了厕所，拖动铲子到垃圾桶清理`);
      showToast("上厕所完成！记得清理猫砂盆");
    });
  }

  function maybeAutoToilet() {
    if (state.isSleeping || activeAnimation || actionCooldown) return;
    if (state.currentLayer === "outdoor") return;
    if (state.bladder < 88) return;
    if (Math.random() > 0.25) return;

    state.bladder = clamp(state.bladder - 40);
    state.happiness = clamp(state.happiness + 5);
    state.litterMess = true;
    elements.moodText.textContent = "自己跑去猫砂盆了～";
    addLog(`${CAT_NAME} 憋不住了，自己跑去上厕所`);
    runAnimation("toilet", ANIM.toilet, () => {
      elements.catContainer.classList.add("at-litter");
      elements.cat.classList.add("toileting");
      elements.litterBox.classList.add("in-use");
    });
    saveGame();
  }

  function toggleSleep() {
    withCooldown(ANIM.sleep, () => {
      if (state.isSleeping) {
        wakeUp(false);
      } else {
        stopInsectChaseQuiet();
        stopFishChaseQuiet();
        if (inPond) exitPond();
        state.isSleeping = true;
        const outdoor = state.currentLayer === "outdoor";
        elements.moodText.textContent = outdoor ? "在草地上蜷成一团…… 晚安喵" : "蜷成一团…… 晚安喵";
        runAnimation("sleep", ANIM.sleep, () => {
          if (outdoor && outdoorCat) {
            elements.catContainer.classList.add("outdoor-sleep");
            syncOutdoorCatEl(false);
          } else {
            elements.catContainer.classList.add("on-bed");
          }
          elements.cat.classList.add("sleeping", "show-zzz");
        });
        addLog(outdoor ? `${CAT_NAME} 在草地上睡着了` : `${CAT_NAME} 跳上小床，蜷起来睡着了`);
        showToast("猫咪入睡了～");
      }
    });
  }

  function wakeUp(auto) {
    state.isSleeping = false;
    clearAnimationClasses();
    activeAnimation = null;
    if (animationTimer) {
      clearTimeout(animationTimer);
      animationTimer = null;
    }
    applyPositionClasses();
    applyMoodClasses();
    if (state.currentLayer === "outdoor" && outdoorCat) {
      syncOutdoorCatEl(false);
    }
    if (auto) {
      state.energy = 100;
      elements.moodText.textContent = "伸懒腰～ 睡饱啦！";
      elements.cat.classList.add("happy");
      setTimeout(() => elements.cat.classList.remove("happy"), 1500);
      addLog(`${CAT_NAME} 睡饱了，伸了个懒腰`);
      showToast(`${CAT_NAME} 醒啦！`);
    } else {
      elements.moodText.textContent = "喵？再让我睡五分钟……";
      addLog(`你叫醒了 ${CAT_NAME}`);
      showToast("猫咪醒来了");
    }
    render();
  }

  function playInitiativeAnimation(action) {
    switch (action) {
      case "call":
        runAnimation("initiative", ANIM.initiative, () => {
          elements.cat.classList.add("call-attention", "happy", "show-heart");
        });
        break;
      case "rub":
        runAnimation("initiative", ANIM.initiative, () => {
          elements.catContainer.classList.add("rubbing");
          elements.cat.classList.add("happy");
        });
        break;
      case "push-toy":
        runAnimation("initiative", ANIM.initiative, () => {
          elements.playToy.className = "play-toy active mouse push-toy";
          elements.cat.classList.add("happy");
        });
        break;
      case "belly-up":
        runAnimation("initiative", ANIM.initiative, () => {
          elements.cat.classList.add("belly-up", "happy");
        });
        break;
      case "nip":
        runAnimation("initiative", ANIM.initiative, () => {
          elements.cat.classList.add("nipping");
        });
        break;
      case "knead":
        runAnimation("initiative", ANIM.initiative, () => {
          elements.cat.classList.add("kneading", "purring");
          elements.purrBubbles.classList.add("active");
        });
        break;
      case "head-rub":
        runAnimation("initiative", ANIM.initiative, () => {
          elements.cat.classList.add("head-rubbing", "happy");
        });
        break;
      default:
        runAnimation("initiative", ANIM.initiative, () => {
          elements.cat.classList.add("happy", "show-heart");
        });
    }
  }

  function triggerInitiative(initiative) {
    addLog(`${CAT_NAME} 主动互动：${initiative.text}`);
    elements.moodText.textContent = initiative.text;
    initiative.effect();
    playInitiativeAnimation(initiative.action);
    saveGame();
  }

  function playSelfPlayAnimation(type) {
    if (type === "mouse") {
      runAnimation("self-play", ANIM.selfPlay, () => {
        elements.cat.classList.add("playing");
        elements.playToy.className = "play-toy active mouse";
        startToyChase("mouse", ANIM.selfPlay);
      });
    } else if (type === "pounce") {
      runAnimation("self-play", ANIM.selfPlay, () => {
        elements.cat.classList.add("playing");
        elements.catContainer.classList.add("self-pounce");
      });
    } else {
      runAnimation("self-play", ANIM.selfPlay, () => {
        elements.cat.classList.add("chase-tail");
      });
    }
  }

  function maybeSelfPlay() {
    if (state.isSleeping || activeAnimation || actionCooldown) return;

    const idleTime = Date.now() - state.lastInteraction;
    if (idleTime < IDLE_SELF_PLAY_MS) return;

    const sinceSelfPlay = Date.now() - (state.lastSelfPlayAt || 0);
    if (sinceSelfPlay < IDLE_SELF_PLAY_MS) return;

    const chance = idleTime > 300000 ? 0.4 : 0.22;
    if (Math.random() > chance) return;

    const activity = pickRandom(selfPlayActivities);
    state.lastSelfPlayAt = Date.now();
    state.play = clamp(state.play + 18);
    state.happiness = clamp(state.happiness + 4);
    state.energy = clamp(state.energy - 4);

    elements.moodText.textContent = activity.text;
    addLog(`${CAT_NAME} 没人陪，${activity.text}`);
    playSelfPlayAnimation(activity.type);
    saveGame();
  }

  function maybeCatInitiative() {
    if (state.isSleeping || activeAnimation) return;
    if (Math.random() > 0.08) return;
    triggerInitiative(pickRandom(catInitiatives));
  }

  function scheduleInitiative() {
    const delay = 45000 + Math.random() * 60000;
    initiativeTimer = setTimeout(() => {
      if (!state.isSleeping && !activeAnimation && state.happiness < 80) {
        triggerInitiative(pickRandom(catInitiatives));
      }
      scheduleInitiative();
    }, delay);
  }

  function init() {
    loadSave();

    elements.btnFeed.addEventListener("click", feed);
    elements.btnPlay.addEventListener("click", play);
    elements.btnPet.addEventListener("click", pet);
    elements.btnSleep.addEventListener("click", toggleSleep);
    elements.btnToilet.addEventListener("click", toilet);

    initScoopDrag();

    elements.roomDoor.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.currentLayer === "outdoor") {
        exitOutdoor();
        return;
      }
      enterOutdoor();
    });

    elements.cat.addEventListener("click", (e) => {
      e.stopPropagation();
      handleCatClick();
    });

    elements.gardenPond?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.closest(".pond-fish-btn")) return;
      handlePondClick();
    });

    applyCurrentLayer();
    if (state.currentLayer === "outdoor") {
      applyOutdoorCatPosition();
      startOutdoorInsects();
    }

    setInterval(() => {
      tickStats(false);
      saveGame();
    }, TICK_MS);

    setInterval(saveGame, SAVE_INTERVAL_MS);

    scheduleInitiative();
    render();
    addLog(`${CAT_NAME} 欢迎你回来！`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
