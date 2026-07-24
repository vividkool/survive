const enemies = [];
const enemySpeed = 1;

class Enemy {
  constructor(x, y, size, color, speed) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = color;
    this.speed = speed;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );
  }

  update(playerX, playerY) {
    // プレイヤーの方向に敵を移動
    const angle = Math.atan2(playerY - this.y, playerX - this.x);

    this.x += Math.cos(angle) * this.speed;
    this.y += Math.sin(angle) * this.speed;
  }

  // プレイヤーとの衝突判定
  collidesWith(player) {
    const distance = Math.sqrt(
      Math.pow(this.x - player.x, 2) + Math.pow(this.y - player.y, 2)
    );
    return distance < this.size / 2 + player.radius;
  }
}

function createEnemy(x, y) {
  const enemy = new Enemy(x, y, 30, "red", enemySpeed);
  enemies.push(enemy);
}

function updateEnemies(playerX, playerY) {
  for (let enemy of enemies) {
    enemy.update(playerX, playerY);
  }
}

function drawEnemies(context) {
  for (let enemy of enemies) {
    enemy.draw(context);
  }
}

function spawnEnemy() {
  const x = Math.random() * canvas.width;
  const y = Math.random() * canvas.height;
  createEnemy(x, y);
}

export { enemies, updateEnemies, drawEnemies, spawnEnemy };
