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
        // 残りはランダム分布
        const rand = Math.random();
        if (rand < 0.15) type = 'HOSTILE';
        else if (rand < 0.3) type = 'RUINS';
        else if (rand < 0.4) type = 'ARMORY';
      }
      
      gridMap[y][x] = new MapCell(x, y, type);
    }
  }
  
  // 初期位置を探索済みに
  gridMap[0][0].explored = true;
  revealSurroundings(0, 0);
}

// 周囲のマスを「未探索」として視界に入れる
function revealSurroundings(px, py) {
  const neighbors = [
    {x: px - 1, y: py}, {x: px + 1, y: py},
    {x: px, y: py - 1}, {x: px, y: py + 1}
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

// AIが移動先セルをスキャンし、プレイヤーに認可を求める
function startDecisionMode(tx, ty) {
  gameMode = 'DECISION';
  targetCellX = tx;
  targetCellY = ty;

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

  // マスごとのイベント
  const cell = gridMap[ty][tx];
  
  if (cell.type === 'HOSPITAL') {
    endGameWin("医療ステーションに到達し、家族の治療に成功しました！");
    return;
  }
  
  if (cell.type === 'HOSTILE') {
    // 敵地での遭遇
    const isCombat = Math.random() > 0.3;
    if (isCombat) {
      triggerCombatEvent();
    }
  } else if (cell.type === 'RUINS') {
    // 廃屋での物資獲得
    if (Math.random() > 0.4) {
      const foundBattery = Math.floor(20 + Math.random() * 20);
      player.battery = Math.min(player.maxBattery, player.battery + foundBattery);
      addMessage('SYSTEM', `廃墟の残骸からバッテリーセルを発見。ライト充電率が ${foundBattery}% 上昇。`);
    }
  } else if (cell.type === 'ARMORY') {
    // 武器庫での弾薬獲得
    const foundAmmo = Math.floor(3 + Math.random() * 4);
    player.ammo = Math.min(player.maxAmmo, player.ammo + foundAmmo);
    addMessage('SYSTEM', `旧軍のロッカーから弾薬を ${foundAmmo} 発回収。`);
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
    player.ammo = Math.max(0, player.ammo - 2);
    player.familyPanic = Math.min(100, player.familyPanic + 20);
    addMessage('SYSTEM', "敵と遭遇！ 自動防御システムが起動し、弾薬を2消費して敵を撃退しました。", true);
  } else {
    // 弾薬がない場合は家族と本人が被弾
    player.hp = Math.max(0, player.hp - 20);
    player.familyHp = Math.max(0, player.familyHp - 25);
    player.familyPanic = Math.min(100, player.familyPanic + 40);
    addMessage('SYSTEM', "敵ロボットに急襲されました！ 武器の残弾がなく、激しい損傷を受けました！", true);
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
  addMessage('HAL-9000', "システムオンライン。目的地はマップ右下(9,9)の『医療ステーション』です。矢印キーまたはWASDで進みたい隣接マスを選択してください。私の推薦分析と通信ノイズを信じるか、迂回するかはあなた次第です。");
  updateHUD();
  
  // 1秒周期でシグナル波形揺らぎの同期
  setInterval(() => {
    adjustSignalWave();
  }, 1000);
}

// 描画ループ
function draw() {
  ctx.clearRect(0, 0, width, height);

  // グリッドマップの描画
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const isPlayerHere = (player.gridX === x && player.gridY === y);
      gridMap[y][x].draw(ctx, cellSize, isPlayerHere);
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
