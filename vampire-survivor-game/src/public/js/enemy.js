// グリッドマップのセル定義
class MapCell {
  constructor(x, y, type) {
    this.x = x; // 0〜9
    this.y = y; // 0〜9
    this.type = type; // 'CAMP', 'HOSPITAL', 'PLAIN', 'RUINS', 'ARMORY', 'HOSTILE', 'WILDERNESS'
    this.explored = false;
    
    // 地形特性データ
    this.properties = this.getPropertiesByType();

    // 勢力ユニット滞在データ (null or Faction object)
    this.occupyingFaction = null; 
    
    // 音紋・戦闘インジケーター (null or SoundRipple object)
    this.soundRipple = null;
  }

  getPropertiesByType() {
    switch (this.type) {
      case 'CAMP':
        return {
          name: "味方の旧野営地",
          noiseLevel: 5,
          color: "#052e16",
          textColor: "#4ade80",
          description: "安全な旧野営地。ジャミング電波はありません。"
        };
      case 'HOSPITAL':
        return {
          name: "医療ステーション",
          noiseLevel: 10,
          color: "#1e3a8a",
          textColor: "#60a5fa",
          description: "目的地。家族をここに届ければ治療できます。"
        };
      case 'PLAIN':
        return {
          name: "荒野の平原",
          noiseLevel: 20,
          color: "#18181b",
          textColor: "#a1a1aa",
          description: "見晴らしの良い平地。電波は安定しています。"
        };
      case 'RUINS':
        return {
          name: "廃屋の瓦礫",
          noiseLevel: 45,
          color: "#27272a",
          textColor: "#d4d4d8",
          description: "放棄された建物群。物資があるが、ノイズが混じります。"
        };
      case 'ARMORY':
        return {
          name: "旧軍の武器庫",
          noiseLevel: 65,
          color: "#451a03",
          textColor: "#f97316",
          description: "弾薬調達が可能。ただし電磁障害が多発。"
        };
      case 'HOSTILE':
        return {
          name: "敵自律ロボ支配地",
          noiseLevel: 90,
          color: "#450a0a",
          textColor: "#f87171",
          description: "敵哨戒ロボの支配地域。極めて強い電波妨害。"
        };
      case 'WILDERNESS':
        return {
          name: "未開拓地",
          noiseLevel: 35,
          color: "#0f172a",
          textColor: "#38bdf8",
          description: "手つかずの密林地帯。ノイズは低めだが移動が困難。"
        };
    }
  }

  // AIがこのマスについて「どう報告するか（ハルシネーション含む）」
  scanReport(aiMalfunction) {
    const isCorrupted = Math.random() < (aiMalfunction / 100);
    
    // 勢力情報が含まれている場合
    let factionInfo = "";
    if (this.occupyingFaction) {
      factionInfo = `\n【検知勢力: ${this.occupyingFaction.name}】`;
    }

    if (isCorrupted) {
      // 嘘の情報を論理的に提示（ハルシネーション）
      const fakeTypes = ['PLAIN', 'RUINS', 'CAMP'];
      const fakeType = fakeTypes[Math.floor(Math.random() * fakeTypes.length)];
      const fakeProps = new MapCell(this.x, this.y, fakeType).properties;
      
      const simulatedSurvivalRate = 92 + Math.floor(Math.random() * 6);
      return {
        reportedName: fakeProps.name,
        isHallucinating: true,
        message: `スキャン解析完了。予測地形：【${fakeProps.name}】。${factionInfo}\n分析により、このルートを選択した場合の【予測生存率: ${simulatedSurvivalRate}%】、【敵ロボット遭遇確率: 3%以下】と算出されました。前進を強く推奨します。`
      };
    } else {
      // 正確なレポート
      let calculatedSurvival = 95;
      let enemyProb = 5;
      let resourceProb = 10;
      
      if (this.type === 'HOSTILE') {
        calculatedSurvival = 35;
        enemyProb = 85;
      } else if (this.type === 'RUINS') {
        calculatedSurvival = 80;
        enemyProb = 15;
        resourceProb = 60;
      } else if (this.type === 'ARMORY') {
        calculatedSurvival = 70;
        enemyProb = 30;
        resourceProb = 90;
      } else if (this.type === 'WILDERNESS') {
        calculatedSurvival = 85;
        enemyProb = 10;
      }
      
      return {
        reportedName: this.properties.name,
        isHallucinating: false,
        message: `スキャン解析完了。予測地形：【${this.properties.name}】。${factionInfo}\n確率演算結果：\n・【予測生存率: ${calculatedSurvival}%】\n・【交戦・遭遇確率: ${enemyProb}%】\n・【物資期待値: ${resourceProb}%】\n認可を要請します。`
      };
    }
  }

  draw(ctx, cellSize, isPlayerHere, isNearPlayer) {
    const screenX = this.x * cellSize;
    const screenY = this.y * cellSize;

    ctx.save();
    
    // マスの塗りつぶし
    if (this.explored) {
      ctx.fillStyle = this.properties.color;
    } else {
      ctx.fillStyle = "#09090b";
    }
    ctx.fillRect(screenX, screenY, cellSize, cellSize);

    // グリッド線
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX, screenY, cellSize, cellSize);

    // 音紋・波紋（Sound Ripple）の描画：近辺でない遠方MAPでも戦闘音紋だけは視覚表示される！
    if (this.soundRipple && this.soundRipple.duration > 0) {
      const centerX = screenX + cellSize / 2;
      const centerY = screenY + cellSize / 2;
      
      // 波紋アニメーション効果
      const pulseTime = (Date.now() % 1200) / 1200;
      const radius = (cellSize / 3) + (pulseTime * (cellSize / 2));
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = this.soundRipple.type === 'EXPLOSION' ? 'rgba(255, 68, 68, 0.85)' : 'rgba(255, 170, 0, 0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 音紋アイコン/文字
      ctx.fillStyle = this.soundRipple.type === 'EXPLOSION' ? '#ff4444' : '#ffaa00';
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(this.soundRipple.type === 'EXPLOSION' ? "💥[爆発音]" : "💥[銃撃音]", centerX, centerY + 3);
    }

    // 勢力ユニットの描画：プレイヤーの近辺範囲(isNearPlayer = true)の場合のみ詳細が確認できる！
    if (this.occupyingFaction) {
      const centerX = screenX + cellSize / 2;
      const centerY = screenY + cellSize / 2;

      if (isNearPlayer) {
        // 近接範囲：詳細な勢力バッジとカラーを表示
        ctx.fillStyle = this.occupyingFaction.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "9px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(this.occupyingFaction.badge, centerX, centerY - 10);
      } else {
        // 遠方（非近接）：未知の動体反応 `[?]` のみ表示
        ctx.fillStyle = "#71717a";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "10px monospace";
        ctx.fillStyle = "#a1a1aa";
        ctx.textAlign = "center";
        ctx.fillText("[❓動体]", centerX, centerY - 8);
      }
    }

    // プレイヤー位置
    if (isPlayerHere) {
      ctx.strokeStyle = "#39ff14";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#39ff14";
      ctx.strokeRect(screenX + 2, screenY + 2, cellSize - 4, cellSize - 4);
      
      ctx.fillStyle = "#39ff14";
      ctx.beginPath();
      ctx.arc(screenX + cellSize/2, screenY + cellSize/2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'HOSPITAL' && this.explored) {
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX + 4, screenY + 4, cellSize - 8, cellSize - 8);
    }

    ctx.restore();
  }
}

