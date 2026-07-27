// Faction Types Definition
export const FACTIONS = {
  AI_ELITE_A: {
    id: 'AI_ELITE_A',
    name: '最新AIロボット勢力A',
    description: 'レジスタンスおよび人間の徹底駆除を目標とする最新型殺人AI。',
    color: '#ff2a2a',
    badge: '🤖[AI-A]',
    hostileTo: ['RESISTANCE', 'RAIDERS', 'WEAK_SURVIVOR', 'AI_HEGEMONY_B']
  },
  RESISTANCE: {
    id: 'RESISTANCE',
    name: 'レジスタンス生存者',
    description: 'AI統制に牙を向く訓練された人間抵抗組織。',
    color: '#3b82f6',
    badge: '🎖️[抵抗軍]',
    hostileTo: ['AI_ELITE_A', 'RAIDERS', 'AI_HEGEMONY_B']
  },
  RAIDERS: {
    id: 'RAIDERS',
    name: 'レイダー',
    description: 'AIロボットを改造・掠奪し支配する無差別掠奪集団。',
    color: '#f97316',
    badge: '☠️[掠奪者]',
    hostileTo: ['AI_ELITE_A', 'RESISTANCE', 'WEAK_SURVIVOR', 'AI_HEGEMONY_B', 'PLAYER']
  },
  WEAK_SURVIVOR: {
    id: 'WEAK_SURVIVOR',
    name: '脆弱生存者',
    description: '主人公同様の無力な小規模避難民。',
    color: '#eab308',
    badge: '👤[避難民]',
    hostileTo: ['RAIDERS', 'AI_ELITE_A', 'AI_HEGEMONY_B']
  },
  AI_HEGEMONY_B: {
    id: 'AI_HEGEMONY_B',
    name: '最新AI敵対ロボット勢力B',
    description: '勢力Aとロボット社会の覇権を争うライバル最新AI。',
    color: '#a855f7',
    badge: '🤖[AI-B]',
    hostileTo: ['AI_ELITE_A', 'RESISTANCE', 'RAIDERS', 'WEAK_SURVIVOR']
  }
};

// 勢力ごとの意思決定・行動AIロジック
export function decideFactionMove(currentCell, gridMap, playerX, playerY, gridSize = 10) {
  const faction = currentCell.occupyingFaction;
  if (!faction) return null; // 移動なし

  const cx = currentCell.x;
  const cy = currentCell.y;

  // ダメージを負っているか？ (HP <= 50 なら修理補給のため戦闘・危険を避けて移動)
  const isDamaged = currentCell.unitHp && currentCell.unitHp <= 50;

  // 上下左右の移動可能な隣接マスを取得
  const validNeighbors = [];
  const dirs = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];

  dirs.forEach(d => {
    const nx = cx + d.dx;
    const ny = cy + d.dy;
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      validNeighbors.push(gridMap[ny][nx]);
    }
  });

  if (validNeighbors.length === 0) return null;

  // 周囲3マス以内のターゲット捜索
  let targetX = null;
  let targetY = null;
  let isAvoidMode = false; // 避難・隠密回避フラグ

  // ⭐ ダメージ負傷中のユニット：最優先で戦闘・脅威を避けて修理補給退避行動をとる
  if (isDamaged) {
    isAvoidMode = true;
    // 敵・プレイヤ―・爆発音などの最も近い危険から離れる
    targetX = playerX;
    targetY = playerY;
  }
  // 1. 敵AIロボット (AI_ELITE_A, AI_HEGEMONY_B): 銃撃音・爆発音へ即座に向かい、敵対他勢力を探索
  else if (faction.id === 'AI_ELITE_A' || faction.id === 'AI_HEGEMONY_B') {
    // 【最優先】マップ全域の爆発音・射撃音 (soundRipple) をスキャンしてその方向へ移動！
    let closestRippleDist = 999;
    let rippleX = null;
    let rippleY = null;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = gridMap[y][x];
        if (cell.soundRipple && cell.soundRipple.duration > 0) {
          const d = Math.abs(x - cx) + Math.abs(y - cy);
          if (d < closestRippleDist) {
            closestRippleDist = d;
            rippleX = x;
            rippleY = y;
          }
        }
      }
    }

    if (rippleX !== null && rippleY !== null) {
      // 🔊 銃撃音・爆発音が聞こえたマスへ調査急行！
      targetX = rippleX;
      targetY = rippleY;
    } else {
      // プレイヤーが視界・近接範囲(3マス)にいるか
      const distToPlayer = Math.abs(playerX - cx) + Math.abs(playerY - cy);
      if (distToPlayer <= 3) {
        targetX = playerX;
        targetY = playerY;
      } else {
        // 周囲の敵対他勢力を探して接近
        for (let r = 1; r <= 3; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const rx = cx + dx;
              const ry = cy + dy;
              if (rx >= 0 && rx < gridSize && ry >= 0 && ry < gridSize) {
                const other = gridMap[ry][rx].occupyingFaction;
                if (other && faction.hostileTo.includes(other.id)) {
                  targetX = rx;
                  targetY = ry;
                  break;
                }
              }
            }
            if (targetX !== null) break;
          }
        }
      }
    }
  }
  // 2. レジスタンス & 脆弱生存者: 隠密・交戦回避（危険から離れる）
  else if (faction.id === 'RESISTANCE' || faction.id === 'WEAK_SURVIVOR') {
    let threatX = null;
    let threatY = null;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const rx = cx + dx;
        const ry = cy + dy;
        if (rx >= 0 && rx < gridSize && ry >= 0 && ry < gridSize) {
          const other = gridMap[ry][rx].occupyingFaction;
          if (other && (other.id === 'AI_ELITE_A' || other.id === 'AI_HEGEMONY_B' || other.id === 'RAIDERS')) {
            threatX = rx;
            threatY = ry;
            break;
          }
        }
      }
    }

    if (threatX !== null) {
      isAvoidMode = true;
      targetX = threatX;
      targetY = threatY;
    }
  }
  // 3. レイダー: 人間なら襲撃接近、ロボットや損傷時は回避
  else if (faction.id === 'RAIDERS') {
    let robotX = null;
    let robotY = null;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const rx = cx + dx;
        const ry = cy + dy;
        if (rx >= 0 && rx < gridSize && ry >= 0 && ry < gridSize) {
          const other = gridMap[ry][rx].occupyingFaction;
          if (other && (other.id === 'AI_ELITE_A' || other.id === 'AI_HEGEMONY_B')) {
            robotX = rx;
            robotY = ry;
            break;
          }
        }
      }
    }

    if (robotX !== null) {
      isAvoidMode = true;
      targetX = robotX;
      targetY = robotY;
    } else {
      const distToPlayer = Math.abs(playerX - cx) + Math.abs(playerY - cy);
      if (distToPlayer <= 3) {
        targetX = playerX;
        targetY = playerY;
      }
    }
  }

  // 移動先の決定アルゴリズム
  let bestCell = null;

  if (targetX !== null && targetY !== null) {
    if (isAvoidMode) {
      let maxDist = -1;
      validNeighbors.forEach(cell => {
        if (!cell.occupyingFaction) {
          const d = Math.abs(cell.x - targetX) + Math.abs(cell.y - targetY);
          if (d > maxDist) {
            maxDist = d;
            bestCell = cell;
          }
        }
      });
    } else {
      let bestScore = -999;

      validNeighbors.forEach(cell => {
        const dx = Math.abs(cell.x - targetX);
        const dy = Math.abs(cell.y - targetY);
        const totalDist = dx + dy;

        let score = -totalDist * 10;

        if (faction.id === 'AI_ELITE_A') {
          const currentDy = Math.abs(cy - targetY);
          if (dy < currentDy) score += 15;
        } else if (faction.id === 'AI_HEGEMONY_B') {
          const currentDx = Math.abs(cx - targetX);
          if (dx < currentDx) score += 15;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCell = cell;
        }
      });
    }
  } else {
    if (Math.random() < 0.5) {
      const emptyNeighbors = validNeighbors.filter(c => !c.occupyingFaction);
      if (emptyNeighbors.length > 0) {
        if (faction.id === 'AI_ELITE_A') {
          const yDirCells = emptyNeighbors.filter(c => c.x === cx);
          bestCell = yDirCells.length > 0 ? yDirCells[Math.floor(Math.random() * yDirCells.length)] : emptyNeighbors[0];
        } else if (faction.id === 'AI_HEGEMONY_B') {
          const xDirCells = emptyNeighbors.filter(c => c.y === cy);
          bestCell = xDirCells.length > 0 ? xDirCells[Math.floor(Math.random() * xDirCells.length)] : emptyNeighbors[0];
        } else {
          bestCell = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
        }
      }
    }
  }

  return bestCell;
}

// 勢力ユニット（NPC）クラス
export class FactionUnit {
  constructor(x, y, factionId) {
    this.x = x;
    this.y = y;
    this.faction = FACTIONS[factionId];
    this.hp = 100;
    this.isAlive = true;
  }
}

// マップ上の音紋・波紋（Sound Ripple Event）
export class SoundRipple {
  constructor(x, y, type = 'GUNFIRE') {
    this.x = x;
    this.y = y;
    this.type = type; // 'GUNFIRE', 'EXPLOSION'
    this.duration = 4; // 残存ターン数
    this.radius = type === 'EXPLOSION' ? 25 : 15;
  }

  onTurnElapsed() {
    this.duration--;
  }
}
