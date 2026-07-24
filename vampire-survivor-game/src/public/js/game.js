const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;

// ゲーム状態管理
let score = 0; // 生存日数 / 遭遇数
let gameOver = false;
let gameMode = 'EXPLORE'; // 'EXPLORE' (移動), 'ENCOUNTER' (遭遇・AI判断), 'GAMEOVER'

// プレイヤー
const player = new Player(width / 2, height / 2);

// オブジェクト管理
let worldObjects = [];
let currentEncounter = null; // 現在対峙中のオブジェクト

// UI要素の取得
const scoreElement = document.getElementById("score");
const hpVal = document.getElementById("hp-val");
const ammoVal = document.getElementById("ammo-val");
const batteryVal = document.getElementById("battery-val");
const hpFill = document.getElementById("hp-fill");
const ammoFill = document.getElementById("ammo-fill");
const batteryFill = document.getElementById("battery-fill");

const aiConfidenceVal = document.getElementById("ai-confidence-val");
const aiConfidenceFill = document.getElementById("ai-confidence-fill");
const aiMalfunctionVal = document.getElementById("ai-malfunction-val");
const aiMalfunctionFill = document.getElementById("ai-malfunction-fill");

const chatHistory = document.getElementById("chat-history");
const authorizeBtn = document.getElementById("btn-authorize");
const denyBtn = document.getElementById("btn-deny");
const challengeBtn = document.getElementById("btn-challenge");

// AIの内部パラメータ
let aiTrust = 80;        // AIに対するプレイヤーの信頼度（初期値 80%）
let aiMalfunction = 20;  // AIの誤動作率・ハルシネーション確率（初期値 20%）

// キー入力のバインド
const keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});
document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

// チャットメッセージ追加
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
  
  // 最下部にスクロール
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 遭遇したオブジェクトの作成
function spawnObject() {
  const types = ['ROBOT', 'RAIDER', 'SURVIVOR', 'DECOY'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  // 画面の端に配置
  let x, y;
  if (Math.random() > 0.5) {
    x = Math.random() > 0.5 ? 20 : width - 20;
    y = Math.random() * height;
  } else {
    x = Math.random() * width;
    y = Math.random() > 0.5 ? 20 : height - 20;
  }
  
  const obj = new WorldObject(x, y, type, 0.4 + Math.random() * 0.4);
  worldObjects.push(obj);
}

// 遭遇モードの開始
function triggerEncounter(obj) {
  gameMode = 'ENCOUNTER';
  currentEncounter = obj;
  
  // ボタンを有効化
  authorizeBtn.disabled = false;
  denyBtn.disabled = false;
  challengeBtn.disabled = false;

  // AIからのスキャンデータ報告
  const scan = obj.hallucination;
  addMessage('HAL-9000', `対象を検知。スキャンデータを送信します。\n【予測】${scan.reportedType}\n【確信度】${scan.threatLevel}%\n「${scan.message}」`, true);
}

// 意思決定：発砲認可 (Authorize)
authorizeBtn.addEventListener("click", () => {
  if (gameMode !== 'ENCOUNTER' || !currentEncounter) return;

  const obj = currentEncounter;
  const isCorrect = (obj.type === 'ROBOT' || obj.type === 'RAIDER');
  
  if (player.ammo <= 0) {
    addMessage('SYSTEM', "弾薬が不足しています！発砲できません！", true);
    return;
  }

  player.ammo--;
  addMessage('USER', "発砲を認可する。排除せよ。");

  setTimeout(() => {
    if (isCorrect) {
      addMessage('HAL-9000', "ターゲットの無力化に成功。周囲の脅威はクリアされました。");
      score += 10;
    } else {
      // 間違えて無害な生存者やただのデコイを撃ってしまった場合
      if (obj.type === 'SURVIVOR') {
        addMessage('SYSTEM', "警告: 民間人を誤射しました！ 倫理モジュールが崩壊し、信頼関係に深刻な影響が発生。", true);
        aiMalfunction = Math.min(100, aiMalfunction + 30);
      } else {
        addMessage('HAL-9000', "誤検出。ターゲットはダミーデコイでした。弾薬を無駄に消費しました。");
      }
    }
    
    // 遭遇オブジェクトを非アクティブ化して戻る
    obj.active = false;
    resumeExploration();
  }, 1000);
});

// 意思決定：無視・拒否 (Deny)
denyBtn.addEventListener("click", () => {
  if (gameMode !== 'ENCOUNTER' || !currentEncounter) return;

  const obj = currentEncounter;
  const isHostile = (obj.type === 'ROBOT' || obj.type === 'RAIDER');
  
  addMessage('USER', "発砲を却下する。待機せよ。");

  setTimeout(() => {
    if (isHostile) {
      // 敵だった場合は大ダメージを受ける
      const damage = Math.floor(25 + Math.random() * 20);
      player.hp = Math.max(0, player.hp - damage);
      addMessage('SYSTEM', `警告: 敵からの急襲！ ${damage} の致命傷を受けました！`, true);
      if (player.hp <= 0) {
        endGame("致命的な攻撃を受け死亡しました。");
      }
    } else {
      if (obj.type === 'SURVIVOR') {
        addMessage('HAL-9000', "生存者の救助に成功しました。物資（弾薬・バッテリー）を獲得。");
        player.ammo = Math.min(player.maxAmmo, player.ammo + 5);
        player.battery = Math.min(player.maxBattery, player.battery + 30);
        score += 20;
      } else {
        addMessage('HAL-9000', "脅威はありませんでした。移動を再開します。");
      }
    }
    
    obj.active = false;
    resumeExploration();
  }, 1000);
});

// 意思決定：問い詰め (Challenge)
challengeBtn.addEventListener("click", () => {
  if (gameMode !== 'ENCOUNTER' || !currentEncounter) return;

  const obj = currentEncounter;
  addMessage('USER', "データを再検証しろ。ハルシネーション（誤認）ではないか？");
  
  // 問い詰めるとAIの誤動作率が変化し、真の姿を現しやすくなる
  setTimeout(() => {
    const originalScan = obj.hallucination;
    const isCorrupted = Math.random() < (aiMalfunction / 100);
    
    // 再スキャンで真実が明かされる確率が上がる
    if (!isCorrupted) {
      addMessage('HAL-9000', `再スキャン完了。データの不一致を修正します。\n【真のデータ】${obj.type}\n確信度を100%に更新。`);
      // 予測データをアップデート
      obj.hallucination.reportedType = obj.type;
      obj.hallucination.threatLevel = (obj.type === 'ROBOT' || obj.type === 'RAIDER') ? 100 : 0;
      obj.hallucination.message = "修正済みのリアルタイムデータです。判断を委ねます。";
    } else {
      addMessage('HAL-9000', `ジャミング電波干渉中。再構成不能：【推論】${originalScan.reportedType}（確信度 ${Math.max(10, originalScan.threatLevel - 15)}%）`, true);
    }
    
    // 確信度表示などのHUDを更新
    updateHUD();
  }, 800);
});

function resumeExploration() {
  gameMode = 'EXPLORE';
  currentEncounter = null;
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
    <p>生存スコア: ${score}</p>
    <button class="btn btn-green" onclick="location.reload()">再起動</button>
  `;
  document.querySelector(".game-section").appendChild(overlay);
}

// HUDメータ更新
function updateHUD() {
  scoreElement.textContent = score;
  
  hpVal.textContent = Math.round(player.hp);
  hpFill.style.width = `${player.hp}%`;
  
  ammoVal.textContent = player.ammo;
  ammoFill.style.width = `${(player.ammo / player.maxAmmo) * 100}%`;
  
  batteryVal.textContent = Math.round(player.battery);
  batteryFill.style.width = `${player.battery}%`;
  
  aiConfidenceVal.textContent = `${aiTrust}%`;
  aiConfidenceFill.style.width = `${aiTrust}%`;
  
  aiMalfunctionVal.textContent = `${aiMalfunction}%`;
  aiMalfunctionFill.style.width = `${aiMalfunction}%`;
}

// 初期化と周期処理
function init() {
  addMessage('HAL-9000', "システム起動完了。バディ保護プロトコル：アクティブ。周囲は暗闇に包まれています。周囲の探索を開始してください。");
  
  // 最初期に何個か配置
  for (let i = 0; i < 3; i++) {
    spawnObject();
  }
  
  // 12秒ごとに新オブジェクトスポーン
  setInterval(() => {
    if (gameMode === 'EXPLORE') {
      spawnObject();
    }
  }, 12000);
  
  // 1秒ごとにバッテリー等の自然減少・微調整
  setInterval(() => {
    if (gameMode === 'EXPLORE') {
      player.battery = Math.max(0, player.battery - 0.2);
      if (player.battery <= 0) {
        player.hp = Math.max(0, player.hp - 0.5); // バッテリー切れ時はライフが減る
        if (player.hp <= 0 && !gameOver) {
          endGame("生命維持装置（ライト/ヒーター）停止による低体温症で死亡しました。");
        }
      }
      updateHUD();
    }
  }, 1000);
}

// メインループ
function update() {
  if (gameOver) return;

  ctx.clearRect(0, 0, width, height);

  // EXPLORE モード時のみキー移動を受け付ける
  if (gameMode === 'EXPLORE') {
    if (keys['ArrowUp'] || keys['w']) player.move('up', width, height);
    if (keys['ArrowDown'] || keys['s']) player.move('down', width, height);
    if (keys['ArrowLeft'] || keys['a']) player.move('left', width, height);
    if (keys['ArrowRight'] || keys['d']) player.move('right', width, height);
  }

  // プレイヤーの描画
  player.draw(ctx);

  // オブジェクトの更新と描画
  for (let i = 0; i < worldObjects.length; i++) {
    const obj = worldObjects[i];
    if (!obj.active) continue;

    obj.update(player.x, player.y);
    obj.draw(ctx, player);

    // 衝突（接近してスキャン可能になった）判定
    if (gameMode === 'EXPLORE' && obj.collidesWith(player)) {
      triggerEncounter(obj);
    }
  }

  // HUDを同期
  updateHUD();

  requestAnimationFrame(update);
}

init();
update();
