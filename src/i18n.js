let language = "ko";
export const getLanguage = () => language;
export function setLanguage(value) { language = value === "en" ? "en" : "ko"; }

const messages = {
  "정원 수비대": "Garden Guardians",
  "정원": "Garden",
  "수비대": "Guardians",
  "작은 정원, 치밀한 작전": "SMALL GARDEN, SMART STRATEGY",
  "해가 지면, 녀석들이 몰려온다.": "When the sun sets, they come.",
  "식물 친구들과 정원을 지켜라.": "Plant friends. One garden to defend.",
  "정원으로 출발": "Let's play",
  "정원 선택하기": "Choose a garden",
  "이어서 하기": "Continue",
  "배치하고, 조합하고, 버텨라 · 오프라인 전략 게임": "Plant, team up, defend · Offline strategy",
  "오늘도, 정원을 부탁해!": "The garden is counting on you!",
  "정원 수비대 처음 화면": "Garden Guardians home",
  "햇살봉, 콩별이와 우스꽝스러운 좀비들이 있는 작은 정원": "A small garden with Sunbell, Peabud and silly zombies",
  "놀이 안내": "How to play",
  "설치 안내": "Install",
  "소리 켜짐": "Sound on",
  "소리 꺼짐": "Sound off",
  "다시 저장": "Retry download",
  "캐릭터 그림을 준비하는 중…": "Loading character art…",
  "그림 다시 불러오기": "Retry loading art",
  "정원 선택으로 나가기": "Save and leave the garden",
  "보유 햇빛": "Available sunlight",
  "삽": "Dig",
  "일시 정지": "Pause",
  "식물 선택": "Choose a plant",
  "식물 카드 목록 · 위아래로 스크롤": "Plant cards · Scroll up or down",
  "카드 더 보기 ↕": "More plants ↕",
  "카드 목록을 위아래로 밀어 열 식물을 모두 볼 수 있어요. 키보드에서는 Tab으로 카드를 이동해요.": "Scroll the cards up or down to see all ten plants. Use Tab to move between cards with a keyboard.",
  "함께할 친구": "YOUR TEAM",
  "한 번 선택, 한 번 배치": "Pick once, plant once",
  "다시 누르면 선택 취소": "Tap again to deselect",
  "5줄 9칸 정원": "Garden with 5 rows and 9 columns",
  "모을 수 있는 햇빛": "Sunlight to collect",
  "식물 카드를 고른 뒤 빈 땅을 눌러 주세요.": "Choose a plant card, then tap an empty plot.",
  "닫기": "Close",
  "정원 수비대를 실행하려면 Safari 설정에서 JavaScript를 켜 주세요.": "Enable JavaScript in Safari settings to play Garden Guardians.",
  "햇살봉": "Sunbell",
  "콩별이": "Peabud",
  "도토리벽": "Acorn Guard",
  "서리초": "Frostbloom",
  "방울폭탄": "Burstbud",
  "쌍콩이": "Twinpod",
  "가시풀": "Thornleaf",
  "호박포": "Pumpkin Lobber",
  "해등나무": "Sunlantern Tree",
  "철잎보루": "Ironleaf Fort",
  "불꽃봉오리": "Emberbloom",
  "3.2초마다 불씨를 쏴 반경 약 한 칸에 24 피해, 3초 동안 초당 6 화상 피해를 줘요. 화상은 중첩되지 않아요.": "Every 3.2s, fires an ember: 24 damage within about one tile, then 6 burn damage per second for 3s. Burns do not stack.",
  "2초마다 위아래 꼬투리에서 콩을 0.2초 간격으로 두 번 쏴요.": "Every 2s, fires two peas from its upper and lower pods, 0.2s apart.",
  "2.8초마다 같은 줄의 좀비를 최대 3명 관통하는 가시를 쏴요.": "Every 2.8s, fires a thorn through up to 3 zombies in its row.",
  "3.8초마다 호박탄을 던져 착지점 반경 약 한 칸에 피해를 줘요.": "Every 3.8s, lobs a pumpkin that hits within about one tile of its landing spot.",
  "10초마다 햇빛 50을 만들어요. 첫 햇빛도 10초 뒤에 나와요.": "Makes 50 sunlight every 10s. The first harvest also takes 10s.",
  "체력 1500의 철잎으로 막아요. 튼튼하지만 다시 심기까지 14초!": "Blocks with 1,500 health. Tough, but takes 14s to replant!",
  "8초마다 햇빛 25를 만들어요.": "Makes 25 sunlight every 8 seconds.",
  "앞으로 초록 완두콩을 톡톡 쏘아요.": "Shoots green peas down its row.",
  "튼튼한 몸으로 좀비를 막아요.": "A tough defender that blocks zombies.",
  "얼음 결정을 쏴 좀비를 3초 동안 느리게 해요.": "Fires ice crystals that slow zombies for 3 seconds.",
  "1초 뒤 주변 좀비에게 큰 피해!": "Bursts after 1 second, damaging nearby zombies!",
  "잠옷좀비": "Pajama Zombie",
  "젤리좀비": "Jelly Zombie",
  "롤러좀비": "Skater Zombie",
  "우산좀비": "Umbrella Zombie",
  "졸려도 정원 산책은 좋아해요.": "Sleepy, but always up for a garden stroll.",
  "느리지만 아주 튼튼해요.": "Slow, but very tough.",
  "롤러스케이트로 빠르게 와요.": "Rolls in quickly on skates.",
  "우산 덕에 추위에 덜 느려져요.": "Its umbrella reduces the slowing effect of ice.",
  "65 피해를 받으면 우산을 놓치고 보통 걸음과 추위 저항으로 바뀌어요.": "After 65 damage, it drops its umbrella and walks and slows down like a regular zombie.",
  "첫 번째 새싹": "First Sprouts",
  "아침 산책": "Morning Stroll",
  "말랑말랑 손님": "Squishy Guests",
  "씽씽 정원길": "Speedy Garden Path",
  "우산 쓴 소풍": "Umbrella Picnic",
  "점심시간 소동": "Lunchtime Ruckus",
  "반짝이는 연못": "Sparkling Pond",
  "꼬불꼬불 덩굴": "Twisting Vines",
  "노을빛 파티": "Sunset Party",
  "우리들의 정원": "Our Garden",
  "햇살봉으로 햇빛을 모으고, 좀비가 오는 줄에 콩별이를 심어요.": "Use Sunbell to gather sunlight. Plant Peabud in the rows with zombies.",
  "새 친구 도토리벽! 콩별이 앞에 심어 좀비를 붙잡아요.": "Meet Acorn Guard! Plant it ahead of Peabud to hold zombies back.",
  "새 친구 서리초! 얼음 결정으로 좀비를 느리게 해요.": "Meet Frostbloom! Its ice crystals slow zombies down.",
  "새 친구 방울폭탄! 좀비가 모인 곳에서 한 번에 펑!": "Meet Burstbud! Plant it near a crowd for a big burst!",
  "새 친구 쌍콩이! 두 번 쏘지만 비싸요. 콩별이와 함께 줄을 지켜요.": "Meet Twinpod! Two shots cost more sunlight. Team it with Peabud.",
  "새 친구 가시풀! 같은 줄에 모인 좀비를 최대 세 명 관통해요.": "Meet Thornleaf! Pierce up to three zombies lined up in one row.",
  "새 친구 호박포! 도토리벽으로 붙잡으면 착지점에 모인 좀비를 맞히기 좋아요.": "Meet Pumpkin Lobber! Use Acorn Guard to hold a crowd at the landing spot.",
  "새 친구 해등나무! 더 많은 햇빛을 만들지만 첫 수확까지 기다려야 해요.": "Meet Sunlantern Tree! More sunlight per harvest, but a slower start.",
  "새 친구 철잎보루! 오래 버티지만 비용과 다시 심는 시간을 생각해요.": "Meet Ironleaf Fort! Lasts longer, but costs more and replants slowly.",
  "새 친구 불꽃봉오리! 모인 좀비에게 불씨를 쏴요. 함께할 여덟 친구를 골라 정원을 지켜요!": "Meet Emberbloom! Hit groups with burning embers. Pick up to eight teammates to defend your garden.",
  "콩별이와 햇살봉은 처음부터 함께해요. 1~9번째 정원을 처음 지키면 다음 정원에서 쓸 새 식물을 얻어요. 다시 도전할 때도 해당 정원의 식물로 시작해요. 별은 남은 하트 수예요.": "Start with Peabud and Sunbell. First wins in gardens 1–9 unlock a plant for the next garden. Replays use that garden's plant lineup. Stars equal your remaining hearts.",
  "잠김": "Locked",
  "새로 시작할까요?": "Start a new game?",
  "이어서 할 정원이 있어요. 새로 시작하면 진행 중인 판만 바뀌어요. 열린 정원과 모은 별은 그대로예요.": "You have a saved game. Starting again replaces that game, but keeps your unlocked gardens and stars.",
  "돌아가기": "Back",
  "새로 시작": "Start new",
  "어느 정원으로 갈까요?": "Choose your garden",
  "1. 햇빛 모으기": "1. Collect sunlight",
  "노란 햇빛을 톡! 놓쳐도 8초 뒤 자동으로 모여요.": "Tap the golden sunlight! Missed sunlight is collected after 8 seconds.",
  "2. 식물 배치": "2. Place your plants",
  "카드를 고르고 빈 땅을 톡! 한 번 심으면 선택이 풀려요. 카드를 다시 눌러도 취소돼요.": "Pick a card, then tap an empty plot. Planting clears your selection. Tap the card again to cancel.",
  "3. 정원 지키기": "3. Defend the garden",
  "좀비가 왼쪽 끝에 닿으면 하트가 하나 줄어요. 3번의 무리를 막아요!": "Lose a heart if a zombie reaches the left edge. Stop all 3 waves!",
  "처음부터 사용 가능": "Available from the start",
  "처음부터 콩별이와 햇살봉을 함께 쓸 수 있어요. 햇살봉과 하늘의 햇빛으로 자원을 모아요. 1~9번째 정원을 처음 지키면 다음 정원에서 쓸 새 식물을 얻어요. 아무 카드도 선택하지 않으면 땅을 눌러도 심지 않아요. 햇빛을 누르면 수집만 해요.": "Start with Peabud and Sunbell. Gather sunlight from Sunbell and the sky. First wins in gardens 1–9 unlock a plant for the next garden. No card selected means no accidental planting. Tapping sunlight only collects it.",
  "삽은 식물을 뽑고 비용 절반을 돌려줘요. 다른 앱으로 이동하면 자동으로 멈춰요. 세로로 들고 있어도 게임은 가로형 화면으로 표시돼요.": "Dig removes a plant and refunds half its cost. Switching apps pauses the game. The game stays in a landscape layout even when your device is held upright.",
  "선택한 식물 카드": "Selected plant cards",
  "좀비 친구 알아보기": "Meet the zombies",
  "함께 정원을 지켜요!": "Let's defend the garden!",
  "알겠어요, 출발!": "Got it, let's go!",
  "이전 저장에 있던 식물은 유지해요. 새로 심을 때는 이 정원의 해금 규칙을 따라요.": "Plants from your old save stay in place. New plants follow this garden's unlock rules.",
  "잠깐 쉬어 가요. 정원은 안전하게 기다리고 있어요.": "Take a break. Your garden will wait safely.",
  "잠깐 쉬는 중": "Paused",
  "진행 상황은 이 기기에 자동 저장돼요.": "Progress is saved on this device.",
  "저장하고 나가기": "Save and leave",
  "다시 시작": "Restart",
  "계속하기": "Continue",
  "이 정원을 다시 시작할까요?": "Restart this garden?",
  "이번 판은 처음부터 시작해요. 이미 모은 별과 열린 정원은 그대로예요.": "This game will start over. Your stars and unlocked gardens stay.",
  "모든 정원을 지켰어요!": "All gardens protected!",
  "정원을 지켰어요!": "Garden protected!",
  "괜찮아요, 한 번 더!": "Let's try again!",
  "열 개의 정원에 다시 평화가 찾아왔어요. 여러분이 진짜 정원 수비대예요!": "Peace has returned to all ten gardens. You are true Garden Guardians!",
  "새 식물 획득": "New plant unlocked",
  "정원 선택": "Gardens",
  "다음 정원": "Next garden",
  "다시 도전": "Try again",
  "뽑을 식물을 톡! 햇빛 절반을 돌려받아요.": "Tap a plant to dig it up and refund half its cost.",
  "선택 해제 · 햇빛을 모으거나 식물 카드를 골라 주세요.": "Nothing selected · Collect sunlight or choose a plant.",
  "빈 땅": "Empty plot",
  "정원에서 잠깐 나갈까요?": "Leave the garden?",
  "지금까지의 진행을 저장해요. 처음 화면에서 이어서 할 수 있어요.": "Your progress will be saved. Continue from the home screen.",
  "정원 수비대 놀이 안내": "How to play Garden Guardians",
  "알겠어요": "Got it",
  "언제 어디서나, 우리 정원": "Your garden, anywhere",
  "아이폰·아이패드의": "On your iPhone or iPad, use",
  "로 이 게임의 HTTPS 주소를 열어요.": "to open this game's HTTPS address.",
  "아래에": "Wait until",
  "‘오프라인 준비 완료’": "'Offline ready'",
  "가 나타날 때까지 기다려요.": "appears below.",
  "Safari의": "In Safari, tap",
  "공유 → 홈 화면에 추가 → 추가": "Share → Add to Home Screen → Add",
  "를 눌러요. ‘웹 앱으로 열기’가 보이면 켜 주세요.": ". Enable 'Open as Web App' if shown.",
  "홈 화면 아이콘으로 한 번 열고, 그 창에서도": "Open the home screen icon once and check for",
  "를 확인해요.": "there too.",
  "이제 비행기 모드에서도 정원으로 출발!": "Now close and reopen in airplane mode to try offline play!",
  "처음 저장할 때만 인터넷이 필요해요. 앱스토어 설치는 필요 없어요. 이 컴퓨터의 localhost 주소는 아이폰에서 열 수 없으므로 별도의 HTTPS 배포 주소가 필요해요.": "Internet is needed for the first download and updates, not for offline play. No App Store install is needed. Use the public HTTPS address on other devices, not this computer's localhost address.",
  "기기마다 진행 상황이 따로 저장돼요. Safari와 홈 화면 앱의 저장 공간도 다를 수 있어요. 비공개 브라우징, 사이트 데이터 삭제, 기기 저장 공간 정리로 기록이나 오프라인 파일이 사라질 수 있어요.": "Progress is stored separately on each device. Safari and the home screen app may also use separate storage. Private browsing, clearing site data or device storage cleanup can remove progress or offline files.",
  "친구를 심을 준비 시간": "Time to set up your plants",
  "식물을 배치해 방어선을 준비하세요!": "Place your plants and get ready!",
  "햇빛 25 모으기": "Collect 25 sunlight",
  "다른 화면에 다녀오는 동안 정원을 멈춰 두었어요.": "The garden paused while you were away.",
  "돌아왔네요! 준비가 되면 계속해요.": "Welcome back! Continue when you're ready.",
  "지금은 심을 수 없어요.": "You cannot plant right now.",
  "정원 안의 빈 땅을 골라 주세요.": "Choose an empty plot inside the garden.",
  "이미 친구가 있어요. 다른 땅을 골라 주세요.": "A plant is already here. Choose another plot.",
  "햇빛이 부족해요. 반짝이는 햇빛을 모아 주세요.": "Not enough sunlight. Collect some glowing sunlight.",
  "친구가 준비 중이에요. 조금만 기다려 주세요.": "This plant is getting ready. Please wait a moment.",
  "지금은 삽을 쓸 수 없어요.": "You cannot dig right now.",
  "삽으로 뽑을 식물을 골라 주세요.": "Choose a plant to dig up.",
  "없는 스테이지입니다.": "This garden does not exist.",
  "저장 형식이 맞지 않습니다.": "The save format is invalid.",
  "새 식물 해금과 밸런스를 적용했어요. 이전에 심은 식물과 진행 기록은 그대로예요.": "Plant unlocks and balance have been updated. Your existing plants and progress are safe.",
  "브라우저가 기기 저장을 막고 있어요. 창을 닫으면 진행 상황이 사라져요.": "The browser is blocking saves. Closing this window will lose your progress.",
  "기기 저장이 차단되어 있어요. 창을 닫으면 진행 상황이 사라질 수 있어요.": "Device storage is blocked. Closing this window may lose your progress.",
  "이 브라우저는 효과음을 지원하지 않아요.": "This browser does not support sound effects.",
  "저장 확인 시간이 초과됐어요.": "Checking the offline files timed out.",
  "새 버전이 준비됐어요. 처음 화면이나 일시 정지에서 '저장하고 업데이트'를 눌러요.": "An update is ready. Choose 'Save and update' on the home or pause screen.",
  "새 버전을 저장하지 못했어요. 기존 게임은 유지돼요. 온라인에서 다시 열어 주세요.": "The update could not be downloaded. Your current game is safe. Open it online to retry.",
  "저장하고 업데이트": "Save and update",
  "업데이트 적용 중…": "Applying update…",
  "업데이트를 멈췄어요. 기존 정원을 계속하거나 나중에 다시 시도해 주세요.": "The update stopped. Continue your garden or try again later.",
  "진행을 저장하지 못해 업데이트를 멈췄어요.": "The update stopped because your progress could not be saved.",
  "준비된 새 버전을 찾지 못했어요. 온라인에서 다시 열어 주세요.": "No ready update was found. Open the game online to retry.",
  "버전 전환 시간이 초과됐어요.": "Switching versions timed out.",
  "오프라인 저장소가 아직 준비되지 않았어요.": "Offline storage is not ready yet.",
  "게임 파일을 기기에 저장하는 중…": "Saving game files to this device…",
  "일부 파일이 없어요. 온라인에서 다시 저장해 주세요.": "Some files are missing. Reconnect and retry the download.",
  "오프라인 준비 완료 · 이 기기에 저장됨": "Offline ready · Saved on this device",
  "오프라인 준비 완료 · 인터넷 없이 플레이 중": "Offline ready · Playing without internet",
  "오프라인 저장에는 HTTPS 주소와 지원 브라우저가 필요해요.": "Offline storage requires HTTPS and a supported browser.",
  "온라인에서 다시 저장해 주세요.": "Reconnect and retry the download.",
};

const patterns = [
  [/^함께할 식물을 최대 (\d+)종 골라 주세요\. 선택한 카드를 다시 누르면 뺄 수 있어요\.$/, (_, count) => `Choose up to ${count} plants. Tap a selected card again to remove it.`],
  [/^함께할 식물을 1~(\d+)종 골라 주세요\.$/, (_, count) => `Choose 1 to ${count} plants for your team.`],
  [/^등장 진행 (\d+)% · 남은 좀비 (\d+)명$/, (_, percent, count) => `Spawning ${percent}% · Zombies left: ${count}`],
  [/^남은 좀비 (\d+)명$/, (_, count) => `Zombies left: ${count}`],
  [/^선택한 식물 (\d+) \/ (\d+)종$/, (_, count, max) => `Selected plants: ${count} / ${max}`],
  [/^화면 (v\d+)$/, (_, v) => `Version ${v}`],
  [/^(\d+)번째 정원 이어서 하기$/, (_, n) => `Continue garden ${n}`],
  [/^(\d+)\. (.+), (잠김|별 (\d+)개)$/, (_, n, name, state, stars) => `${n}. ${t(name)}, ${stars === undefined ? "locked" : `${stars} stars`}`],
  [/^(\d+)\. (.+)$/, (_, n, name) => `${n}. ${t(name)}`],
  [/^(기본|사용) · (.+)$/, (_, kind, name) => `${kind === "기본" ? "Start" : "Use"} · ${t(name)}`],
  [/^(.+) · (처음부터 사용 가능|\d+번째 정원 해금)$/, (_, name, unlock) => `${t(name)} · ${t(unlock)}`],
  [/^(\d+)번째 정원 해금$/, (_, n) => `Garden ${n}`],
  [/^☀ (\d+) · (.+)$/, (_, cost, description) => `☀ ${cost} · ${t(description)}`],
  [/^(.+) 정원이 열렸어요\. 친구들과 다음 소풍을 떠나 볼까요\?$/, (_, name) => `${t(name)} is now open. Ready for the next garden?`],
  [/^새 식물 해금: (.+)!$/, (_, names) => `Unlocked: ${names.split(", ").map(t).join(", ")}!`],
  [/^햇빛 (\d+) · (\d+)번째 정원부터 사용$/, (_, cost, stage) => `${cost} sunlight · From garden ${stage}`],
  [/^(\d+)번째 정원에서 새 친구와 함께해요\.$/, (_, n) => `Meet your new teammate in garden ${n}.`],
  [/^별 (\d+)개$/, (_, n) => `${n} stars`],
  [/^막아낸 좀비 (\d+)명 · 심은 친구 (\d+)개$/, (_, enemies, plants) => `${enemies} zombies stopped · ${plants} plants placed`],
  [/^(.+), 햇빛 (\d+)\. (.+)$/, (_, name, cost, description) => `${t(name)}, ${cost} sunlight. ${t(description)}`],
  [/^(.+), (\d+)번째 정원부터 해금$/, (_, name, n) => `${t(name)}, available from garden ${n}`],
  [/^(\d+)정원 해금$/, (_, n) => `Garden ${n}`],
  [/^(\d+)초$/, (_, n) => `${n}s`],
  [/^(\d+)줄 (\d+)칸, (.+)$/, (_, row, col, name) => `Row ${row}, column ${col}, ${t(name)}`],
  [/^햇빛 (\d+)를 돌려받았어요\.$/, (_, n) => `Refunded ${n} sunlight.`],
  [/^햇빛 (\d+) 모으기$/, (_, n) => `Collect ${n} sunlight`],
  [/^남은 하트 (\d+)개$/, (_, n) => `${n} hearts remaining`],
  [/^(\d+) \/ 3번째 무리$/, (_, n) => `Wave ${n} / 3`],
  [/^막아낸 좀비 (\d+) \/ (\d+)$/, (_, n, total) => `Stopped ${n} / ${total}`],
  [/^(\d+)번째 무리가 오고 있어요!$/, (_, n) => `Wave ${n} is coming!`],
  [/^새 식물: (.+) · 카드를 골라 심어요!$/, (_, names) => `New: ${names.split(", ").map(t).join(", ")} · Pick a card!`],
  [/^(.+)은 (\d+)번째 정원부터 함께해요\.$/, (_, name, n) => `${t(name)} is available from garden ${n}.`],
  [/^캐릭터 그림 준비 실패 · (.+) 온라인 상태에서 다시 시도해 주세요\.$/, (_, error) => `Character art failed to load · ${t(error)} Reconnect and try again.`],
  [/^(\w+) 그림을 불러오는 시간이 초과됐어요\.$/, (_, type) => `Loading ${type} art timed out.`],
  [/^(\w+) 프레임 시트의 크기가 맞지 않아요\.$/, (_, type) => `The ${type} sprite sheet has an invalid size.`],
  [/^(\w+) 프레임 그림을 불러오지 못했어요\.$/, (_, type) => `Could not load the ${type} sprite sheet.`],
  [/^저장을 불러오지 못했어요\. 이 창에서는 새로 시작해요\. \(([\s\S]+)\)$/, (_, error) => `Could not load your save. Starting fresh in this window. (${t(error)})`],
  [/^기기에 저장하지 못했어요\. 저장 공간·비공개 브라우징 설정을 확인해 주세요\. \(([\s\S]+)\)$/, (_, error) => `Could not save. Check device storage and private browsing settings. (${t(error)})`],
  [/^소리를 켜지 못했어요\. 소리 버튼을 다시 눌러 주세요\. \(([\s\S]+)\)$/, (_, error) => `Could not enable sound. Try the sound button again. (${t(error)})`],
  [/^업데이트를 적용하지 못했어요\. ([\s\S]+)$/, (_, error) => `Could not apply the update. ${t(error)}`],
  [/^업데이트 확인 실패 · ([\s\S]+) 기존 저장된 게임은 계속할 수 있어요\.$/, (_, error) => `Update check failed · ${t(error)} Your saved game is still available.`],
  [/^오프라인 준비 미완료 · ([\s\S]+)$/, (_, error) => `Offline download incomplete · ${t(error)}`],
  [/^: (.+)$/, (_, detail) => `: ${t(detail)}`],
  [/^(.+): (.+)$/, (_, name, detail) => `${t(name)}: ${t(detail)}`],
];
messages["소리 일시 정지 실패"] = "Could not pause sound";
Object.assign(messages, {
  "소리 설정": "Sound settings",
  "소리 켜기": "Turn sound on",
  "소리 끄기": "Turn sound off",
  "효과음 음량": "Effects volume",
  "미리 듣기": "Preview sound",
  "완료": "Done",
  "효과음은 처음에는 꺼져 있어요. 소리를 켜거나 음량을 올린 뒤 미리 듣기로 확인해 주세요.": "Sound starts off. Turn it on or raise the volume, then use Preview sound to check.",
  "들리지 않으면 기기의 미디어 음량과 무음 모드, Bluetooth 출력도 확인해 주세요.": "If you hear nothing, check your device's media volume, silent mode, and Bluetooth output.",
  "정원 선택 · 다시하기": "Choose / replay",
  "다시하기": "Replay",
  "완료한 정원도 다시하기를 눌러 처음부터 도전할 수 있어요. 모은 별과 열린 정원은 지우지 않아요.": "Tap Replay on a completed garden to start it over. Your stars and unlocked gardens stay.",
  "좀비 웨이브 진행": "Zombie wave progress",
  "시작": "Start",
  "중간": "Middle",
  "최종": "Final",
  "등장 완료 · 남은 좀비를 막아요!": "All spawned · Stop the remaining zombies!",
  "함께할 식물 고르기": "Choose your team",
  "이 식물로 시작": "Start with this team",
  "선택 취소": "Remove selection",
  "이번 정원에 고른 식물이 아니에요.": "This plant is not in your team for this garden.",
  "햇빛을 누르거나 손가락으로 쓸어 모아요. 놓쳐도 8초 뒤 자동으로 모여요.": "Tap sunlight or sweep your finger across it. Missed sunlight is collected after 8 seconds.",
  "시작 전에 최대 6종, 10번째 정원에서는 8종을 골라요. 전투 중에는 고른 식물만 크게 보여요. 카드가 많으면 목록을 밀어 보세요. 키보드에서는 Tab으로 이동해요.": "Choose up to 6 plants, or 8 in garden 10. Only your team appears on large battle cards. Scroll the list for more cards, or use Tab with a keyboard.",
});
messages["오프라인 확인 실패"] = "Offline check failed";

export function t(source) {
  const value = String(source);
  if (language === "ko") return value;
  const key = value.trim();
  let result = messages[key];
  if (result === undefined) {
    for (const [pattern, format] of patterns) {
      const match = key.match(pattern);
      if (match) { result = format(...match); break; }
    }
  }
  return result === undefined ? value : value.replace(key, () => result);
}

// Keep source strings when updating existing nodes so language changes preserve event handlers.
const textSources = new WeakMap();
const attributeSources = new WeakMap();
export function text(node, source) {
  const result = t(source);
  if (node.textContent !== result) node.textContent = result;
  const child = node.nodeType === 3 ? node : node.firstChild;
  if (child) textSources.set(child, { source: String(source), result });
}
export function label(node, source) {
  node.setAttribute("aria-label", t(source));
  const previous = attributeSources.get(node) ?? {};
  previous["aria-label"] = { source, result: t(source) };
  attributeSources.set(node, previous);
}
export function localize(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("script, style, [data-language]")) continue;
    const previous = textSources.get(node);
    text(node, previous?.result === node.textContent ? previous.source : node.textContent);
  }
  for (const node of [root, ...root.querySelectorAll("[aria-label], [alt], [title]")]) {
    const previous = attributeSources.get(node) ?? {};
    for (const attribute of ["aria-label", "alt", "title"]) {
      if (!node.hasAttribute(attribute) || node.hasAttribute("data-language")) continue;
      const current = node.getAttribute(attribute);
      const source = previous[attribute]?.result === current ? previous[attribute].source : current;
      const result = t(source);
      node.setAttribute(attribute, result);
      previous[attribute] = { source, result };
    }
    attributeSources.set(node, previous);
  }
}
