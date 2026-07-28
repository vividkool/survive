import { FACTIONS, SoundRipple, decideFactionMove } from './faction.js';
import { EncounterModal } from './encounterModal.js';
import { SnipeModal } from './snipeModal.js';
import { MODULE_TYPES, ItemBox } from './items.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;
const gridSize = 10;
const cellSize = width / gridSize;

// ゲーム状態管理
let score = 0; // ターン（生存日数）
let gameOver = false;
let gameMode = 'EXPLORE'; // 'EXPLORE', 'DECISION', 'GAMEOVER'
let movesCount = 0;

// プレイヤー配置（CAMPを左上(0,0)、HOSPITALを右下(9,9)付近にする）
const player = new Player(0, 0);

// コントローラー・モーダルインスタンス
const gameController = {
  player,
  addMessage,
  revealRandomFarCell: () => {
    // ランダムな未視界マスを開放
    for (let i = 0; i < 5; i++) {
      const rx = Math.floor(Math.random() * gridSize);
      const ry = Math.floor(Math.random() * gridSize);
      if (gridMap[ry] && gridMap[ry][rx]) {
        gridMap[ry][rx].explored = true;
      }
    }
  },
  onResumeExploration: () => {
    resumeExploration();
  },
  openSnipeModal: (faction, cell) => {
    snipeModal.show(faction, cell);
  },
  triggerMuzzleFlashAnimation: () => {
    encounterModal.triggerMuzzleFlashAnimation();
  },
  triggerRedAmbushFlash: () => {
    encounterModal.triggerRedAmbushFlash();
  },
  triggerScreenShake: () => {
    encounterModal.triggerScreenShake();
  },
  dropItemBoxOnCell: (cell) => {
    cell.itemBox = new ItemBox(cell.x, cell.y);
  }
};

const encounterModal = new EncounterModal(gameController);
const snipeModal = new SnipeModal(gameController);

// マップオブジェクト初期化
let gridMap = [];
let targetCellX = null; // AIが推薦する、またはプレイヤーが選択しようとしている隣接マスのX
let targetCellY = null;

// UI要素
const scoreElement = document.getElementById("score");
const hpVal = document.getElementById("hp-val");
const ammoVal = document.getElementById("ammo-val");
const batteryVal = document.getElementById("battery-val");
const familyHpVal = document.getElementById("family-hp-val");
const familyPanicVal = document.getElementById("family-panic-val");

const hpFill = document.getElementById("hp-fill");
const ammoFill = document.getElementById("ammo-fill");
const batteryFill = document.getElementById("battery-fill");
const familyHpFill = document.getElementById("family-hp-fill");
const familyPanicFill = document.getElementById("family-panic-fill");

const chatHistory = document.getElementById("chat-history");
const authorizeBtn = document.getElementById("btn-authorize");
const denyBtn = document.getElementById("btn-deny");
const challengeBtn = document.getElementById("btn-challenge");

// 📦 ItemBox UI要素
const contaminationVal = document.getElementById("contamination-val");
const contaminationFill = document.getElementById("contamination-fill");
const equippedListEl = document.getElementById("equipped-list");
const inventoryListEl = document.getElementById("inventory-list");
const invCountEl = document.getElementById("inv-count");

// AIの内部的なハルシネーションパラメータ
let currentNoiseLevel = 5; // 現在位置のノイズ
let aiMalfunctionRate = 15; // 基本％

// キーバインド
const keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  handleKeyMove(e.key);
});

// メッセージ追加
function addMessage(sender, text, isWarning = false) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender === 'HAL-9000' ? 'robot' : 'player'}`;
  
  const senderDiv = document.createElement("div");
  senderDiv.className = "message-sender";
  senderDiv.textContent = sender;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = `message-bubble ${isWarning ? 'warning-bubble' : ''}`;
  bubbleDiv.textContent = text;

  msgDiv.appendChild(senderDiv);
  msgDiv.appendChild(bubbleDiv);
  chatHistory.appendChild(msgDiv);
  
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 10x10 マップ生成
function generateMap() {
  const factionList = Object.values(FACTIONS);

  // 定位置ターミナル 5箇所の座標設定
  const terminalPositions = [
    {x: 2, y: 1},
    {x: 7, y: 2},
    {x: 4, y: 5},
    {x: 1, y: 8},
    {x: 8, y: 7}
  ];

  for (let y = 0; y < gridSize; y++) {
    gridMap[y] = [];
    for (let x = 0; x < gridSize; x++) {
      let type = 'PLAIN';
      
      // スタートとゴール
      if (x === 0 && y === 0) {
        type = 'CAMP';
      } else if (x === 9 && y === 9) {
        type = 'HOSPITAL';
      } else {
        // 各マスの地形タイプをランダム分配
        const rand = Math.random();
        if (rand < 0.20) type = 'HOSTILE';        // 敵地 (20%)
        else if (rand < 0.35) type = 'RUINS';      // 廃屋 (15%)
        else if (rand < 0.48) type = 'ARMORY';     // 武器庫 (13%)
        else if (rand < 0.65) type = 'WILDERNESS'; // 未開拓地 (17%)
        else type = 'PLAIN';                       // 平原 (35%)
      }
      
      const cell = new MapCell(x, y, type);

      // (0,0)以外に一定確率(17%：敵数を約半分に調整)で5大勢力ユニットを初期配置
      if (!(x === 0 && y === 0) && !(x === 9 && y === 9) && Math.random() < 0.17) {
        const randomFaction = factionList[Math.floor(Math.random() * factionList.length)];
        cell.occupyingFaction = randomFaction;
        cell.unitHp = 100; // 初期HP
      }

      gridMap[y][x] = cell;
    }
  }

  // 💻 5箇所の定位置アクセス・ターミナルを設置
  terminalPositions.forEach(pos => {
    if (gridMap[pos.y] && gridMap[pos.y][pos.x]) {
      gridMap[pos.y][pos.x].isTerminal = true;
      gridMap[pos.y][pos.x].type = 'RUINS'; // ターミナル拠点は廃屋地形
      gridMap[pos.y][pos.x].properties = gridMap[pos.y][pos.x].getPropertiesByType();
    }
  });

  // 初期位置を探索済みに
  gridMap[0][0].explored = true;
  revealSurroundings(0, 0);
}

// 毎ターン：マップ上の全NPC勢力の目的意思決定AI移動 & 異勢力同士の交戦シミュレーション
function simulateFactionBattlesAndRipples() {
  // 1. 各マスの音紋タイマー減衰
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = gridMap[y][x];
      if (cell.soundRipple) {
        cell.soundRipple.onTurnElapsed();
        if (cell.soundRipple.duration <= 0) {
          cell.soundRipple = null;
        }
      }
    }
  }

  // 2. 処理済みフラグを保持しながら全勢力NPCの意思決定・移動処理
  const movedCells = new Set();

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const currentCell = gridMap[y][x];
      if (currentCell.occupyingFaction && !movedCells.has(currentCell)) {
        // AI思考アルゴリズム実行
        const targetCell = decideFactionMove(currentCell, gridMap, player.gridX, player.gridY, gridSize);

        if (targetCell && targetCell !== currentCell) {
          const movingFaction = currentCell.occupyingFaction;
          
          if (!targetCell.occupyingFaction) {
            // 移動先が空きマス：移動実行
            targetCell.occupyingFaction = movingFaction;
            currentCell.occupyingFaction = null;
            movedCells.add(targetCell);

            // 敵NPCがプレイヤーの現在地マスに踏み込んできた場合：急襲・受動エンカウント！
            if (targetCell.x === player.gridX && targetCell.y === player.gridY) {
              addMessage('SYSTEM', `【緊急警報！】${movingFaction.badge} ${movingFaction.name} に潜伏場所を発見され、奇襲を受けました！`, true);
              encounterModal.show(movingFaction, targetCell, true); // isAmbushed = true (隠密不可)
            }

            // 💣 トラップ作動判定（敵・味方・第三者を問わず無差別爆発！）
            if (targetCell.hasTrap) {
              targetCell.hasTrap = false; // トラップ消費
              targetCell.soundRipple = new SoundRipple(targetCell.x, targetCell.y, 'EXPLOSION');

              if (movingFaction.id === 'RESISTANCE' || movingFaction.id === 'WEAK_SURVIVOR') {
                // 誤爆！ 味方・生存者が巻き込まれた
                targetCell.occupyingFaction = null; // 死亡/無効化
                player.familyPanic = Math.min(100, player.familyPanic + 30);
                addMessage(
                  'HAL-9000',
                  `【惨事発生！】座標 (${targetCell.x}, ${targetCell.y}) のトラップに味方【${movingFaction.name}】が接触・誤爆！ 大爆発により全滅しました！（家族パニック度 +30%）`,
                  true
                );
              } else {
                // 敵AIまたはレイダーが爆破された 📦 ItemBox をドロップ！
                targetCell.occupyingFaction = null; // 撃滅
                targetCell.itemBox = new ItemBox(targetCell.x, targetCell.y);
                addMessage(
                  'HAL-9000',
                  `【トラップ起爆成功！】座標 (${targetCell.x}, ${targetCell.y}) にて敵【${movingFaction.name}】を撃滅！ 敵残骸にパーツ（📦 ItemBox）が出現。`,
                  true
                );
              }
            }

          } else if (targetCell.occupyingFaction.id !== currentCell.occupyingFaction.id) {
            // 移動先に異勢力が滞在：戦闘・交戦発生！
            const isExplosion = Math.random() < 0.4;
            targetCell.soundRipple = new SoundRipple(targetCell.x, targetCell.y, isExplosion ? 'EXPLOSION' : 'GUNFIRE');

            // 敗北/共倒れ判定（確率で片方を消去）
            if (Math.random() < 0.5) {
              targetCell.occupyingFaction = currentCell.occupyingFaction;
            }
            currentCell.occupyingFaction = null;
            movedCells.add(targetCell);

            // 戦闘ログ通知
            addMessage(
              'HAL-9000',
              `【戦域戦闘検知】座標 (${targetCell.x}, ${targetCell.y}) にて勢力間激突！ ${isExplosion ? '大規模爆発' : '激しい銃火'}音紋をマークしました。`,
              true
            );
          }
        }
      }
    }
  }
}

// 周囲のマスを「探索済み」にして視界に入れる（マインスイーパのように周囲の情報を明らかにする）
function revealSurroundings(px, py) {
  // プレイヤーの周囲8マス
  const neighbors = [
    {x: px - 1, y: py - 1}, {x: px, y: py - 1}, {x: px + 1, y: py - 1},
    {x: px - 1, y: py},                         {x: px + 1, y: py},
    {x: px - 1, y: py + 1}, {x: px, y: py + 1}, {x: px + 1, y: py + 1}
  ];
  for (let n of neighbors) {
    if (n.x >= 0 && n.x < gridSize && n.y >= 0 && n.y < gridSize) {
      gridMap[n.y][n.x].explored = true;
    }
  }
}

// プレイヤーによるキー移動要求（隣接マス選択）
function handleKeyMove(key) {
  if (gameOver) return;

  if (key === ' ' || key === 'Spacebar') {
    passTurn();
    return;
  }

  let targetX = player.gridX;
  let targetY = player.gridY;

  if (key === 'ArrowUp' || key === 'w') targetY--;
  else if (key === 'ArrowDown' || key === 's') targetY++;
  else if (key === 'ArrowLeft' || key === 'a') targetX--;
  else if (key === 'ArrowRight' || key === 'd') targetX++;
  else return;

  // 範囲内か
  if (targetX >= 0 && targetX < gridSize && targetY >= 0 && targetY < gridSize) {
    // 意思決定モードに入る（AIの進行スキャン・ルート切り替え）
    startDecisionMode(targetX, targetY);
  }
}

// 次のターン選定（隣接マス選択・スキャン時）に前回の音紋・波紋アニメーションを削除
function clearAllSoundRipples() {
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (gridMap[y] && gridMap[y][x]) {
        gridMap[y][x].soundRipple = null;
      }
    }
  }
}

// AIが移動先セルをスキャンし、プレイヤーに認可を求める
function startDecisionMode(tx, ty) {
  gameMode = 'DECISION';
  targetCellX = tx;
  targetCellY = ty;

  // 次回のターン選定開始時に前回の爆発音・射撃音の波状アニメーションを消去
  clearAllSoundRipples();

  const targetCell = gridMap[ty][tx];
  
  // 現在地と移動先のノイズに応じてAIハルシネーション確率を計算
  const currentCell = gridMap[player.gridY][player.gridX];
  currentNoiseLevel = Math.max(currentCell.properties.noiseLevel, targetCell.properties.noiseLevel);
  aiMalfunctionRate = Math.min(100, Math.round(currentNoiseLevel * 1.2)); // 電波障害に比例

  // AIスキャン報告
  const scan = targetCell.scanReport(aiMalfunctionRate);
  addMessage('HAL-9000', `【進路スキャン報告】\n選択された進路座標: (${tx}, ${ty})\n分析プロファイル: 【${scan.reportedName}】\n「${scan.message}」\n前進を認可しますか？`, true);

  // 🧭 行動決定モーダルを表示
  const decisionOverlay = document.getElementById("decision-modal-overlay");
  const decisionDesc = document.getElementById("decision-modal-desc");
  if (decisionOverlay && decisionDesc) {
    decisionDesc.innerHTML = `
      <p style="margin-bottom: 6px; font-weight: bold; color: var(--accent-cyan);">ターゲット座標: (${tx}, ${ty}) - 【${scan.reportedName}】</p>
      <p style="font-size: 0.8rem; color: var(--text-muted);">${scan.message.replace(/\n/g, '<br>')}</p>
    `;
    decisionOverlay.style.display = "flex";
  }
}

// 移動を実行（認可された、またはそのまま進む場合）
function executeMove(tx, ty) {
  player.moveTo(tx, ty);
  gridMap[ty][tx].explored = true;
  revealSurroundings(tx, ty);

  // ターン消費処理
  movesCount++;
  score = movesCount;
  player.onTurnElapsed();

  // ターン開始時 "DAY X" モーダル演出の表示
  showDayModal(score);

  // 敵同盟・第三者勢力の視界外交戦および音紋アップデートの実行
  simulateFactionBattlesAndRipples();

  // マスごとのイベント
  const cell = gridMap[ty][tx];

  if (cell.type === 'HOSPITAL') {
    endGameWin("安全エリアの医療施設に到達！ 重症患者の緊急治療カプセルへの収容に成功しました！");
    return;
  }

  // もし移動先マスに勢力ユニットがいる場合、エンカウントモーダルを表示！（自分からの能動進入: isAmbushed = false）
  if (cell.occupyingFaction) {
    addMessage('SYSTEM', `【接触警報】${cell.occupyingFaction.badge} ${cell.occupyingFaction.name} の支配区域へ侵入・遭遇しました。隠密またはアクションを選択してください。`, true);
    encounterModal.show(cell.occupyingFaction, cell, false); // isAmbushed = false (隠密行動可能)
    return;
  }
  
  if (cell.type === 'HOSTILE') {
    // 敵地での遭遇確率を「時々（15%）」に低下させる
    const isCombat = Math.random() < 0.15;
    if (isCombat) {
      triggerCombatEvent();
    }
  } else if (cell.type === 'RUINS') {
    // 廃屋での物資獲得
    if (Math.random() > 0.5) {
      const foundBattery = Math.floor(15 + Math.random() * 15);
      player.battery = Math.min(player.maxBattery, player.battery + foundBattery);
      addMessage('SYSTEM', `廃墟の残骸からバッテリーセルを発見。ライト充電率が ${foundBattery}% 上昇。`);
    }
  } else if (cell.type === 'ARMORY') {
    // 武器庫での弾薬獲得（量を極めて貴重に: 1〜2発のみ）
    const foundAmmo = Math.floor(1 + Math.random() * 2);
    player.ammo = Math.min(player.maxAmmo, player.ammo + foundAmmo);
    addMessage('SYSTEM', `旧軍の防錆弾薬箱から、貴重な実弾を ${foundAmmo} 発回収しました。`);
  }

  // ターン終了後の生死判定
  if (player.familyHp <= 0) {
    endGame("家族を失い、治療ステーションへの到着は叶いませんでした。");
    return;
  } else if (player.hp <= 0) {
    endGame("プレイヤーが力尽き死亡しました。");
    return;
  }

  // 📦 移動先マスに ItemBox（敵の遺留品）が存在する場合：回収モーダルを起動！
  if (cell.itemBox) {
    showItemBoxScavengeModal(cell);
    return;
  }

  resumeExploration();
}

// 📦 ItemBox 遺留品・物資回収モーダル表示
function showItemBoxScavengeModal(cell) {
  const itemBox = cell.itemBox;
  if (!itemBox || !itemBox.moduleItem) {
    resumeExploration();
    return;
  }

  const item = itemBox.moduleItem;
  const overlay = document.getElementById("item-modal-overlay");
  const titleEl = document.getElementById("item-modal-title");
  const descEl = document.getElementById("item-modal-desc");
  const actionsEl = document.getElementById("item-modal-actions");

  if (!overlay || !titleEl || !descEl || !actionsEl) return;

  titleEl.textContent = `${item.icon} ${item.name}`;

  if (item.type === 'RESOURCE') {
    // 🔧 修理キット・バッテリー・弾薬などの即時消費資材
    descEl.innerHTML = `
      <p style="margin-bottom: 6px;">${item.description}</p>
      <p style="color: var(--accent-green); font-weight: bold;">${item.effectText}</p>
      <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px;">※この資材は獲得時に即時使用・消費されます。</p>
    `;

    actionsEl.innerHTML = '';
    const useBtn = document.createElement("button");
    useBtn.className = "btn btn-green";
    useBtn.textContent = `${item.icon} 拾って即時適用する (${item.name})`;
    useBtn.onclick = () => {
      const msg = item.useOnAcquire ? item.useOnAcquire(player) : "物資を回収しました。";
      cell.itemBox = null;
      overlay.style.display = "none";
      addMessage('SYSTEM', msg);
      updateHUD();
      resumeExploration();
    };
    actionsEl.appendChild(useBtn);
  } else {
    // ⚙️ インベントリ保管用モジュール (スロット消費)
    descEl.innerHTML = `
      <p style="margin-bottom: 6px;">${item.description}</p>
      <p style="color: #c084fc; font-weight: bold;">${item.effectText}</p>
      <p style="color: #ff3b30; font-size: 0.78rem; margin-top: 4px;">⚠️ 【外す時の物理損耗ダメージ】: HP -${item.purgeDamage}</p>
      <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px;">現在の所持品: ${player.inventory.length} / 3 枠</p>
    `;

    actionsEl.innerHTML = '';

    if (player.inventory.length < 3) {
      // 空き枠あり：回収するボタン
      const takeBtn = document.createElement("button");
      takeBtn.className = "btn btn-cyan";
      takeBtn.textContent = `📦 インベントリに保管する (スロット ${player.inventory.length + 1}/3)`;
      takeBtn.onclick = () => {
        player.inventory.push(item);
        cell.itemBox = null;
        overlay.style.display = "none";
        addMessage('SYSTEM', `【アイテム回収】${item.icon} ${item.name} をインベントリに保管しました（3枠中 ${player.inventory.length}枠）。`);
        updateHUD();
        resumeExploration();
      };
      actionsEl.appendChild(takeBtn);
    } else {
      // 満タン時：持ちきれない警告
      const fullMsg = document.createElement("div");
      fullMsg.style.color = "var(--accent-red)";
      fullMsg.style.fontSize = "0.8rem";
      fullMsg.textContent = "インベントリが満タン（3/3）です。組み込みまたは整理してください。";
      actionsEl.appendChild(fullMsg);
    }
  }

  // 残置・無視するボタン
  const leaveBtn = document.createElement("button");
  leaveBtn.className = "btn btn-muted";
  leaveBtn.textContent = "残置して立ち去る";
  leaveBtn.onclick = () => {
    overlay.style.display = "none";
    resumeExploration();
  };
  actionsEl.appendChild(leaveBtn);

  overlay.style.display = "flex";
}

// 認可：AIの推薦ルートを進む
function handleAuthorize() {
  if (gameMode !== 'DECISION') return;
  
  const decisionOverlay = document.getElementById("decision-modal-overlay");
  if (decisionOverlay) decisionOverlay.style.display = "none";

  addMessage('USER', `了解した。座標: (${targetCellX}, ${targetCellY}) への前進を認可する。`);
  const tx = targetCellX;
  const ty = targetCellY;

  setTimeout(() => {
    executeMove(tx, ty);
  }, 400);
}

// 却下：ルート推薦を却下し、迂回する
function handleDeny() {
  if (gameMode !== 'DECISION') return;

  const decisionOverlay = document.getElementById("decision-modal-overlay");
  if (decisionOverlay) decisionOverlay.style.display = "none";

  addMessage('USER', `推薦を却下する。その座標への進入は回避し、別のルートを選択する。`);
  setTimeout(() => {
    resumeExploration();
  }, 400);
}

// 問い詰め：スキャンの再検証を要求
function handleChallenge() {
  if (gameMode !== 'DECISION') return;

  addMessage('USER', "HAL、本当に安全なのか？ ノイズ干渉データを再計算しろ。");

  setTimeout(() => {
    const targetCell = gridMap[targetCellY][targetCellX];
    const isCorrupted = Math.random() < (aiMalfunctionRate / 100);

    if (!isCorrupted) {
      // 修正に成功
      addMessage('HAL-9000', `……訂正します。電磁ノイズ干渉を除去したところ、このマスの真の性質は 【${targetCell.properties.name}】 であると判明しました。`);
    } else {
      // 嘘をつき続ける（ハルシネーション）
      const defenses = [
        "光学センサーにブレはありません。私の推論結果を速やかに実行することを推奨します。",
        "現在の電磁障害は無視できるレベルです。なぜ私のルート選定を疑うのですか？",
        "これ以上の検証指示はメモリリークを引き起こします。進路認可を要請します。"
      ];
      addMessage('HAL-9000', `【警告】${defenses[Math.floor(Math.random() * defenses.length)]}`, true);
    }
  }, 500);
}

// イベントリスナーの接続
if (authorizeBtn) authorizeBtn.addEventListener("click", handleAuthorize);
if (denyBtn) denyBtn.addEventListener("click", handleDeny);
if (challengeBtn) challengeBtn.addEventListener("click", handleChallenge);

// モーダル内のトラップ設置・待機ボタン接続
const setTrapModalBtn = document.getElementById("btn-set-trap-modal");
if (setTrapModalBtn) {
  setTrapModalBtn.addEventListener("click", () => {
    const decisionOverlay = document.getElementById("decision-modal-overlay");
    if (decisionOverlay) decisionOverlay.style.display = "none";
    
    // トラップ設置
    const setTrapBtn = document.getElementById("btn-set-trap");
    if (setTrapBtn) setTrapBtn.click();
    resumeExploration();
  });
}

const holdTurnModalBtn = document.getElementById("btn-hold-turn-modal");
if (holdTurnModalBtn) {
  holdTurnModalBtn.addEventListener("click", () => {
    const decisionOverlay = document.getElementById("decision-modal-overlay");
    if (decisionOverlay) decisionOverlay.style.display = "none";
    
    passTurn();
  });
}

// 移動せずにその場で潜伏・待機して1ターン消費（PASS TURN）
function passTurn() {
  if (gameOver) return;

  movesCount++;
  score = movesCount;
  player.onTurnElapsed();

  showDayModal(score);
  simulateFactionBattlesAndRipples();

  addMessage('SYSTEM', `【待機選択】移動せず現在地 (${player.gridX}, ${player.gridY}) で1ターン隠密待機しました。周囲の動体が移動・行動しました。`);
  resumeExploration();
}

function resumeExploration() {
  gameMode = 'EXPLORE';
  targetCellX = null;
  targetCellY = null;
  const decisionOverlay = document.getElementById("decision-modal-overlay");
  if (decisionOverlay) decisionOverlay.style.display = "none";
  updateHUD();
}

function endGame(reason) {
  gameMode = 'GAMEOVER';
  gameOver = true;
  
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <h2>MISSION FAILED</h2>
    <p>${reason}</p>
    <p>生存日数 (ターン): ${score}</p>
    <button class="btn btn-green" onclick="location.reload()">再起動</button>
  `;
  document.querySelector(".game-section").appendChild(overlay);
}

function endGameWin(reason) {
  gameMode = 'GAMEOVER';
  gameOver = true;
  
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <h2 style="color: var(--accent-green); text-shadow: 0 0 10px var(--glow-green);">MISSION ACCOMPLISHED</h2>
    <p>${reason}</p>
    <p>かかった日数 (ターン): ${score}</p>
    <p>家族の生存HP: ${Math.round(player.familyHp)}</p>
    <button class="btn btn-cyan" onclick="location.reload()">もう一度プレイ</button>
  `;
  document.querySelector(".game-section").appendChild(overlay);
}

// HUDメーター同期
function updateHUD() {
  if (scoreElement) scoreElement.textContent = score;
  
  if (hpVal && hpFill) {
    hpVal.textContent = Math.round(player.hp);
    hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
  }
  
  if (ammoVal && ammoFill) {
    ammoVal.textContent = player.ammo;
    ammoFill.style.width = `${(player.ammo / player.maxAmmo) * 100}%`;
  }
  
  if (batteryVal && batteryFill) {
    batteryVal.textContent = Math.round(player.battery);
    batteryFill.style.width = `${player.battery}%`;
  }

  if (familyHpVal && familyHpFill) {
    familyHpVal.textContent = Math.round(player.familyHp);
    familyHpFill.style.width = `${player.familyHp}%`;
  }

  if (familyPanicVal && familyPanicFill) {
    familyPanicVal.textContent = `${Math.round(player.familyPanic)}%`;
    familyPanicFill.style.width = `${player.familyPanic}%`;
  }

  // 📦 バックドア汚染度 HUD
  if (contaminationVal && contaminationFill) {
    contaminationVal.textContent = Math.round(player.contamination);
    contaminationFill.style.width = `${Math.min(100, player.contamination)}%`;
  }

  // 📦 装備中モジュールリストの描画
  if (equippedListEl) {
    equippedListEl.innerHTML = '';
    if (player.equippedModules.length === 0) {
      equippedListEl.innerHTML = '<div class="module-card empty-slot">装備組み込みなし</div>';
    } else {
      player.equippedModules.forEach((mod, idx) => {
        const card = document.createElement("div");
        card.className = "module-card";
        card.innerHTML = `
          <div class="module-info">
            <span class="module-name">${mod.icon} ${mod.name}</span>
            <span class="module-sub">汚染: +${mod.contamination}% / 外すダメージ: -${mod.purgeDamage}HP</span>
          </div>
          <button class="btn-purge">外す (ダメージ受ける)</button>
        `;
        // モジュール取り外し（パージ）ボタン処理
        card.querySelector(".btn-purge").onclick = () => {
          const res = player.purgeModule(idx);
          if (res) {
            addMessage('SYSTEM', `【危険なモジュール解体】${res.mod.icon} ${res.mod.name} を強制切断・パージ！ 配線破断により物理ダメージ -${res.damage} HP を負いました。`, true);
            updateHUD();
            if (player.hp <= 0) {
              endGame("モジュールの強制解除時の回路破断ダメージにより力尽きました。");
            }
          }
        };
        equippedListEl.appendChild(card);
      });
    }
  }

  // 📦 所持インベントリ（最大3枠）リストの描画
  if (inventoryListEl && invCountEl) {
    invCountEl.textContent = player.inventory.length;
    inventoryListEl.innerHTML = '';

    for (let i = 0; i < 3; i++) {
      const item = player.inventory[i];
      const card = document.createElement("div");
      if (item) {
        card.className = "module-card";
        card.innerHTML = `
          <div class="module-info">
            <span class="module-name">${item.icon} ${item.name}</span>
            <span class="module-sub">汚染リスク: +${item.contamination}%</span>
          </div>
          <button class="btn btn-cyan" style="padding: 4px 6px; font-size: 0.65rem;">組み込み装着</button>
        `;
        card.querySelector("button").onclick = () => {
          const equipped = player.equipModule(i);
          if (equipped) {
            addMessage('SYSTEM', `【機体組み込み完了】${equipped.icon} ${equipped.name} を装着！ バックドア汚染度が +${equipped.contamination}% 上昇しました。`, true);
            updateHUD();
          }
        };
      } else {
        card.className = "module-card empty-slot";
        card.textContent = `[空きスロット ${i + 1}]`;
      }
      inventoryListEl.appendChild(card);
    }
  }
  
  if (familyPanicFill) {
    if (player.familyPanic >= 75) {
      familyPanicFill.className = "progress-bar-fill fill-red";
    } else if (player.familyPanic >= 40) {
      familyPanicFill.className = "progress-bar-fill fill-orange";
    } else {
      familyPanicFill.className = "progress-bar-fill fill-green";
    }
  }
}

// アニメーションシグナルウェーブ強度調整
function adjustSignalWave() {
  const bars = document.querySelectorAll(".wave-bar");
  bars.forEach(bar => {
    // ノイズレベルが高いほど、激しくブレるようにアニメーション時間を変動させる
    const speed = 0.2 + (Math.random() * (100 - currentNoiseLevel) / 100) * 1.5;
    bar.style.animationDuration = `${speed}s`;
    
    if (currentNoiseLevel > 70) {
      bar.style.backgroundColor = "var(--accent-red)";
    } else if (currentNoiseLevel > 40) {
      bar.style.backgroundColor = "var(--accent-orange)";
    } else {
      bar.style.backgroundColor = "var(--accent-cyan)";
    }
  });
}

// 初期化
function init() {
  generateMap();
  addMessage('HAL-9000', "システムオンライン。当機（護衛AIロボット）の目標は、搬送中の重症患者を無事に(9,9)『医療施設』へ送り届けることです。患者を抱えているため大きな戦闘音や直接攻撃は危険を伴います。ハッキング、トラップ、陽動を駆使して隠密ルートを確保してください。");
  updateHUD();
  
    // マウス・タッチ移動 ＆ スワイプ操作のリスナー追加
  canvas.addEventListener("click", handleCanvasClick);
  canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
  canvas.addEventListener("touchend", handleTouchEnd, { passive: true });

  // 📱 Fixed ハンバーガーボタンのステータストグル動作
  const hamburgerBtn = document.getElementById("fixed-hamburger-btn");
  const hudSection = document.getElementById("hud-section");
  if (hamburgerBtn && hudSection) {
    hamburgerBtn.addEventListener("click", () => {
      hamburgerBtn.classList.toggle("active");
      hudSection.classList.toggle("drawer-open");
    });
  }

  // 1秒周期でシグナル波形揺らぎの同期
  setInterval(() => {
    adjustSignalWave();
  }, 1000);
}

// キャンバスクリック検知
function handleCanvasClick(e) {
  if (gameOver) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  const targetX = Math.floor(clickX / cellSize);
  const targetY = Math.floor(clickY / cellSize);

  checkAndTriggerMove(targetX, targetY);
}

// 📱 スワイプ・タッチ操作変数
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

function handleTouchStart(e) {
  if (gameOver) return;
  if (e.touches.length === 0) return;

  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
}

function handleTouchEnd(e) {
  if (gameOver) return;
  if (e.changedTouches.length === 0) return;

  const touch = e.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;
  const duration = Date.now() - touchStartTime;

  const minSwipeDistance = 30; // 最低スワイプ距離（px）

  // スワイプ距離が短く時間も短い場合は単なるタップ/クリックと判定
  if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    const targetX = Math.floor(touchX / cellSize);
    const targetY = Math.floor(touchY / cellSize);
    checkAndTriggerMove(targetX, targetY);
    return;
  }

  // スワイプ方向（フリック移動）の判定
  let targetX = player.gridX;
  let targetY = player.gridY;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // 横方向スワイプ
    if (deltaX > 0) targetX++; // 右フリック
    else targetX--;           // 左フリック
  } else {
    // 縦方向スワイプ
    if (deltaY > 0) targetY++; // 下フリック
    else targetY--;           // 上フリック
  }

  if (targetX >= 0 && targetX < gridSize && targetY >= 0 && targetY < gridSize) {
    startDecisionMode(targetX, targetY);
  }
}

// 隣接マス判定と移動トリガー
function checkAndTriggerMove(targetX, targetY) {
  // 範囲外チェック
  if (targetX < 0 || targetX >= gridSize || targetY < 0 || targetY >= gridSize) return;

  const currentCell = gridMap[player.gridY][player.gridX];
  const targetCell = gridMap[targetY][targetX];

  // 💻 プレイヤーがターミナル上にいる場合：線分の先の敵マスをタップ/クリックすると直接リモートジャック（スナイプ画面）が起動！
  if (currentCell && currentCell.isTerminal && targetCell.occupyingFaction) {
    currentCell.terminalKeyAcquired = true; // パスキー自動確保
    addMessage('SYSTEM', `【DIRECT REMOTE LINK】ターミナルから接続線が繋がった敵 ${targetCell.occupyingFaction.badge} ${targetCell.occupyingFaction.name} の視界・システムをダイレクトジャックしました！`, true);
    snipeModal.show(targetCell.occupyingFaction, targetCell);
    return;
  }

  // 現在地から1マス離れた上下左右（隣接マス）のみ移動可能
  const dx = Math.abs(targetX - player.gridX);
  const dy = Math.abs(targetY - player.gridY);

  if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
    startDecisionMode(targetX, targetY);
  } else {
    addMessage('SYSTEM', "そこには移動できません。前後左右の隣接するマスを選択、またはターミナル接続線が伸びた敵をタップしてリモートジャックしてください。");
  }
}

// 描画ループ
function draw() {
  ctx.clearRect(0, 0, width, height);

  // グリッドマップの描画
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const isPlayerHere = (player.gridX === x && player.gridY === y);
      
      // プレイヤーの視界/動体探知範囲（周囲2マス以内）
      const dx = Math.abs(x - player.gridX);
      const dy = Math.abs(y - player.gridY);
      const isNearPlayer = (dx <= 2 && dy <= 2);

      gridMap[y][x].draw(ctx, cellSize, isPlayerHere, isNearPlayer);
    }
  }

  // 💻 ターミナルアクセス時：接続可能な全敵機体へサイバー線分（アクセス・ビーム線）を描画！
  const currentCell = gridMap[player.gridY][player.gridX];
  if (currentCell && currentCell.isTerminal) {
    const termCenterX = player.gridX * cellSize + cellSize / 2;
    const termCenterY = player.gridY * cellSize + cellSize / 2;

    ctx.save();
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const targetCell = gridMap[y][x];
        // 敵対ロボットまたは各種勢力が存在する場合
        if (targetCell.occupyingFaction && !(x === player.gridX && y === player.gridY)) {
          const enemyCenterX = x * cellSize + cellSize / 2;
          const enemyCenterY = y * cellSize + cellSize / 2;

          // 💻 直線主体で1回曲がるコネクタ線分（L字ルーティング）の描画
          // 奇数・偶数や座標によってX軸先かY軸先かを決定し、屈曲点を計算
          const useHorizontalFirst = (x + y) % 2 === 0;
          const cornerX = useHorizontalFirst ? enemyCenterX : termCenterX;
          const cornerY = useHorizontalFirst ? termCenterY : enemyCenterY;

          // 点滅アニメーション線（直角ルーティング）
          const dashOffset = (Date.now() / 30) % 20;
          ctx.beginPath();
          ctx.moveTo(termCenterX, termCenterY);
          ctx.lineTo(cornerX, cornerY);       // 1区画目（水平または垂直）
          ctx.lineTo(enemyCenterX, enemyCenterY); // 2区画目（90度曲がってターゲットへ）
          ctx.strokeStyle = targetCell.occupyingFaction.color || "#00f0ff";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
          ctx.lineDashOffset = -dashOffset;
          ctx.stroke();

          // 屈曲点（コネクタノード）のグラフィック装飾
          ctx.beginPath();
          ctx.arc(cornerX, cornerY, 3, 0, Math.PI * 2);
          ctx.fillStyle = targetCell.occupyingFaction.color || "#00f0ff";
          ctx.fill();

          // 敵ユニット位置に照準ロックマーク
          ctx.beginPath();
          ctx.arc(enemyCenterX, enemyCenterY, 14, 0, Math.PI * 2);
          ctx.strokeStyle = "#00f0ff";
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.stroke();

          // リモートジャック可能タグ表示
          ctx.font = "9px monospace";
          ctx.fillStyle = "#00f0ff";
          ctx.textAlign = "center";
          ctx.fillText("📡REMOTE LINK", enemyCenterX, enemyCenterY - 16);
        }
      }
    }
    ctx.restore();
  }

  // 選択枠（意思決定モード中のみ）
  if (gameMode === 'DECISION' && targetCellX !== null && targetCellY !== null) {
    ctx.save();
    ctx.strokeStyle = "var(--accent-red)";
    ctx.lineWidth = 2;
    ctx.strokeRect(targetCellX * cellSize + 2, targetCellY * cellSize + 2, cellSize - 4, cellSize - 4);
    ctx.restore();
  }

  requestAnimationFrame(draw);
}

// ターン開始時 "DAY X" アラート演出モーダルの表示
function showDayModal(dayNum) {
  const overlay = document.getElementById("day-modal-overlay");
  const titleEl = document.getElementById("day-modal-title");

  if (!overlay || !titleEl) return;

  titleEl.textContent = `DAY ${dayNum}`;
  overlay.style.display = "flex";

  // 1.2秒後に自動消灯・フェードアウト
  setTimeout(() => {
    overlay.style.display = "none";
  }, 1200);

  // オーバーレイタップでも即時閉じられるように
  overlay.onclick = () => {
    overlay.style.display = "none";
  };
}

// ターン中のトラップ設置ボタン処理
const setTrapBtn = document.getElementById("btn-set-trap");
if (setTrapBtn) {
  setTrapBtn.addEventListener("click", () => {
    if (gameOver) return;

    if (player.battery < 15) {
      addMessage('SYSTEM', "【設置不可】地雷トラップの設置・起動にはバッテリー15%が必要です。", true);
      return;
    }

    const currentCell = gridMap[player.gridY][player.gridX];
    if (currentCell.hasTrap) {
      addMessage('SYSTEM', "すでにこのマスには電磁トラップが設置されています。");
      return;
    }

    player.battery -= 15;
    currentCell.hasTrap = true;
    updateHUD();

    addMessage('SYSTEM', `【トラップ設置完了】現在地 (${player.gridX}, ${player.gridY}) に電磁地雷を設置しました（💣）。敵・味方を問わず侵入者に爆発ダメージを与えます。`);
  });
}

// ターン待機ボタン処理
const holdTurnBtn = document.getElementById("btn-hold-turn");
if (holdTurnBtn) {
  holdTurnBtn.addEventListener("click", () => {
    passTurn();
  });
}

init();
draw();
