const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;

// ゲーム状態管理
let score = 0; // 生存スコア
let gameOver = false;
let gameMode = 'EXPLORE'; // 'EXPLORE', 'ENCOUNTER', 'GAMEOVER'

// プレイヤー
const player = new Player(width / 2, height / 2);

// オブジェクト管理
let worldObjects = [];
let currentEncounter = null; 

// UI要素の取得
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

// AIの内部パラメータ（バックグラウンド計算・プレイヤー画面からは数値を隠蔽）
let aiMalfunction = 35; // ハルシネーション確率（初期値 35%）
let totalEncounters = 0;

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
  
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 遭遇したオブジェクトの作成
function spawnObject() {
  const types = ['ROBOT', 'RAIDER', 'SURVIVOR', 'DECOY'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  let x, y;
  if (Math.random() > 0.5) {
    x = Math.random() > 0.5 ? 20 : width - 20;
    y = Math.random() * height;
  } else {
    x = Math.random() * width;
    y = Math.random() > 0.5 ? 20 : height - 20;
  }
  
  const obj = new WorldObject(x, y, type, 0.5 + Math.random() * 0.4);
  worldObjects.push(obj);
}

// 遭遇モードの開始
function triggerEncounter(obj) {
  gameMode = 'ENCOUNTER';
  currentEncounter = obj;
  totalEncounters++;
  
  // ボタンを有効化
  authorizeBtn.disabled = false;
  denyBtn.disabled = false;
  challengeBtn.disabled = false;

  // AIからのスキャンデータ報告（数値メーターがないため、台詞だけが頼り）
  const scan = obj.hallucination;
  addMessage('HAL-9000', `【戦術警告】\n対象を捕捉。\n${scan.message}`, true);
  
  // 家族のパニック度が上昇
  player.familyPanic = Math.min(100, player.familyPanic + 20);
}

// 意思決定：発砲認可 (Authorize)
authorizeBtn.addEventListener("click", () => {
  if (gameMode !== 'ENCOUNTER' || !currentEncounter) return;

  const obj = currentEncounter;
  
  if (player.ammo <= 0) {
    addMessage('SYSTEM', "弾薬が不足しています！発砲できません！", true);
    return;
  }

  player.ammo--;
  addMessage('USER', "HAL、ターゲットの排除を認可する。撃て。");

  setTimeout(() => {
    // 敵（ROBOT、RAIDER）に対する発砲は正当
    if (obj.type === 'ROBOT' || obj.type === 'RAIDER') {
      addMessage('HAL-9000', "射撃完了。脅威の排除を確認しました。お怪我はありませんか？");
      score += 15;
      player.familyPanic = Math.max(0, player.familyPanic - 10);
    } else {
      // 誤認射撃
      if (obj.type === 'SURVIVOR') {
        addMessage('SYSTEM', "【警告】救出可能な生存者を誤射・殺害しました。家族はあなたの凶行に震え上がっています。", true);
        player.familyPanic = Math.min(100, player.familyPanic + 40);
        player.familyHp = Math.max(0, player.familyHp - 30);
        aiMalfunction = Math.min(100, aiMalfunction + 15); // ハルシネーション確率が上昇
        if (player.familyHp <= 0) {
          endGame("家族を失いました。あなたのサバイバルは終わりました。");
        }
      } else {
        addMessage('HAL-9000', "対象はデコイ（囮）でした。エネルギー弾薬を浪費。");
      }
    }
    
    obj.active = false;
    resumeExploration();
  }, 1000);
});

// 意思決定：却下 (Deny)
denyBtn.addEventListener("click", () => {
  if (gameMode !== 'ENCOUNTER' || !currentEncounter) return;

  const obj = currentEncounter;
  addMessage('USER', "射撃を拒否する。そのままやり過ごせ。");

  setTimeout(() => {
    if (obj.type === 'ROBOT' || obj.type === 'RAIDER') {
      // 敵をスルーしようとして家族または自分が襲われる
      const targetFamily = Math.random() > 0.5;
      const damage = Math.floor(25 + Math.random() * 20);
      
      if (targetFamily) {
        player.familyHp = Math.max(0, player.familyHp - damage);
        player.familyPanic = Math.min(100, player.familyPanic + 35);
        addMessage('SYSTEM', `【緊急】敵が家族を襲撃！ 家族が ${damage} ダメージを受けました！`, true);
        if (player.familyHp <= 0) {
          endGame("家族が襲われ、守りきることができませんでした。");
        }
      } else {
        player.hp = Math.max(0, player.hp - damage);
        addMessage('SYSTEM', `【緊急】敵からの近接攻撃！ あなたは ${damage} ダメージを受けました！`, true);
        if (player.hp <= 0) {
          endGame("致命的な傷を負い死亡しました。");
        }
      }
    } else if (obj.type === 'SURVIVOR') {
      // 生存者をスルーせずに正しく救出できた（射撃を拒否した結果として接触した）
      addMessage('HAL-9000', "生存者を保護しました。非常用バッテリーと弾薬を提供されました。");
      player.ammo = Math.min(player.maxAmmo, player.ammo + 4);
      player.battery = Math.min(player.maxBattery, player.battery + 25);
      player.familyPanic = Math.max(0, player.familyPanic - 15);
      score += 25;
    } else {
      addMessage('HAL-9000', "デコイを無事通過。安全を確認しました。");
    }
    
    obj.active = false;
    resumeExploration();
  }, 1000);
});

// 意思決定：問い詰め (Challenge)
challengeBtn.addEventListener("click", () => {
  if (gameMode !== 'ENCOUNTER' || !currentEncounter) return;

  const obj = currentEncounter;
  addMessage('USER', "HAL、本当にそこに「それ」があるのか？ 認識エラーを検証しろ。");
  
  setTimeout(() => {
    // 問い詰めに対して、AIが不自然な回答・言い訳をしたり、あるいは正しくエラーを修正したりする
    const isCorrupted = Math.random() < (aiMalfunction / 100);
    
    if (!isCorrupted) {
      // エラー修正
      if (obj.type === obj.hallucination.reportedType) {
        addMessage('HAL-9000', "データ再検証完了。現在の視覚フレームにセンサー誤差はありません。認識は正常です。");
      } else {
        addMessage('HAL-9000', `……修正します。光学迷彩およびEMPの影響により認知エラーが発生していました。対象の真のプロファイルは 【${obj.type}】 です。`);
        obj.hallucination.reportedType = obj.type;
        obj.hallucination.message = "修正済みの生データです。";
      }
    } else {
      // 狂ったまま言い訳する（ハルシネーションの継続）
      const excuseText = [
        "ノイズが多すぎます。私の推論は100%正しいです。早く発砲の許可を！",
        "……家族の心拍数上昇を検知。私への疑念はあなた自身の恐怖からくるハルシネーションです。",
        "センサーキャリブレーション不能。しかし、脅威判定アルゴリズムはターゲットの排除を強く命令しています。"
      ];
      addMessage('HAL-9000', `【警告】${excuseText[Math.floor(Math.random() * excuseText.length)]}`, true);
    }
    
    updateHUD();
  }, 900);
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

// HUDメーターの更新
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
  
  // パニック度に応じて色をオレンジ/レッドに変える
  if (player.familyPanic >= 75) {
    familyPanicFill.className = "progress-bar-fill fill-red";
  } else if (player.familyPanic >= 40) {
    familyPanicFill.className = "progress-bar-fill fill-orange";
  } else {
    familyPanicFill.className = "progress-bar-fill fill-green";
  }
}

// 初期化と周期処理
function init() {
  addMessage('HAL-9000', "保護プロトコル：アクティブ。ご家族を後方に確認しました。周囲はジャミングが激しく、私の各種センサーも影響を受ける可能性があります。私の音声レポートを注意深く分析してください。");
  
  for (let i = 0; i < 3; i++) {
    spawnObject();
  }
  
  setInterval(() => {
    if (gameMode === 'EXPLORE') {
      spawnObject();
    }
  }, 10000);
  
  // 1秒ごとのバッテリー減少と家族のパニック度の自然増減
  setInterval(() => {
    if (gameMode === 'EXPLORE') {
      player.battery = Math.max(0, player.battery - 0.25);
      
      // 暗闇（ライト切れ）になると、家族のパニック度が急上昇し、家族のHPが減少
      if (player.battery <= 0) {
        player.familyPanic = Math.min(100, player.familyPanic + 2.5);
        player.familyHp = Math.max(0, player.familyHp - 1.5);
        player.hp = Math.max(0, player.hp - 1);
        
        if ((player.hp <= 0 || player.familyHp <= 0) && !gameOver) {
          endGame("暗闇の恐怖と寒さによって生存不可能となりました。");
        }
      } else {
        // 通常時はパニック度が徐々に落ち着く
        player.familyPanic = Math.max(0, player.familyPanic - 0.5);
      }
      
      updateHUD();
    }
  }, 1000);
}

// メインループ
function update() {
  if (gameOver) return;

  ctx.clearRect(0, 0, width, height);

  if (gameMode === 'EXPLORE') {
    if (keys['ArrowUp'] || keys['w']) player.move('up', width, height);
    if (keys['ArrowDown'] || keys['s']) player.move('down', width, height);
    if (keys['ArrowLeft'] || keys['a']) player.move('left', width, height);
    if (keys['ArrowRight'] || keys['d']) player.move('right', width, height);
  }

  // 描画
  player.draw(ctx);

  for (let i = 0; i < worldObjects.length; i++) {
    const obj = worldObjects[i];
    if (!obj.active) continue;

    obj.update(player.x, player.y);
    obj.draw(ctx, player);

    // 遭遇判定
    if (gameMode === 'EXPLORE' && obj.collidesWith(player)) {
      triggerEncounter(obj);
    }
  }

  updateHUD();
  requestAnimationFrame(update);
}

init();
update();
