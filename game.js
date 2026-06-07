(function () {
  "use strict";

  const STORAGE_KEY = "cat-game-save";
  const TICK_MS = 5000;
  const SAVE_INTERVAL_MS = 30000;

  const DECAY = {
    hunger: 1.2,
    energy: 0.8,
    play: 1.5,
    bladder: 0.7,
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
    foodBowl: document.getElementById("food-bowl"),
    litterBox: document.getElementById("litter-box"),
    playToy: document.getElementById("play-toy"),
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

  const ANIM = {
    eat: 2600,
    play: 2800,
    pet: 1800,
    sleep: 900,
    toilet: 2800,
    initiative: 2200,
    selfPlay: 2400,
  };

  const IDLE_SELF_PLAY_MS = 120000;

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  function bumpStat(key, delta) {
    state[key] = clamp(state[key] + delta);
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.assign(state, saved);
      if (typeof state.bladder !== "number") state.bladder = 25;
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
      state.energy = clamp(state.energy + 2.5);
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
    let target = 70;

    if (state.hunger < THRESHOLDS.critical) target -= 35;
    else if (state.hunger < THRESHOLDS.low) target -= 20;

    if (state.play < THRESHOLDS.critical) target -= 30;
    else if (state.play < THRESHOLDS.low) target -= 18;

    if (state.bladder > 100 - THRESHOLDS.critical) target -= 25;
    else if (state.bladder > 100 - THRESHOLDS.low) target -= 12;

    if (state.energy < THRESHOLDS.critical) target -= 15;
    else if (state.energy < THRESHOLDS.low) target -= 8;

    const idleTime = Date.now() - state.lastInteraction;
    if (idleTime > 120000) target -= 10;
    if (idleTime > 300000) target -= 15;

    if (state.isSleeping && state.energy > 50) target += 10;
    if (state.hunger > 70 && state.play > 70 && state.energy > 50) target += 15;

    state.happiness = clamp(state.happiness + (target - state.happiness) * 0.15);
  }

  function getMoodCategory() {
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
      "at-bowl", "on-bed", "at-litter", "chasing", "rubbing", "self-pounce"
    );
    if (state.isSleeping) {
      elements.catContainer.classList.add("on-bed");
    }
  }

  function clearAnimationClasses() {
    elements.cat.classList.remove(
      "eating", "playing", "purring", "show-heart", "sleeping", "show-zzz",
      "belly-up", "nipping", "kneading", "chase-tail", "call-attention", "head-rubbing",
      "toileting"
    );
    elements.catContainer.classList.remove(
      "at-bowl", "on-bed", "at-litter", "chasing", "rubbing", "self-pounce"
    );
    elements.foodBowl.classList.remove("eating-food", "bounce");
    elements.litterBox.classList.remove("in-use");
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

    elements.btnFeed.disabled = state.isSleeping || actionCooldown;
    elements.btnPlay.disabled = state.isSleeping || state.energy < 10 || actionCooldown;
    elements.btnPet.disabled = actionCooldown;
    elements.btnSleep.disabled = actionCooldown;
    elements.btnToilet.disabled =
      state.isSleeping || actionCooldown || state.bladder < 20;

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
    withCooldown(ANIM.eat, () => {
      state.hunger = clamp(state.hunger + 25);
      state.happiness = clamp(state.happiness + 5);
      state.bladder = clamp(state.bladder + 15);
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

  function play() {
    if (state.isSleeping || state.energy < 10) return;
    const useWand = Math.random() > 0.45;
    const toyName = useWand ? "逗猫棒" : "老鼠玩具";
    withCooldown(ANIM.play, () => {
      state.play = clamp(state.play + 30);
      state.happiness = clamp(state.happiness + 15);
      state.energy = clamp(state.energy - 8);
      state.hunger = clamp(state.hunger - 5);
      elements.moodText.textContent = useWand ? "追追追！羽毛别跑！" : "老鼠别逃！被我抓到啦！";
      runAnimation("play", ANIM.play, () => {
        elements.cat.classList.add("playing");
        elements.catContainer.classList.add("chasing");
        elements.playToy.className = `play-toy active ${useWand ? "wand chase-wand" : "mouse chase-mouse"}`;
      });
      addLog(`${CAT_NAME} 追着${toyName}满屋子跑，玩得很开心`);
      showToast("玩耍成功！");
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
    if (state.isSleeping || state.bladder < 20) return;
    withCooldown(ANIM.toilet, () => {
      state.bladder = clamp(state.bladder - 45);
      state.happiness = clamp(state.happiness + 8);
      elements.moodText.textContent = "嗯…… 舒服多了";
      runAnimation("toilet", ANIM.toilet, () => {
        elements.catContainer.classList.add("at-litter");
        elements.cat.classList.add("toileting");
        elements.litterBox.classList.add("in-use");
      });
      addLog(`${CAT_NAME} 在猫砂盆里解决了，还认真埋好了`);
      showToast("上厕所完成！");
    });
  }

  function maybeAutoToilet() {
    if (state.isSleeping || activeAnimation || actionCooldown) return;
    if (state.bladder < 88) return;
    if (Math.random() > 0.25) return;

    state.bladder = clamp(state.bladder - 40);
    state.happiness = clamp(state.happiness + 5);
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
        state.isSleeping = true;
        elements.moodText.textContent = "蜷成一团…… 晚安喵";
        runAnimation("sleep", ANIM.sleep, () => {
          elements.catContainer.classList.add("on-bed");
          elements.cat.classList.add("sleeping", "show-zzz");
        });
        addLog(`${CAT_NAME} 跳上小床，蜷起来睡着了`);
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
        elements.catContainer.classList.add("chasing");
        elements.playToy.className = "play-toy active mouse chase-mouse";
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

    elements.catContainer.addEventListener("click", () => {
      if (!actionCooldown) pet();
    });

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
