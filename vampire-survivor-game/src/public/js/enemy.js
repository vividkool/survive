// グリッドマップのセル定義
class MapCell {
  constructor(x, y, type) {
    this.x = x; // 0〜9
    this.y = y; // 0〜9
    this.type = type; // 'CAMP' (野営地), 'HOSPITAL' (治療施設), 'PLAIN' (平原), 'RUINS' (廃屋), 'ARMORY' (武器庫), 'HOSTILE' (敵地)
    this.explored = false;
    
    // 地形特性データ
    this.properties = this.getPropertiesByType();
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
    
    if (isCorrupted) {
      // 嘘の情報を返す（ハルシネーション）
      // 本来は敵支配地なのに「平原」または「安全な場所」と誤認して誘い込む、など
      const fakeTypes = ['PLAIN', 'RUINS', 'CAMP'];
      const fakeType = fakeTypes[Math.floor(Math.random() * fakeTypes.length)];
      const fakeProps = new MapCell(this.x, this.y, fakeType).properties;
      
      return {
        reportedName: fakeProps.name,
        reportedDanger: "極めて安全",
        isHallucinating: true,
        message: "このルートの安全性は保証されます。危険は一切感知されません。前進してください。"
      };
    } else {
      // 正確なレポート
      let dangerLevel = "安全";
      if (this.properties.noiseLevel > 70) dangerLevel = "極めて危険（敵地）";
      else if (this.properties.noiseLevel > 50) dangerLevel = "警戒（ノイズ高）";
      else if (this.properties.noiseLevel > 30) dangerLevel = "注意";

      return {
        reportedName: this.properties.name,
        reportedDanger: dangerLevel,
        isHallucinating: false,
        message: `スキャン結果：${this.properties.name}（環境値：${dangerLevel}）。${this.properties.description}`
      };
    }
  }

  draw(ctx, cellSize, isPlayerHere) {
    const screenX = this.x * cellSize;
    const screenY = this.y * cellSize;

    ctx.save();
    
    // マスの塗りつぶし（探索済みの場合は地形の色、未探索は黒）
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

    // プレイヤーが現在いるマス
    if (isPlayerHere) {
      ctx.strokeStyle = "#39ff14";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#39ff14";
      ctx.strokeRect(screenX + 2, screenY + 2, cellSize - 4, cellSize - 4);
      
      // プレイヤー本体
      ctx.fillStyle = "#39ff14";
      ctx.beginPath();
      ctx.arc(screenX + cellSize/2, screenY + cellSize/2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'HOSPITAL' && this.explored) {
      // 治療施設のハイライト
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX + 4, screenY + 4, cellSize - 8, cellSize - 8);
    }

    ctx.restore();
  }
}
