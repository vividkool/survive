// ゲームの設定とグローバル変数
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;

// スコア表示
let score = 0;
const scoreElement = document.getElementById("score");

// プレイヤーの作成（画面中央に配置）
const player = new Player(width / 2, height / 2, 15, "blue");

// 敵の配列
let enemies = [];
const enemySize = 20;

// 新しい敵を作成する関数
function createEnemy() {
  // 画面外からランダムな位置に敵を配置
  let x, y;
  const side = Math.floor(Math.random() * 4); // 0:上 1:右 2:下 3:左

  switch (side) {
    case 0: // 上
      x = Math.random() * width;
      y = -enemySize;
      break;
    case 1: // 右
      x = width + enemySize;
      y = Math.random() * height;
      break;
    case 2: // 下
      x = Math.random() * width;
      y = height + enemySize;
      break;
    case 3: // 左
      x = -enemySize;
      y = Math.random() * height;
      break;
  }

  // 敵のスピードをランダムに設定（0.5〜1.5）
  const speed = 0.5 + Math.random();

  // ランダムな色を生成
  const colors = ["#FF0000", "#FF6600", "#FF9900", "#FFCC00", "#FF33CC"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  // 敵を作成して配列に追加
  enemies.push(new Enemy(x, y, enemySize, color, speed));
}

// キー入力の処理
document.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowUp":
      player.move("up");
      break;
    case "ArrowDown":
      player.move("down");
      break;
    case "ArrowLeft":
      player.move("left");
      break;
    case "ArrowRight":
      player.move("right");
      break;
  }
});

// ゲームのメインループ
function update() {
  // キャンバスをクリア
  ctx.clearRect(0, 0, width, height);

  // プレイヤーを描画
  player.draw(ctx);

  // 敵の描画と更新
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    enemy.update(player.x, player.y);
    enemy.draw(ctx);

    // プレイヤーとの衝突判定
    if (enemy.collidesWith(player)) {
      // 衝突した敵を削除
      enemies.splice(i, 1);
      i--;

      // スコアを増やす
      score++;
      scoreElement.textContent = score;

      // 新しい敵を作成
      createEnemy();
    }
  }

  // アニメーションの更新
  requestAnimationFrame(update);
}

// 初期敵の生成（最初に5匹）
for (let i = 0; i < 5; i++) {
  createEnemy();
}

// 10秒ごとに新しい敵を追加
setInterval(createEnemy, 10000);

// ゲームスタート
update();
