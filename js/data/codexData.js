/**
 * Codex / Encyclopedia Data
 */

export const CODEX_CATEGORIES = [
  { id: 'clue', label: '단서', icon: '🔍' },
  { id: 'character', label: '인물', icon: '👤' },
  { id: 'magic', label: '마법', icon: '✨' },
  { id: 'incident', label: '사건', icon: '🗂️' }
];

export const CODEX_DATA = [
  // Clues (단서)
  {
    id: 'clue_muddy_footprints',
    category: 'clue',
    title: '수상한 진흙 발자국',
    icon: '👣',
    summary: '서고 창문 틀과 복도에서 발견된 붉은 진흙 자국.',
    description: '서고 창문 아래와 외곽 복도에 묻어 있던 축축한 붉은 흙탕물 흔적입니다. 아카데미 영지 내에서 이런 특유의 붉은 점토질 흙이 존재하는 곳은 서쪽 약초 온실과 비밀 안개 정원뿐입니다. 침입자가 외부 정원을 통해 침입했음을 시사합니다.',
    keywords: ['붉은 점토', '정원 흔적'],
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },
  {
    id: 'clue_torn_parchment',
    category: 'clue',
    title: '찢겨진 마법 양피지',
    icon: '📜',
    summary: '고대 마법 연단에서 발견된 불완전한 소환진 기록.',
    description: '도난당한 금서 [어스름의 서]에서 강제로 뜯겨 나간 것으로 추정되는 양피지 조각입니다. 희미한 푸른 인광이 글귀를 따라 맥동하고 있으며, 마력 공명 의식의 1단계 주석이 적혀 있습니다. 일정 수준 이상의 마력을 가진 자만 해독할 수 있습니다.',
    keywords: ['공명 의식', '마력 룬'],
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },
  {
    id: 'clue_ritual_journal',
    category: 'clue',
    title: '봉인된 의식의 일지',
    icon: '📓',
    summary: '서고 관리자 책상 깊은 서랍에 은밀히 숨겨져 있던 비망록.',
    description: '누군가의 필적으로 빽빽하게 적힌 일지입니다. "자정에 시계탑의 태엽이 멈출 때, 안개의 장막이 걷히고 봉인이 가장 옅어진다"라는 충격적인 밀회 계획이 기록되어 있습니다. 내부 공모자의 존재를 증명하는 결정적 물증입니다.',
    keywords: ['자정 밀회', '내부 공모'],
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },
  {
    id: 'clue_broken_lock',
    category: 'clue',
    title: '해제된 결계 자물쇠',
    icon: '🔓',
    summary: '물리적 파괴가 아닌 정교한 마력 공명으로 풀려난 마법 자물쇠.',
    description: '금서가 안치되어 있던 철창의 마법 자물쇠입니다. 외형에는 단 하나의 흠집도 없으나 내부의 룬 핵이 완전히 용해되어 있습니다. 이는 고위 마법사급의 해제 영창이나 정식 관리자의 허가 마력이 없이는 불가능한 작업입니다.',
    keywords: ['마력 공명', '용해된 룬'],
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },

  // Episodes (에피소드)
  {
    id: 'ep_01',
    category: 'episode',
    title: '제1화. 안개 낀 아카데미',
    icon: '🏰',
    summary: '한밤중 아카데미 중앙 서고에서 발생한 금서 도난 사건.',
    description: '자정을 알리는 종소리가 짙은 안개 너머로 울려 퍼질 때, 천 년 역사를 자랑하는 아르카디아 아카데미의 중앙 서고에서 일급 금서 [어스름의 서]가 도난당하는 초유의 사건이 발생했습니다. 견습 수사관 아렌은 사건의 진상을 밝히기 위해 현장에 급파됩니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: true
  },
  {
    id: 'ep_02',
    category: 'episode',
    title: '제2화. 시계탑의 밀회 (미공개)',
    icon: '🕰️',
    summary: '12시에 멈춰선 아카데미 대시계탑에서 벌어질 추격전.',
    description: '서고에서 발견된 단서들은 모두 안개 낀 시계탑 꼭대기 테라스를 가리키고 있습니다. 어둠 속에서 마법을 완성하려는 의문의 인물과 마주하게 될 다음 에피소드입니다.',
    relatedEpisode: 'ep2',
    unlockedByDefault: false
  },

  // Characters (인물)
  {
    id: 'char_aren',
    category: 'character',
    title: '아렌 (주인공)',
    icon: '🕵️',
    summary: '아르카디아 아카데미 규율단 소속의 견습 수사관.',
    description: '탁월한 관찰력과 침착한 분석력을 지닌 청년 수사관. 마법적 재능은 평범하지만, 사소한 흔적에서 진실을 엮어내는 추리력은 선임관들도 인정할 정도입니다. 품속에는 언제나 가죽 주머니와 수사 수첩을 지니고 다닙니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: true
  },
  {
    id: 'char_elena',
    category: 'character',
    title: '사서 엘레나',
    icon: '👩‍🏫',
    summary: '중앙 서고의 야간 보존 관리를 담당하는 젊은 사서.',
    description: '고문서 복원과 서고 정리에 평생을 바친 온화한 성품의 사서. 하지만 금서 도난 현장에서 마주친 그녀는 손을 떨며 극도의 불안감을 감추지 못하고 있습니다. 무언가 중대한 비밀을 감추고 있는 듯합니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },
  {
    id: 'char_felix',
    category: 'character',
    title: '수석 연구원 펠릭스',
    icon: '🧙‍♂️',
    summary: '학술원 연금술 학부의 젊은 천재 마법사.',
    description: '고대 마법과 시공간 주술 연구에 집착하는 인물. 사건 당일 밤 늦게까지 서고 근처 복도를 서성였다는 목격 정보가 있습니다. 사건과의 연관성에 대해 조사가 필요합니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },

  // Items (아이템)
  {
    id: 'item_inquisitor_badge',
    category: 'item',
    title: '수사관 배지',
    icon: '🛡️',
    summary: '아카데미 총장실 직속 규율단원임을 증명하는 은제 배지.',
    description: '은빛 독수리 문양이 음각된 배지. 아카데미 내부의 제한 구역 출입 및 학생, 교직원에 대한 수사 심문 권한을 보장합니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: true
  },
  {
    id: 'item_brass_key',
    category: 'item',
    title: '오래된 황동 열쇠',
    icon: '🔑',
    summary: '서고 한구석 화분 뒤 틈새에 숨겨져 있던 묵직한 열쇠.',
    description: '정교한 태엽 장치 문양이 새겨진 황동제 열쇠입니다. 서고 관리인의 육중한 마호가니 책상 서랍 잠금장치와 정확히 일치합니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },
  {
    id: 'item_parchment',
    category: 'item',
    title: '빛바랜 마법 양피지',
    icon: '📜',
    summary: '푸른빛 마력 룬이 은은하게 감도는 고대 문서의 파편.',
    description: '도난당한 금서에서 찢겨 나간 페이지. 특정 공명 주문을 영창하면 숨겨진 비밀 통로나 은폐 결계를 강제로 해제할 수 있습니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },
  {
    id: 'item_ritual_journal',
    category: 'item',
    title: '봉인된 의식의 일지',
    icon: '📓',
    summary: '서고 관리자 책상 비밀 서랍에서 발견된 밀회 기록 일지.',
    description: '자정에 시계탑의 태엽이 멈출 때 결계를 해제하고 금서를 탈취하겠다는 구체적인 계획이 적혀 있습니다. 내부 공모자의 존재를 증명하는 핵심 증거품입니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  },

  // Magic (마법)
  {
    id: 'magic_resonance',
    category: 'magic',
    title: '마력 공명 감지술',
    icon: '🔮',
    summary: '사물이나 공간에 남겨진 미세한 마력 파장을 가시화하는 마법.',
    description: '탐정 및 수사관들이 필수로 익히는 1환 주술. 일반인의 눈에는 보이지 않는 마력의 흔적, 룬의 잔열, 주술 결계의 미세한 균열을 푸른 빛으로 드러냅니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: true
  },
  {
    id: 'magic_fog_veil',
    category: 'magic',
    title: '안개의 장막',
    icon: '🌫️',
    summary: '소리와 모습을 안개 속에 은폐하는 고위 환영 주술.',
    description: '외부의 침입자가 아카데미의 삼중 방어 결계를 무력화하고 중앙 서고에 잠입할 때 사용된 것으로 의심되는 금지된 주술입니다.',
    relatedEpisode: 'ep1',
    unlockedByDefault: false
  }
];

export const CLUE_RECIPES = {
  'clue_broken_lock+magic_resonance': {
    id: 'hyp_resonance_unlock',
    label: '공명 해제 가설',
    sub: '가설',
    desc: '흠집 없는 결계 자물쇠와 마력 공명 감지술을 연결하면, 마력 공명으로 룬 핵을 풀었다는 가설이 성립합니다.'
  }
};

export const INVENTORY_ITEMS = [
  {
    id: 'item_inquisitor_badge',
    name: '수사관 배지',
    icon: '🛡️',
    category: 'artifact',
    type: 'key',
    desc: '아카데미 총장실 직속 규율단원임을 증명하는 은제 배지.'
  },
  {
    id: 'item_brass_key',
    name: '오래된 황동 열쇠',
    icon: '🔑',
    category: 'tool',
    type: 'key',
    desc: '서고 관리인의 마호가니 책상 서랍을 여는 황동 열쇠.'
  },
  {
    id: 'item_parchment',
    name: '빛바랜 마법 양피지',
    icon: '📜',
    category: 'clue',
    type: 'clue_item',
    desc: '푸른빛 마력 룬이 은은하게 감도는 고대 문서의 파편.'
  },
  {
    id: 'item_ritual_journal',
    name: '봉인된 의식의 일지',
    icon: '📓',
    category: 'clue',
    type: 'clue_item',
    desc: '자정의 밀회와 결계 해제 계획이 적힌 비밀 일지.'
  }
];