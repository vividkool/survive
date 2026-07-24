class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.color = "#39ff14"; // プレイヤーのシグナル
    
    // 家族（後方に描画するための位置差分用履歴）
    this.history = [];
    this.familyCount = 2; // 妻と子供の2人
    
    // 人間は家族を連れているため移動速度が非常に遅い
    this.speed = 1.8; 
    
    // サバイバルステータス
    this.hp = 100;
    this.maxHp = 100;
    this.ammo = 6; // 最初はさらに少ない弾薬
    this.maxAmmo = 20;
    this.battery = 100;
    this.maxBattery = 100;
    
    // 家族のステータス
    this.familyHp = 100;
    this.familyPanic = 0; // 0〜100 (暗闇や敵接近で上昇。100に達するとパニックで立ち往生/HP減少)
  }

  draw(ctx) {
    // プレイヤーの位置履歴を記録（家族の追従用）
    this.history.push({ x: this.x, y: this.y });
    if (this.history.length > 60) {
      this.history.shift();
    }

    // 視野（ライト）の描画
    const gradient = ctx.createRadialGradient(this.x, this.y, 8, this.x, this.y, 110);
    gradient.addColorStop(0, 'rgba(255, 255, 230, 0.15)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 230, 0.04)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, 110, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 家族の描画（プレイヤーの少し後ろを追従）
    for (let i = 0; i < this.familyCount; i++) {
      const histIndex = Math.max(0, this.history.length - 1 - (i + 1) * 15);
      const pos = this.history[histIndex] || { x: this.x, y: this.y };
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#a3e635"; // 少し薄めの緑
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#a3e635";
      ctx.fill();
    }

    // プレイヤー本体
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  move(direction, width, height) {
    // 家族のパニック度が高すぎると、立ちすくんで移動速度が極端に落ちる
    const currentSpeed = this.familyPanic >= 80 ? this.speed * 0.4 : this.speed;

    let nextX = this.x;
    let nextY = this.y;

    switch (direction) {
      case "up":
        nextY -= currentSpeed;
        break;
      case "down":
        nextY += currentSpeed;
        break;
      case "left":
        nextX -= currentSpeed;
        break;
      case "right":
        nextX += currentSpeed;
        break;
    }

    // 境界チェック
    if (nextX >= this.radius && nextX <= width - this.radius) {
      this.x = nextX;
    }
    if (nextY >= this.radius && nextY <= height - this.radius) {
      this.y = nextY;
    }
    
    // ライト消費
    if (this.battery > 0) {
      this.battery = Math.max(0, this.battery - 0.03);
    }
  }
}
