import { validSnapshot, snapshot, PLANTS } from "./engine.js";

export const SAVE_KEY = "garden-guardians-save-v1";
export const freshSave = () => ({ version: 1, unlocked: 1, stars: Array(10).fill(0), sound: false, tutorialSeen: false, language: "ko", current: null });
export function validateSave(value) {
  return value !== null && typeof value === "object" && value.version === 1
    && Number.isInteger(value.unlocked) && value.unlocked >= 1 && value.unlocked <= 10
    && Array.isArray(value.stars) && value.stars.length === 10 && value.stars.every(n => Number.isInteger(n) && n >= 0 && n <= 3)
    && typeof value.sound === "boolean" && typeof value.tutorialSeen === "boolean"
    && (value.language === undefined || ["ko", "en"].includes(value.language))
    && (value.current === null || (validSnapshot(value.current) && value.current.stage <= value.unlocked));
}
export function readSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { data: freshSave(), error: null };
    const data = JSON.parse(raw);
    if (!validateSave(data)) throw new Error("저장 형식이 맞지 않습니다.");
    data.language ??= "ko";
    let notice = null;
    if (data.current) {
      data.current.effects = [];
      if (data.current.rulesVersion === undefined) {
        data.current.rulesVersion = 2;
        for (const shot of data.current.shots) shot.damage = PLANTS[shot.frost ? "frost" : "pea"].damage;
        notice = "새 식물 해금과 밸런스를 적용했어요. 이전에 심은 식물과 진행 기록은 그대로예요.";
      }
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
  if (game.status === "won") {
    data.stars[game.stage - 1] = Math.max(data.stars[game.stage - 1], game.lives);
    data.unlocked = Math.max(data.unlocked, Math.min(10, game.stage + 1));
    data.current = null;
  } else if (game.status === "lost") {
    data.current = null;
  } else {
    data.current = snapshot(game);
  }
}
