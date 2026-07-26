import { FACTIONS, SoundRipple } from './faction.js';
import { EncounterModal } from './encounterModal.js';

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
  }
};

const encounterModal = new EncounterModal(gameController);

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

      // (0,0)以外に一定確率(35%)で5大勢力ユニットを初期配置
      if (!(x === 0 && y === 0) && !(x === 9 && y === 9) && Math.random() < 0.35) {
        const randomFaction = factionList[Math.floor(Math.random() * factionList.length)];
        cell.occupyingFaction = randomFaction;
      }

      gridMap[y][x] = cell;
    }
  }
  
  // 初期位置を探索済みに
  gridMap[0][0].explored = true;
  revealSurroundings(0, 0);
}

// 毎ターン：視界外での敵勢力同士の交戦シミュレーションおよび音紋波紋（Sound Ripple）のアップデート
function simulateFactionBattlesAndRipples() {
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = gridMap[y][x];

      // 既存の音紋経過
      if (cell.soundRipple) {
        cell.soundRipple.onTurnElapsed();
        if (cell.soundRipple.duration <= 0) {
          cell.soundRipple = null;
        }
      }

      // 勢力が滞在している場合、近隣の他勢力と時々衝突
      if (cell.occupyingFaction && Math.random() < 0.25) {
        const isExplosion = Math.random() < 0.4;
        cell.soundRipple = new SoundRipple(x, y, isExplosion ? 'EXPLOSION' : 'GUNFIRE');
        
        // プレイヤーの視界外での戦闘メッセージログを通知
        const dx = Math.abs(x - player.gridX);
        const dy = Math.abs(y - player.gridY);
        if (dx > 1 || dy > 1) { // 遠方
          addMessage('HAL-9000', `【戦域音波検知】座標 (${x}, ${y}) 方向にて${isExplosion ? '大規模な爆発反応' : '激しい銃火'}を捕捉。MAP上に音紋波紋をマーキングしました。`, true);
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
  if (gameMode !== 'EXPLORE' || gameOver) return;

  let targetX = player.gridX;
  let targetY = player.gridY;

  if (key === 'ArrowUp' || key === 'w') targetY--;
  else if (key === 'ArrowDown' || key === 's') targetY++;
  else if (key === 'ArrowLeft' || key === 'a') targetX--;
  else if (key === 'ArrowRight' || key === 'd') targetX++;
  else return;

  // 範囲内か
  if (targetX >= 0 && targetX < gridSize && targetY >= 0 && targetY < gridSize) {
    // 意思決定モードに入る（AIの進行スキャン）
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

  authorizeBtn.disabled = false;
  denyBtn.disabled = false;
  challengeBtn.disabled = false;

  const targetCell = gridMap[ty][tx];
  
  // 現在地と移動先のノイズに応じてAIハルシネーション確率を計算
  const currentCell = gridMap[player.gridY][player.gridX];
  currentNoiseLevel = Math.max(currentCell.properties.noiseLevel, targetCell.properties.noiseLevel);
  aiMalfunctionRate = Math.min(100, Math.round(currentNoiseLevel * 1.2)); // 電波障害に比例

  // AIスキャン報告
  const scan = targetCell.scanReport(aiMalfunctionRate);
  addMessage('HAL-9000', `【進路スキャン報告】\n選択された進路座標: (${tx}, ${ty})\n分析プロファイル: 【${scan.reportedName}】\n「${scan.message}」\n前進を認可しますか？`, true);
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

  // 敵同盟・第三者勢力の視界外交戦および音紋アップデートの実行
  simulateFactionBattlesAndRipples();

  // マスごとのイベント
  const cell = gridMap[ty][tx];

  if (cell.type === 'HOSPITAL') {
    endGameWin("医療ステーションに到達し、家族の治療に成功しました！");
    return;
  }

  // もし移動先マスに勢力ユニットがいる場合、エンカウントモーダルを表示！
  if (cell.occupyingFaction) {
    addMessage('SYSTEM', `【接触警報】${cell.occupyingFaction.badge} ${cell.occupyingFaction.name} と接近・エンカウントしました！`, true);
    encounterModal.show(cell.occupyingFaction, cell);
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
  } else if (player.hp <= 0) {
    endGame("プレイヤーが力尽き死亡しました。");
  }

  resumeExploration();
}

// 敵遭遇イベント
function triggerCombatEvent() {
  if (player.ammo > 0) {
    // 撃退時の消費も1発にして弾薬の価値を向上
    player.ammo = Math.max(0, player.ammo - 1);
    player.familyPanic = Math.min(100, player.familyPanic + 15);
    addMessage('SYSTEM', "【警告】敵と接近遭遇！ 防御システムが実弾を1発消費し、最小限の射撃で敵を撃退しました。", true);
  } else {
    // 弾薬がない場合は家族と本人が被弾（致命的）
    player.hp = Math.max(0, player.hp - 35);
    player.familyHp = Math.max(0, player.familyHp - 30);
    player.familyPanic = Math.min(100, player.familyPanic + 45);
    addMessage('SYSTEM', "【緊急警告】敵ロボットに強襲されました！ 弾薬（AMMO）が空だったため、物理的な突撃を受け極めて深刻なダメージを負いました！", true);
  }
}

// 認可：AIの推薦ルートを進む
authorizeBtn.addEventListener("click", () => {
  if (gameMode !== 'DECISION') return;
  
  addMessage('USER', `了解した。座標: (${targetCellX}, ${targetCellY}) への前進を認可する。`);
  const tx = targetCellX;
  const ty = targetCellY;

  setTimeout(() => {
    executeMove(tx, ty);
  }, 800);
});

// 却下：ルート推薦を却下し、迂回する（移動をキャンセルして元の場所へ戻る）
denyBtn.addEventListener("click", () => {
  if (gameMode !== 'DECISION') return;

  addMessage('USER', `推薦を却下する。その座標への進入は回避し、別のルートを選択する。`);
  setTimeout(() => {
    resumeExploration();
  }, 600);
});

// 問い詰め：スキャンの再検証を要求
challengeBtn.addEventListener("click", () => {
  if (gameMode !== 'DECISION') return;

  addMessage('USER', "HAL、本当に安全なのか？ ノイズ干渉データを再計算しろ。");

  setTimeout(() => {
    const targetCell = gridMap[targetCellY][targetCellX];
    const isCorrupted = Math.random() < (aiMalfunctionRate / 100);

    if (!isCorrupted) {
      // 修正に成功
      addMessage('HAL-9000', `……訂正します。電磁ノイズ干渉を除去したところ、このマスの真の性質は 【${targetCell.properties.name}】 であると判明しました。`);
      // HUD用のシグナルノイズ表示も同期
    } else {
      // 嘘をつき続ける（ハルシネーション）
      const defenses = [
        "光学センサーにブレはありません。私の推論結果を速やかに実行することを推奨します。",
        "現在の電磁障害は無視できるレベルです。なぜ私のルート選定を疑うのですか？",
        "これ以上の検証指示はメモリリークを引き起こします。進路認可を要請します。"
      ];
      addMessage('HAL-9000', `【警告】${defenses[Math.floor(Math.random() * defenses.length)]}`, true);
    }
  }, 800);
});

function resumeExploration() {
  gameMode = 'EXPLORE';
  targetCellX = null;
  targetCellY = null;
  authorizeBtn.disabled = true;
  denyBtn.disabled = true;
  challengeBtn.disabled = true;
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
  scoreElement.textContent = score;
  
  hpVal.textContent = Math.round(player.hp);
  hpFill.style.width = `${player.hp}%`;
  
  ammoVal.textContent = player.ammo;
  ammoFill.style.width = `${(player.ammo / player.maxAmmo) * 100}%`;
  
  batteryVal.textContent = Math.round(player.battery);
  batteryFill.style.width = `${player.battery}%`;

  familyHpVal.textContent = Math.round(player.familyHp);
  familyHpFill.style.width = `${player.familyHp}%`;

  familyPanicVal.textContent = `${Math.round(player.familyPanic)}%`;
  familyPanicFill.style.width = `${player.familyPanic}%`;
  
  if (player.familyPanic >= 75) {
    familyPanicFill.className = "progress-bar-fill fill-red";
  } else if (player.familyPanic >= 40) {
    familyPanicFill.className = "progress-bar-fill fill-orange";
  } else {
    familyPanicFill.className = "progress-bar-fill fill-green";
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
  addMessage('HAL-9000', "システムオンライン。目的地はマップ右下(9,9)の『医療ステーション』です。隣接するマスをタップまたはクリックして移動先を選択してください。私の推薦分析と通信ノイズを信じるか、迂回するかはあなた次第です。");
  updateHUD();
  
  // マウス・タッチ移動のリスナー追加
  canvas.addEventListener("click", handleCanvasClick);
  canvas.addEventListener("touchstart", handleCanvasTouch, { passive: true });

  // 1秒周期でシグナル波形揺らぎの同期
  setInterval(() => {
    adjustSignalWave();
  }, 1000);
}

// キャンバスクリック検知
function handleCanvasClick(e) {
  if (gameMode !== 'EXPLORE' || gameOver) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  const targetX = Math.floor(clickX / cellSize);
  const targetY = Math.floor(clickY / cellSize);

  checkAndTriggerMove(targetX, targetY);
}

// タッチ操作検知
function handleCanvasTouch(e) {
  if (gameMode !== 'EXPLORE' || gameOver) return;
  if (e.touches.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const touch = e.touches[0];
  const touchX = (touch.clientX - rect.left) * scaleX;
  const touchY = (touch.clientY - rect.top) * scaleY;

  const targetX = Math.floor(touchX / cellSize);
  const targetY = Math.floor(touchY / cellSize);

  checkAndTriggerMove(targetX, targetY);
}

// 隣接マス判定と移動トリガー
function checkAndTriggerMove(targetX, targetY) {
  // 範囲外チェック
  if (targetX < 0 || targetX >= gridSize || targetY < 0 || targetY >= gridSize) return;

  // 現在地から1マス離れた上下左右（隣接マス）のみ移動可能
  const dx = Math.abs(targetX - player.gridX);
  const dy = Math.abs(targetY - player.gridY);

  if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
    startDecisionMode(targetX, targetY);
  } else {
    addMessage('SYSTEM', "そこには移動できません。前後左右の隣接するマスを選択してください。");
  }
}

// 描画ループ
function draw() {
  ctx.clearRect(0, 0, width, height);

  // グリッドマップの描画
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const isPlayerHere = (player.gridX === x && player.gridY === y);
      
      // プレイヤーの近辺範囲（周囲1マス内かどうか）
      const dx = Math.abs(x - player.gridX);
      const dy = Math.abs(y - player.gridY);
      const isNearPlayer = (dx <= 1 && dy <= 1);

      gridMap[y][x].draw(ctx, cellSize, isPlayerHere, isNearPlayer);
    }
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

init();
draw();
