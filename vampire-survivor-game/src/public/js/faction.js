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
