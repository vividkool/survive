class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.color = "#39ff14"; // 人間のシグナル（ネオングリーン）
    this.speed = 4;
    
    // サバイバルステータス
    this.hp = 100;
    this.maxHp = 100;
    this.ammo = 10;
    this.maxAmmo = 20;
    this.battery = 100; // ライトバッテリー
    this.maxBattery = 100;
  }

  draw(ctx) {
    // ライトの照射範囲（視界）をシミュレートして描画する
    const gradient = ctx.createRadialGradient(this.x, this.y, 10, this.x, this.y, 120);
    gradient.addColorStop(0, 'rgba(255, 255, 240, 0.15)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 240, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, 120, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // プレイヤー本体
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.shadowBlur = 0; // シャドウ効果をリセット
  }

  move(direction, width, height) {
    let nextX = this.x;
    let nextY = this.y;

    switch (direction) {
      case "up":
        nextY -= this.speed;
        break;
      case "down":
        nextY += this.speed;
        break;
      case "left":
        nextX -= this.speed;
        break;
      case "right":
        nextX += this.speed;
        break;
    }

    // 境界チェック
    if (nextX >= this.radius && nextX <= width - this.radius) {
      this.x = nextX;
    }
    if (nextY >= this.radius && nextY <= height - this.radius) {
      this.y = nextY;
    }
    
    // 移動するとわずかにバッテリー消費
    if (this.battery > 0) {
      this.battery = Math.max(0, this.battery - 0.02);
    }
  }
}
