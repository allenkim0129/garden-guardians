import test from "node:test";
import assert from "node:assert/strict";
import { getLanguage, setLanguage, t } from "../src/i18n.js";
import { PLANTS, ENEMIES, STAGES, plantDamageLabel } from "../src/engine.js";
import { freshSave, readSave, writeSave } from "../src/storage.js";

test("한국어 기본값과 전체 캐릭터·스테이지·동적 상태 영어 번역", () => {
  assert.equal(getLanguage(), "ko");
  assert.equal(t("정원 수비대"), "정원 수비대");
  setLanguage("en");
  try {
    for (const item of [...Object.values(PLANTS), ...Object.values(ENEMIES), ...STAGES]) {
      for (const key of ["name", "description", "tip"]) {
        if (item[key]) assert.doesNotMatch(t(item[key]), /[가-힣]/);
      }
    }
    assert.equal(t("3줄 2칸, 콩별이"), "Row 3, column 2, Peabud");
    assert.equal(t("5줄 10칸 정원"), "Garden with 5 rows and 10 columns");
    assert.equal(t("2번째 선택 칸: 비어 있음"), "Team slot 2: empty");
    assert.equal(t("정비 시간 · 30초"), "Regroup · 30s");
    const damageLabels = {
      sun: "No attack", pea: "DMG 12", wall: "No attack", frost: "DMG 6", bomb: "Area DMG 300",
      twin: "DMG 33 × 2", thorn: "DMG 36/foe", pumpkin: "Area DMG 96", lantern: "No attack",
      iron: "No attack", ember: "DMG 15 + burn 4/s", storm: "DMG 64/foe", cactus: "Lane KO",
    };
    for (const [type, label] of Object.entries(damageLabels)) assert.equal(t(plantDamageLabel(type)), label);
    const compactDamage = {
      sun: "—", pea: "12", wall: "—", frost: "6", bomb: "300", twin: "33×2", thorn: "36",
      pumpkin: "96", lantern: "—", iron: "—", ember: "15+4/s", storm: "64", cactus: "KO",
    };
    for (const [type, label] of Object.entries(compactDamage)) assert.equal(t(plantDamageLabel(type, true)), label);
    assert.equal(t("햇빛 75 · 2번째 정원부터 사용"), "75 sunlight · From garden 2");
    assert.equal(t("1. 첫 번째 새싹, 별 3개"), "1. First Sprouts, 3 stars");
    assert.equal(t("캐릭터 그림 준비 실패 · sun 프레임 그림을 불러오지 못했어요. 온라인 상태에서 다시 시도해 주세요."),
      "Character art failed to load · Could not load the sun sprite sheet. Reconnect and try again.");
    assert.doesNotMatch(t("기기에 저장하지 못했어요. 저장 공간·비공개 브라우징 설정을 확인해 주세요. (저장 형식이 맞지 않습니다.)"), /[가-힣]/);
  } finally { setLanguage("ko"); }
});

test("언어 없는 기존 저장은 한국어로 복원하고 영어 선택도 진행 손실 없이 저장", () => {
  const legacy = { ...freshSave(), unlocked: 7, stars: [3, 2, 1, 3, 2, 3, 0, 0, 0, 0] };
  delete legacy.language;
  let raw = JSON.stringify(legacy);
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const read = readSave(storage);
  assert.equal(read.error, null);
  const expanded = { ...legacy, stars: [...legacy.stars, ...Array(20).fill(0)] };
  assert.deepEqual(read.data, { ...expanded, language: "ko" });
  read.data.language = "en";
  assert.equal(writeSave(storage, read.data), null);
  assert.deepEqual(readSave(storage).data, { ...expanded, language: "en" });
});
