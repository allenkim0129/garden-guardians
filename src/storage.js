import { validSnapshot, snapshot, PLANTS, STAGES, loadoutLimit, validLoadout } from "./engine.js";

export const SAVE_KEY = "garden-guardians-save-v1";
export const freshSave = () => ({ version: 1, unlocked: 1, stars: Array(STAGES.length).fill(0), sound: false, volume: 45, tutorialSeen: false, language: "ko", current: null });
const validTeamSlots = slots => Array.isArray(slots) && [6, 8].includes(slots.length)
  && slots.every(type => type === null || typeof type === "string")
  && validLoadout(slots.filter(type => type !== null), STAGES.length);
export function validateSave(value) {
  return value !== null && typeof value === "object" && value.version === 1
    && Array.isArray(value.stars) && [10, 20, STAGES.length].includes(value.stars.length) && value.stars.every(n => Number.isInteger(n) && n >= 0 && n <= 3)
    && Number.isInteger(value.unlocked) && value.unlocked >= 1 && value.unlocked <= value.stars.length
    && typeof value.sound === "boolean" && typeof value.tutorialSeen === "boolean"
    && (value.volume === undefined || (Number.isInteger(value.volume) && value.volume >= 0 && value.volume <= 100))
    && (value.language === undefined || ["ko", "en"].includes(value.language))
    && (value.teamSlots === undefined || validTeamSlots(value.teamSlots))
    && (value.current === null || (validSnapshot(value.current) && value.current.stage <= value.unlocked));
}
export function readSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { data: freshSave(), error: null };
    const data = JSON.parse(raw);
    if (!validateSave(data)) throw new Error("저장 형식이 맞지 않습니다.");
    if (data.stars.length < STAGES.length) {
      const previousLast = data.stars.length;
      if (data.unlocked === previousLast && data.stars[previousLast - 1] > 0) data.unlocked = previousLast + 1;
      data.stars.push(...Array(STAGES.length - data.stars.length).fill(0));
    }
    data.language ??= "ko";
    data.volume ??= 45;
    let notice = null;
    if (data.current) {
      data.current.effects = [];
      if (data.current.rulesVersion === undefined) {
        for (const shot of data.current.shots) shot.damage = PLANTS[shot.frost ? "frost" : "pea"].damage;
        notice = "새 식물 해금과 밸런스를 적용했어요. 이전에 심은 식물과 진행 기록은 그대로예요.";
      }
      for (const type of Object.keys(PLANTS)) data.current.cooldowns[type] ??= 0;
      if ((data.current.rulesVersion ?? 1) < 5) {
        for (const type of Object.keys(PLANTS)) data.current.cooldowns[type] = Math.min(data.current.cooldowns[type], PLANTS[type].recharge);
        // Keep the v18 migration stable when later releases rebalance production.
        for (const plant of data.current.plants) {
          const limit = { sun: 6, lantern: 8 }[plant.type];
          if (limit !== undefined) plant.timer = Math.min(plant.timer, limit);
        }
        data.current.skyTimer = Math.min(data.current.skyTimer, 5);
      }
      if ((data.current.rulesVersion ?? 1) < 8) {
        for (const plant of data.current.plants) {
          if (plant.type === "cactus") plant.timer = Math.min(plant.timer, PLANTS.cactus.interval);
        }
      }
      data.current.rulesVersion = 8;
    }
    return { data, error: null, notice };
  } catch (error) {
    return { data: freshSave(), error: `저장을 불러오지 못했어요. 이 창에서는 새로 시작해요. (${error.message})` };
  }
}
export function writeSave(storage, data) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return null;
  } catch (error) {
    return `기기에 저장하지 못했어요. 저장 공간·비공개 브라우징 설정을 확인해 주세요. (${error.message})`;
  }
}
export function updateProgress(data, game) {
  if (game.status !== "playing" && data.teamSlots === undefined && game.loadout) {
    data.teamSlots = Array.from({ length: loadoutLimit(game.stage) }, (_, index) => game.loadout[index] ?? null);
  }
  if (game.status === "won") {
    data.stars[game.stage - 1] = Math.max(data.stars[game.stage - 1], game.lives);
    data.unlocked = Math.max(data.unlocked, Math.min(STAGES.length, game.stage + 1));
    data.current = null;
  } else if (game.status === "lost") {
    data.current = null;
  } else {
    data.current = snapshot(game);
  }
}
