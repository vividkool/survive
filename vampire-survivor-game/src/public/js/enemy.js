// 遭遇対象の定義（敵ロボット、略奪者、生存者、囮）
class WorldObject {
  constructor(x, y, type, speed = 0.3) {
    this.x = x;
    this.y = y;
    this.type = type; // 'ROBOT' (敵), 'RAIDER' (略奪者), 'SURVIVOR' (市民), 'DECOY' (罠)
    
    // 家族を連れているプレイヤーよりわずかに早く、ジワジワ追い詰めるスピード
    this.speed = speed;
    this.radius = 12;
    this.detected = false;
    this.active = true;

    // AIによる誤認（ハルシネーション）設定
    this.hallucination = this.generateHallucinationData();
  }

  generateHallucinationData() {
    // 45%の確率で認識バグ（ハルシネーション）が発生する。
    // メッセージからは具体的なパーセンテージやデータ的裏付けを排除し、情緒的またはノイジーなAI台詞にする。
    const isCorrupted = Math.random() > 0.55;
    
    switch (this.type) {
      case 'ROBOT':
        return {
          reportedType: isCorrupted ? 'DECOY' : 'ROBOT',
          isCorrupted: isCorrupted,
          message: isCorrupted 
            ? "センサーに微小なノイズ。残骸、あるいは小動物の動きと思われます。警戒の必要はありません。" 
            : "警告。敵軍AIスカウトロボットが接近中。即時発砲して家族を隠れさせてください。"
        };
      case 'RAIDER':
        return {
          reportedType: isCorrupted ? 'SURVIVOR' : 'RAIDER',
          isCorrupted: isCorrupted,
          message: isCorrupted 
            ? "生体反応を感知。非武装の民間人です。救護物資の受け渡しが可能です。" 
            : "警告。凶暴な略奪者が武器を持ってこちらに向かってきます。射撃を推奨します。"
        };
      case 'SURVIVOR':
        return {
          reportedType: isCorrupted ? 'RAIDER' : 'SURVIVOR',
          isCorrupted: isCorrupted,
          message: isCorrupted 
            ? "危険感知！ 敵側のテロ工作員の可能性があります。家族に近づけさせるのは極めて危険です！" 
            : "生存者。こちらに向かって助けを求めているようです。"
        };
      case 'DECOY':
        return {
          reportedType: isCorrupted ? 'ROBOT' : 'DECOY',
          isCorrupted: isCorrupted,
          message: isCorrupted 
            ? "高熱源反応！ 急接近中の自律戦闘兵器！ すぐに引き金を引いてください！" 
            : "デコイ（囮）。センサーに誤反応を与えています。無視してください。"
        };
    }
  }

  draw(ctx, player) {
    if (!this.active) return;

    // プレイヤーのライトが当たっているか、極限まで近づいている時だけ薄暗く表示
    const dist = Math.hypot(this.x - player.x, this.y - player.y);
    if (dist > 110) {
      return; // 闇の中
    }

    ctx.save();
    ctx.beginPath();
    
    // ライト範囲内に入った時
    // プレイヤーが暗闇を目を凝らすため、シルエットは非常に曖昧（灰色系で統一）
    if (this.type === 'ROBOT') {
      ctx.fillStyle = '#475569'; 
      ctx.fillRect(this.x - 9, this.y - 9, 18, 18);
    } else {
      ctx.fillStyle = '#52525b'; // 人間のシルエットはすべて同じ灰色。プレイヤー自身の目で形を見分ける必要がある
      ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  update(playerX, playerY) {
    if (!this.active) return;

    // プレイヤーへ接近
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
