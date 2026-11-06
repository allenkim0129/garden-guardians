import { PLANTS, ENEMIES, STAGES, createGame, plantAt, removePlant, collectSun, tick, isPlantUnlocked, introducedPlants, advanceEffects } from "./engine.js";
import { drawTitle, drawBoard, plantIcon, drawSunToken } from "./art.js";
import { loadSprites } from "./sprites.js";
import { GardenAudio } from "./audio.js";
import { readSave, writeSave, updateProgress } from "./storage.js";
import { getLanguage, setLanguage, t, text, label as setLabel, localize } from "./i18n.js";

const $ = selector => document.querySelector(selector);
const home = $("#home");
const gameScreen = $("#game");
const modal = $("#modal");
const canvas = $("#game-art");
const context = canvas.getContext("2d");
let storage;
let storageAccessError = null;
try { storage = window.localStorage; } catch (error) { storageAccessError = error; }
const loaded = storage ? readSave(storage) : { data: null, error: null };
// Accessing localStorage itself can be denied on restricted Safari profiles.
const save = loaded.data ?? readSave({ getItem: () => null }).data;
setLanguage(save.language);
function refreshLanguage() {
  localize(document.body);
  document.documentElement.lang = getLanguage();
  document.title = t("정원 수비대");
  for (const button of document.querySelectorAll("[data-language]")) {
    button.setAttribute("aria-pressed", String(getLanguage() === "en"));
    button.setAttribute("aria-label", getLanguage() === "en" ? "Language: English. Switch to Korean" : "언어: 한국어. 영어로 바꾸기");
  }
}
refreshLanguage();
try {
  await loadSprites();
} catch (error) {
  $("#offline-status").className = "offline-status error";
  text($("#offline-status"), `캐릭터 그림 준비 실패 · ${error.message} 온라인 상태에서 다시 시도해 주세요.`);
  $("#play-button").disabled = false;
  text($("#play-button"), "그림 다시 불러오기");
  $("#play-button").onclick = () => location.reload();
  throw error;
}
$("#play-button").disabled = false;
document.body.dataset.spritesReady = "true";
const icons = Object.fromEntries(Object.keys(PLANTS).map(type => [type, plantIcon(type)]));
let game = null;
let paused = false;
let selected = null;
let shovel = false;
let lastFrame = 0;
let accumulator = 0;
let lastSaveAt = 0;
let closeAction = null;
let toastTimer;
let reportedSaveError = false;
let offlineReady = false;
let workerRegistration = null;
let watchedRegistration = null;
let updateAvailable = false;
let updateApplying = false;
let updateNeedsReload = false;
let updateTimer;
let hadController = Boolean(navigator.serviceWorker?.controller);
let cacheCheckInFlight = false;
let lastWave = -1;
let sunGesture = false;
const audio = new GardenAudio(message => notify(message));
audio.enabled = save.sound;

function notify(message, duration = 3600) {
  text($("#toast"), message);
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, duration);
}
function persist() {
  if (game) updateProgress(save, game);
  const error = storage ? writeSave(storage, save) : "브라우저가 기기 저장을 막고 있어요. 창을 닫으면 진행 상황이 사라져요.";
  if (error && !reportedSaveError) { notify(error, 9000); reportedSaveError = true; }
  if (!error) reportedSaveError = false;
  refreshHome();
  return !error;
}
function refreshHome() {
  $("#resume-button").hidden = !save.current;
  text($("#resume-button"), save.current ? `${save.current.stage}번째 정원 이어서 하기` : "이어서 하기");
  text($("#sound-button"), save.sound ? "소리 켜짐" : "소리 꺼짐");
  $("#sound-button").setAttribute("aria-pressed", String(save.sound));
  text($("#play-button").firstChild, save.unlocked > 1 ? "정원 선택하기 " : "정원으로 출발 ");
}
function openModal(title, content, actions, onClose = null) {
  closeAction = onClose;
  delete modal.dataset.kind;
  $("#modal-title").textContent = title;
  $("#modal-body").replaceChildren();
  if (typeof content === "string") $("#modal-body").innerHTML = content;
  else $("#modal-body").append(content);
  $("#modal-actions").replaceChildren();
  for (const action of actions) addModalAction(action);
  localize(modal);
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
}
function addModalAction({ label, action, primary = false }) {
  const button = document.createElement("button");
  button.className = `button ${primary ? "primary" : "light"}`;
  text(button, label);
  button.onclick = () => { closeModal(false); action(); };
  $("#modal-actions").append(button);
}
function closeModal(invokeAction = true) {
  const action = closeAction;
  closeAction = null;
  modal.close();
  if (invokeAction) action?.();
}
$("#modal-close").onclick = () => closeModal();
modal.addEventListener("cancel", event => { event.preventDefault(); closeModal(); });

function showStages() {
  const content = document.createElement("div");
  const message = document.createElement("p");
  message.textContent = "콩별이와 햇살봉은 처음부터 함께해요. 1~8번째 정원을 처음 지키면 다음 정원에서 쓸 새 식물을 얻어요. 다시 도전할 때도 해당 정원의 식물로 시작해요. 별은 남은 하트 수예요.";
  content.append(message);
  const grid = document.createElement("div");
  grid.className = "stage-grid";
  for (const stage of STAGES) {
    const button = document.createElement("button");
    const locked = stage.id > save.unlocked;
    button.className = "stage-button";
    button.disabled = locked;
    button.setAttribute("aria-label", `${stage.id}. ${stage.name}${locked ? ", 잠김" : `, 별 ${save.stars[stage.id - 1]}개`}`);
    const number = document.createElement("span");
    number.textContent = stage.id;
    const stars = document.createElement("small");
    stars.textContent = locked ? "잠김" : "★".repeat(save.stars[stage.id - 1]) + "☆".repeat(3 - save.stars[stage.id - 1]);
    button.append(number, stars);
    for (const type of introducedPlants(stage.id)) {
      const reward = document.createElement("span");
      reward.className = "stage-reward";
      reward.textContent = `${stage.id === 1 ? "기본 ·" : "사용 ·"} ${PLANTS[type].name}`;
      button.append(reward);
    }
    button.onclick = () => {
      if (save.current) {
        openModal("새로 시작할까요?", "<p>이어서 할 정원이 있어요. 새로 시작하면 진행 중인 판만 바뀌어요. 열린 정원과 모은 별은 그대로예요.</p>", [
          { label: "돌아가기", action: showStages },
          { label: "새로 시작", primary: true, action: () => prepareStage(stage.id) },
        ], showStages);
      } else {
        closeModal(false);
        prepareStage(stage.id);
      }
    };
    grid.append(button);
  }
  content.append(grid);
  openModal("어느 정원으로 갈까요?", content, [{ label: "돌아가기", action: () => {} }]);
}
function helpMarkup() {
  return `<div class="help-steps">
    <div class="help-step"><b>1. 햇빛 모으기</b><span>노란 햇빛을 톡! 놓쳐도 8초 뒤 자동으로 모여요.</span></div>
    <div class="help-step"><b>2. 식물 배치</b><span>카드를 고르고 빈 땅을 톡! 한 번 심으면 선택이 풀려요. 카드를 다시 눌러도 취소돼요.</span></div>
    <div class="help-step"><b>3. 정원 지키기</b><span>좀비가 왼쪽 끝에 닿으면 하트가 하나 줄어요. 3번의 무리를 막아요!</span></div>
  </div><div class="plant-guide">${Object.entries(PLANTS).sort((a, b) => a[1].unlockStage - b[1].unlockStage).map(([type, plant]) => `<div><img src="${icons[type]}" alt=""><div><b>${plant.name} · ${plant.unlockStage === 1 ? "처음부터 사용 가능" : `${plant.unlockStage}번째 정원 해금`}</b><p>☀ ${plant.cost} · ${plant.description}</p></div></div>`).join("")}</div>
  <p>처음부터 콩별이와 햇살봉을 함께 쓸 수 있어요. 햇살봉과 하늘의 햇빛으로 자원을 모아요. 1~8번째 정원을 처음 지키면 다음 정원에서 쓸 새 식물을 얻어요. 아무 카드도 선택하지 않으면 땅을 눌러도 심지 않아요. 햇빛을 누르면 수집만 해요.</p>
  <p>카드 목록을 위아래로 밀어 열 식물을 모두 볼 수 있어요. 키보드에서는 Tab으로 카드를 이동해요.</p>
  <p>삽은 식물을 뽑고 비용 절반을 돌려줘요. 다른 앱으로 이동하거나 화면을 돌리면 자동으로 멈춰요.</p>
  <details><summary>좀비 친구 알아보기</summary><p>${Object.values(ENEMIES).map(e => `<b>${e.name}</b>: ${e.description}`).join("<br>")}</p></details>`;
}
function prepareStage(stageNumber) {
  if (!save.tutorialSeen) {
    openModal("함께 정원을 지켜요!", helpMarkup(), [{ label: "알겠어요, 출발!", primary: true, action: () => {
      save.tutorialSeen = true;
      startStage(stageNumber);
    } }]);
  } else startStage(stageNumber);
}
function startStage(stageNumber, resume = false) {
  game = resume ? structuredClone(save.current) : createGame(stageNumber);
  game.effects = [];
  selected = null; shovel = false; paused = false; sunGesture = false;
  lastWave = -1; lastSaveAt = game.time; accumulator = 0; lastFrame = performance.now();
  home.hidden = true; gameScreen.hidden = false;
  text($("#stage-title"), `${game.stage}. ${STAGES[game.stage - 1].name}`);
  text($("#selection-hint"), STAGES[game.stage - 1].tip);
  $("#sun-layer").replaceChildren();
  audio.unlock();
  persist(); render();
  if (resume && game.plants.some(p => !isPlantUnlocked(p.type, game.stage))) {
    notify("이전 저장에 있던 식물은 유지해요. 새로 심을 때는 이 정원의 해금 규칙을 따라요.", 7000);
  }
  if (window.matchMedia("(orientation: portrait)").matches) pauseGame("화면을 가로로 돌린 뒤 계속해요.");
}
function leaveGame() {
  persist();
  paused = true; game = null;
  home.hidden = false; gameScreen.hidden = true;
  audio.suspend();
  refreshHome();
}
function resumeGame() {
  if (!game || game.status !== "playing") return;
  if (document.hidden || window.matchMedia("(orientation: portrait)").matches) {
    pauseGame("화면을 가로로 돌린 뒤 계속해요.");
    return;
  }
  paused = false; accumulator = 0; lastFrame = performance.now(); audio.unlock();
}
function pauseGame(message = "잠깐 쉬어 가요. 정원은 안전하게 기다리고 있어요.") {
  if (!game || game.status !== "playing") return;
  paused = true; persist(); audio.suspend();
  openModal("잠깐 쉬는 중", `<p>${message}</p><p>진행 상황은 이 기기에 자동 저장돼요.</p>`, [
    { label: "저장하고 나가기", action: leaveGame },
    { label: "다시 시작", action: confirmRestart },
    { label: "계속하기", primary: true, action: resumeGame },
    ...(updateAvailable ? [{ label: "저장하고 업데이트", action: applyUpdate }] : []),
  ], resumeGame);
  modal.dataset.kind = "pause";
}
function confirmRestart() {
  openModal("이 정원을 다시 시작할까요?", "<p>이번 판은 처음부터 시작해요. 이미 모은 별과 열린 정원은 그대로예요.</p>", [
    { label: "돌아가기", action: () => pauseGame() },
    { label: "다시 시작", primary: true, action: () => startStage(game.stage) },
  ], () => pauseGame());
}
function endGame() {
  const previouslyUnlocked = save.unlocked;
  paused = true; persist();
  const won = game.status === "won";
  audio.play(won ? "win" : "lose");
  const finalStage = game.stage === 10;
  const title = won ? (finalStage ? "모든 정원을 지켰어요!" : "정원을 지켰어요!") : "괜찮아요, 한 번 더!";
  const message = won
    ? (finalStage ? "열 개의 정원에 다시 평화가 찾아왔어요. 여러분이 진짜 정원 수비대예요!" : `${STAGES[game.stage].name} 정원이 열렸어요. 친구들과 다음 소풍을 떠나 볼까요?`)
    : STAGES[game.stage - 1].tip;
  const newPlants = won && !finalStage && game.stage + 1 > previouslyUnlocked ? introducedPlants(game.stage + 1) : [];
  const reward = newPlants.length ? `<section class="plant-unlocks" aria-label="새 식물 획득">
    <h3>새 식물 해금: ${newPlants.map(type => PLANTS[type].name).join(", ")}!</h3>
    ${newPlants.map(type => `<article class="unlock-card" data-type="${type}"><img src="${icons[type]}" alt="${PLANTS[type].name}">
      <div><strong>${PLANTS[type].name}</strong><p>${PLANTS[type].description}</p><span>햇빛 ${PLANTS[type].cost} · ${PLANTS[type].unlockStage}번째 정원부터 사용</span></div></article>`).join("")}
    </section>` : "";
  const resultMessage = newPlants.length ? `${game.stage + 1}번째 정원에서 새 친구와 함께해요.` : message;
  openModal(title, `${won ? `<div class="result-stars" aria-label="별 ${game.lives}개">${"★".repeat(game.lives)}${"☆".repeat(3 - game.lives)}</div>` : ""}<p>${resultMessage}</p>${reward}<p>막아낸 좀비 ${game.stats.defeated}명 · 심은 친구 ${game.stats.planted}개</p>`, [
    { label: "정원 선택", action: () => { leaveGame(); showStages(); } },
    { label: won && !finalStage ? "다음 정원" : "다시 도전", primary: true, action: () => startStage(won && !finalStage ? game.stage + 1 : game.stage) },
  ], leaveGame);
}

function selectionHint() {
  text($("#selection-hint"), shovel ? "뽑을 식물을 톡! 햇빛 절반을 돌려받아요."
    : selected ? `${PLANTS[selected].name}: ${PLANTS[selected].description}`
    : "선택 해제 · 햇빛을 모으거나 식물 카드를 골라 주세요.");
}
for (const [type, plant] of Object.entries(PLANTS).sort((a, b) => a[1].unlockStage - b[1].unlockStage)) {
  const button = document.createElement("button");
  button.className = "seed-card";
  button.dataset.type = type;
  setLabel(button, `${plant.name}, 햇빛 ${plant.cost}. ${plant.description}`);
  button.innerHTML = `<img src="${icons[type]}" alt=""><span><strong>${plant.name}</strong><span class="cost">☀ ${plant.cost}</span></span><span class="cooldown" hidden></span>`;
  button.onclick = () => {
    if (paused || !game || !isPlantUnlocked(type, game.stage)) return;
    selected = selected === type && !shovel ? null : type; shovel = false;
    audio.unlock();
    selectionHint();
    render();
  };
  $("#seed-cards").append(button);
}
const seedCards = $("#seed-cards");
let cardPointer = null;
let cardDragged = false;
seedCards.addEventListener("pointerdown", event => { cardPointer = { x: event.clientX, y: event.clientY }; cardDragged = false; });
seedCards.addEventListener("pointermove", event => {
  if (cardPointer && Math.hypot(event.clientX - cardPointer.x, event.clientY - cardPointer.y) > 8) cardDragged = true;
});
seedCards.addEventListener("pointercancel", () => { cardDragged = true; cardPointer = null; });
seedCards.addEventListener("click", event => {
  if (cardDragged && event.detail > 0) { event.preventDefault(); event.stopImmediatePropagation(); }
  cardPointer = null;
}, true);
$("#board").addEventListener("pointerdown", event => { sunGesture = Boolean(event.target.closest(".sun-drop")); }, true);
$("#board").addEventListener("click", event => {
  // An auto-collected sun can disappear between pointerdown and the synthesized click.
  if (event.detail > 0 && sunGesture && !event.target.closest(".sun-drop")) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  sunGesture = false;
}, true);
for (let row = 0; row < 5; row++) for (let col = 0; col < 9; col++) {
  const button = document.createElement("button");
  button.className = "plot"; button.dataset.row = row; button.dataset.col = col;
  setLabel(button, `${row + 1}줄 ${col + 1}칸, 빈 땅`);
  button.onclick = () => {
    if (paused || !game || game.status !== "playing") return;
    if (!selected && !shovel) return;
    audio.unlock();
    const result = shovel ? removePlant(game, row, col) : plantAt(game, selected, row, col);
    if (!result.ok) notify(result.reason);
    else {
      if (shovel) { notify(`햇빛 ${result.refund}를 돌려받았어요.`); shovel = false; }
      selected = null;
      selectionHint();
      audio.play("plant"); persist(); render();
    }
  };
  $("#board-grid").append(button);
}
$("#shovel-button").onclick = () => {
  if (paused || !game) return;
  shovel = !shovel;
  selected = null;
  selectionHint();
  render();
};
$("#pause-button").onclick = () => pauseGame();
$("#home-button").onclick = () => {
  if (paused || !game) return;
  paused = true; persist(); audio.suspend();
  openModal("정원에서 잠깐 나갈까요?", "<p>지금까지의 진행을 저장해요. 처음 화면에서 이어서 할 수 있어요.</p>", [
    { label: "계속하기", action: resumeGame },
    { label: "저장하고 나가기", primary: true, action: leaveGame },
  ], resumeGame);
};
$("#play-button").onclick = showStages;
$("#resume-button").onclick = () => startStage(save.current.stage, true);
$("#help-button").onclick = () => openModal("정원 수비대 놀이 안내", helpMarkup(), [{ label: "알겠어요", primary: true, action: () => {} }]);
$("#sound-button").onclick = async () => {
  save.sound = !save.sound; audio.enabled = save.sound;
  if (save.sound) { await audio.unlock(); audio.play("sun"); }
  else audio.suspend();
  persist();
};
$("#install-button").onclick = () => openModal("언제 어디서나, 우리 정원", `<ol class="install-list">
  <li>아이폰·아이패드의 <b>Safari</b>로 이 게임의 HTTPS 주소를 열어요.</li>
  <li>아래에 <b>‘오프라인 준비 완료’</b>가 나타날 때까지 기다려요.</li>
  <li>Safari의 <b>공유 → 홈 화면에 추가 → 추가</b>를 눌러요. ‘웹 앱으로 열기’가 보이면 켜 주세요.</li>
  <li>홈 화면 아이콘으로 한 번 열고, 그 창에서도 <b>‘오프라인 준비 완료’</b>를 확인해요.</li>
  <li>이제 비행기 모드에서도 정원으로 출발!</li>
  </ol><p>처음 저장할 때만 인터넷이 필요해요. 앱스토어 설치는 필요 없어요. 이 컴퓨터의 localhost 주소는 아이폰에서 열 수 없으므로 별도의 HTTPS 배포 주소가 필요해요.</p>
  <p>기기마다 진행 상황이 따로 저장돼요. Safari와 홈 화면 앱의 저장 공간도 다를 수 있어요. 비공개 브라우징, 사이트 데이터 삭제, 기기 저장 공간 정리로 기록이나 오프라인 파일이 사라질 수 있어요.</p>`,
  [{ label: "알겠어요", primary: true, action: () => {} }]);

const cards = [...document.querySelectorAll(".seed-card")];
const plots = [...document.querySelectorAll(".plot")];
function render() {
  if (!game) return;
  drawBoard(context, game, selected, shovel);
  $("#sun-count").textContent = game.sun;
  $("#hearts").textContent = "♥ ".repeat(game.lives) + "♡ ".repeat(3 - game.lives);
  setLabel($("#hearts"), `남은 하트 ${game.lives}개`);
  text($("#wave-label"), game.wave ? `${game.wave} / 3번째 무리` : "친구를 심을 준비 시간");
  text($("#enemy-count"), `막아낸 좀비 ${game.stats.defeated} / ${STAGES[game.stage - 1].count}`);
  $("#shovel-button").setAttribute("aria-pressed", String(shovel));
  for (const card of cards) {
    const type = card.dataset.type;
    const locked = !isPlantUnlocked(type, game.stage);
    card.disabled = locked;
    card.classList.toggle("locked", locked);
    setLabel(card, `${PLANTS[type].name}, ${locked ? `${PLANTS[type].unlockStage}번째 정원부터 해금` : `햇빛 ${PLANTS[type].cost}. ${PLANTS[type].description}`}`);
    text(card.querySelector(".cost"), locked ? `${PLANTS[type].unlockStage}정원 해금` : `☀ ${PLANTS[type].cost}`);
    card.setAttribute("aria-pressed", String(type === selected && !shovel));
    card.classList.toggle("unaffordable", !locked && game.sun < PLANTS[type].cost);
    const cooldown = card.querySelector(".cooldown");
    cooldown.hidden = locked || game.cooldowns[type] <= 0;
    text(cooldown, `${Math.ceil(game.cooldowns[type])}초`);
  }
  for (const plot of plots) {
    const plant = game.plants.find(p => p.row === Number(plot.dataset.row) && p.col === Number(plot.dataset.col));
    const label = `${Number(plot.dataset.row) + 1}줄 ${Number(plot.dataset.col) + 1}칸, ${plant ? PLANTS[plant.type].name : "빈 땅"}`;
    if (plot.getAttribute("aria-label") !== t(label)) setLabel(plot, label);
  }
  const sunLayer = $("#sun-layer");
  const sunIds = new Set(game.suns.map(s => String(s.id)));
  for (const node of [...sunLayer.children]) if (!sunIds.has(node.dataset.id)) node.remove();
  for (const sun of game.suns) {
    let button = sunLayer.querySelector(`[data-id="${sun.id}"]`);
    if (!button) {
      button = document.createElement("button");
      button.className = "sun-drop"; button.dataset.id = sun.id;
      setLabel(button, `햇빛 ${sun.value} 모으기`);
      const art = document.createElement("canvas");
      art.width = art.height = 96; art.setAttribute("aria-hidden", "true");
      button.append(art);
      if (sun.value === 50) {
        const value = document.createElement("span");
        value.className = "sun-value"; value.textContent = "50"; value.setAttribute("aria-hidden", "true");
        button.append(value);
      }
      button.style.left = `${sun.x / 9}%`; button.style.top = `${sun.y / 5}%`;
      button.onclick = event => {
        event.stopPropagation();
        if (paused) return;
        audio.unlock();
        if (collectSun(game, sun.id)) { audio.play("sun"); render(); }
      };
      sunLayer.append(button);
    }
    drawSunToken(button.firstChild.getContext("2d"), game.time + sun.id * .37);
  }
  const banner = $("#board-banner");
  if (game.time < 8) {
    const newcomers = introducedPlants(game.stage);
    text(banner, newcomers.length ? `새 식물: ${newcomers.map(type => PLANTS[type].name).join(", ")} · 카드를 골라 심어요!` : "식물을 배치해 방어선을 준비하세요!");
  }
  else if (game.wave !== lastWave) {
    lastWave = game.wave;
    text(banner, game.wave ? `${game.wave}번째 무리가 오고 있어요!` : "");
    banner.dataset.until = String(game.time + 3);
  } else if (game.time > Number(banner.dataset.until ?? 0)) text(banner, "");
}
function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min((now - lastFrame) / 1000, .1);
  lastFrame = now;
  if (!game) return;
  if (game.status !== "playing") {
    if (!document.hidden && !window.matchMedia("(orientation: portrait)").matches && game.effects.length) {
      advanceEffects(game, delta);
      render();
    }
    return;
  }
  if (paused) return;
  accumulator += Math.max(0, delta);
  while (accumulator >= 1 / 30 && game.status === "playing") {
    tick(game, 1 / 30);
    accumulator -= 1 / 30;
  }
  render();
  if (game.status !== "playing") { endGame(); return; }
  if (game.time - lastSaveAt >= 3) { persist(); lastSaveAt = game.time; }
}
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame("다른 화면에 다녀오는 동안 정원을 멈춰 두었어요."); });
window.addEventListener("pagehide", () => { if (game) persist(); });
window.addEventListener("pageshow", event => { if (event.persisted) pauseGame("돌아왔네요! 준비가 되면 계속해요."); });
window.matchMedia("(orientation: portrait)").addEventListener("change", event => { if (event.matches) pauseGame("화면을 가로로 돌린 뒤 계속해요."); });
document.addEventListener("keydown", event => {
  if (event.code === "Space" && game && !modal.open && !["BUTTON", "INPUT"].includes(document.activeElement.tagName)) {
    event.preventDefault(); pauseGame();
  }
});

function setCacheStatus(ready, message, error = false) {
  offlineReady = ready;
  const node = $("#offline-status");
  node.className = `offline-status${ready ? " ready" : error ? " error" : ""}`;
  text(node, message);
  $("#cache-retry").hidden = ready || !error;
}
function workerMessage(worker, type) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error("저장 확인 시간이 초과됐어요.")); }, 20000);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}
function announceUpdate() {
  const firstNotice = !updateAvailable;
  updateAvailable = true;
  $("#update-button").hidden = false;
  if (firstNotice && modal.open && modal.dataset.kind === "pause") {
    addModalAction({ label: "저장하고 업데이트", action: applyUpdate });
  }
  if (firstNotice) notify("새 버전이 준비됐어요. 처음 화면이나 일시 정지에서 '저장하고 업데이트'를 눌러요.", 9000);
}
function watchUpdates(registration) {
  if (registration.waiting && registration.active && registration.waiting !== registration.active) announceUpdate();
  if (watchedRegistration === registration) return;
  watchedRegistration = registration;
  const watchInstalling = () => {
    const worker = registration.installing;
    if (!worker) return;
    const replacingExistingWorker = Boolean(registration.active && registration.active !== worker);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && replacingExistingWorker) announceUpdate();
      if (worker.state === "redundant" && !registration.waiting) {
        notify("새 버전을 저장하지 못했어요. 기존 게임은 유지돼요. 온라인에서 다시 열어 주세요.", 9000);
      }
    });
  };
  registration.addEventListener("updatefound", watchInstalling);
  watchInstalling();
}
function updateFailed(error) {
  clearTimeout(updateTimer);
  updateApplying = false;
  $("#update-button").disabled = false;
  text($("#update-button"), "저장하고 업데이트");
  notify(`업데이트를 적용하지 못했어요. ${error.message}`, 9000);
  if (game?.status === "playing") pauseGame("업데이트를 멈췄어요. 기존 정원을 계속하거나 나중에 다시 시도해 주세요.");
}
async function applyUpdate() {
  if (updateApplying) return;
  if (game?.status === "playing") { paused = true; audio.suspend(); }
  if (game && !persist()) {
    if (game?.status === "playing") pauseGame("진행을 저장하지 못해 업데이트를 멈췄어요.");
    return;
  }
  updateApplying = true;
  $("#update-button").disabled = true;
  text($("#update-button"), "업데이트 적용 중…");
  try {
    if (updateNeedsReload) { location.reload(); return; }
    const waiting = workerRegistration?.waiting;
    if (!waiting) throw new Error("준비된 새 버전을 찾지 못했어요. 온라인에서 다시 열어 주세요.");
    await workerMessage(waiting, "APPLY_UPDATE");
    if (updateApplying) updateTimer = setTimeout(() => updateFailed(new Error("버전 전환 시간이 초과됐어요.")), 15000);
  } catch (error) { updateFailed(error); }
}
async function checkForUpdate() {
  if (!workerRegistration || !navigator.onLine || updateApplying) return;
  try { await workerRegistration.update(); watchUpdates(workerRegistration); }
  catch (error) { notify(`업데이트 확인 실패 · ${error.message} 기존 저장된 게임은 계속할 수 있어요.`, 7000); }
}
async function checkCache(repair = false) {
  if (cacheCheckInFlight) return;
  cacheCheckInFlight = true;
  try {
    if (!workerRegistration?.active) throw new Error("오프라인 저장소가 아직 준비되지 않았어요.");
    if (repair) {
      setCacheStatus(false, "게임 파일을 기기에 저장하는 중…");
      await workerMessage(workerRegistration.active, "REPAIR_CACHE");
    }
    const result = await workerMessage(workerRegistration.active, "CHECK_CACHE");
    if (!result.ready) throw new Error("일부 파일이 없어요. 온라인에서 다시 저장해 주세요.");
    setCacheStatus(true, navigator.onLine ? "오프라인 준비 완료 · 이 기기에 저장됨" : "오프라인 준비 완료 · 인터넷 없이 플레이 중");
  } catch (error) {
    setCacheStatus(false, `오프라인 준비 미완료 · ${error.message}`, true);
  } finally { cacheCheckInFlight = false; }
}
async function setupOffline() {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) {
    setCacheStatus(false, "오프라인 저장에는 HTTPS 주소와 지원 브라우저가 필요해요.", true);
    return;
  }
  let readyTimer;
  try {
    setCacheStatus(false, "게임 파일을 기기에 저장하는 중…");
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
    watchUpdates(registration);
    workerRegistration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error("온라인에서 다시 저장해 주세요.")), 20000); }),
    ]);
    await checkCache();
  } catch (error) {
    setCacheStatus(false, `오프라인 준비 미완료 · ${error.message}`, true);
  } finally { clearTimeout(readyTimer); }
}
$("#cache-retry").onclick = () => workerRegistration?.active ? checkCache(true) : setupOffline();
$("#update-button").onclick = applyUpdate;
window.addEventListener("online", () => { checkCache(); checkForUpdate(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkForUpdate(); });
window.addEventListener("offline", () => {
  if (offlineReady) setCacheStatus(true, "오프라인 준비 완료 · 인터넷 없이 플레이 중");
});
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("controllerchange", () => {
  if (updateApplying) {
    updateApplying = false;
    clearTimeout(updateTimer);
    location.reload();
    return;
  }
  if (hadController) {
    updateNeedsReload = true;
    announceUpdate();
  }
  hadController = true;
  navigator.serviceWorker.getRegistration().then(registration => {
    workerRegistration = registration; checkCache();
  }).catch(error => setCacheStatus(false, `오프라인 확인 실패: ${error.message}`, true));
});

for (const button of document.querySelectorAll("[data-language]")) {
  button.onclick = event => {
    event.stopPropagation();
    save.language = getLanguage() === "ko" ? "en" : "ko";
    setLanguage(save.language);
    refreshLanguage();
    persist();
    render();
  };
}
refreshLanguage();
drawTitle($("#title-art"));
refreshHome();
if (loaded.error || storageAccessError) notify(loaded.error ?? "기기 저장이 차단되어 있어요. 창을 닫으면 진행 상황이 사라질 수 있어요.", 9000);
else if (loaded.notice) notify(loaded.notice, 7000);
requestAnimationFrame(frame);
setupOffline();
