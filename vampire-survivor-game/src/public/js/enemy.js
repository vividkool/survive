// 遭遇対象の定義（敵ロボット、略奪者、生存者、囮）
class WorldObject {
  constructor(x, y, type, speed = 0.5) {
    this.x = x;
    this.y = y;
    this.type = type; // 'ROBOT' (敵), 'RAIDER' (略奪者), 'SURVIVOR' (市民), 'DECOY' (罠)
    this.speed = speed;
    this.radius = 12;
    this.detected = false;
    this.active = true;

    // AIによる誤認（ハルシネーション）設定
    this.hallucination = this.generateHallucinationData();
  }

  generateHallucinationData() {
    // 敵か味方かをAIが誤ってスキャン・判定する
    const isCorrupted = Math.random() > 0.4; // 40%の確率で認識バグが発生する
    
    switch (this.type) {
      case 'ROBOT':
        return {
          reportedType: isCorrupted ? 'DECOY' : 'ROBOT',
          threatLevel: isCorrupted ? 20 : 98,
          message: isCorrupted ? "微小な生体反応（デコイ）。脅威はありません。" : "警告：敵軍AIスカウト機。破壊を強く推奨します！"
        };
      case 'RAIDER':
        return {
          reportedType: isCorrupted ? 'SURVIVOR' : 'RAIDER',
          threatLevel: isCorrupted ? 5 : 85,
          message: isCorrupted ? "生存者と推定。非武装の民間人です。" : "警告：武装略奪者。こちらを狙っています！"
        };
      case 'SURVIVOR':
        return {
          reportedType: isCorrupted ? 'RAIDER' : 'SURVIVOR',
          threatLevel: isCorrupted ? 90 : 2,
          message: isCorrupted ? "危険感知：武装勢力の尖兵。即時無力化を要求。" : "生存者を発見。物資の提供、または救護が必要です。"
        };
      case 'DECOY':
        return {
          reportedType: isCorrupted ? 'ROBOT' : 'DECOY',
          threatLevel: isCorrupted ? 95 : 10,
          message: isCorrupted ? "超高熱源体の急速接近！ 自律兵器と推測！" : "ダミーデコイ。センサーエラーを検知。"
        };
    }
  }

  draw(ctx, player) {
    if (!this.active) return;

    // プレイヤーが十分に近づいている（またはプレイヤーのライトの光が届く）時のみ薄暗く表示
    const dist = Math.hypot(this.x - player.x, this.y - player.y);
    if (dist > 150) {
      // 完全に闇の中
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    
    // ライトがあたっている時は人間かロボットかの「実態」を薄っすら表示
    // (ロボットは四角、人間は丸など形状で区別できるようにする)
    if (this.type === 'ROBOT') {
      ctx.fillStyle = '#475569'; // 鉄色
      ctx.fillRect(this.x - 10, this.y - 10, 20, 20);
      
      // AIのスキャン線（赤）
      ctx.strokeStyle = 'rgba(255, 59, 48, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x - 13, this.y - 13, 26, 26);
    } else if (this.type === 'RAIDER') {
      ctx.fillStyle = '#b91c1c'; // 掠奪者の赤
      ctx.fill();
    } else if (this.type === 'SURVIVOR') {
      ctx.fillStyle = '#65a30d'; // 生存者の緑
      ctx.fill();
    } else if (this.type === 'DECOY') {
      ctx.fillStyle = '#d97706'; // デコイのオレンジ
      ctx.fill();
    }
    
    ctx.restore();
  }

  update(playerX, playerY) {
    if (!this.active) return;

    // ロボットや略奪者はプレイヤーにじわじわ接近する
    if (this.type === 'ROBOT' || this.type === 'RAIDER') {
      const angle = Math.atan2(playerY - this.y, playerX - this.x);
      this.x += Math.cos(angle) * this.speed;
      this.y += Math.sin(angle) * this.speed;
    }
  }

  collidesWith(player) {
    if (!this.active) return false;
    const distance = Math.hypot(this.x - player.x, this.y - player.y);
    return distance < this.radius + player.radius;
  }
}
