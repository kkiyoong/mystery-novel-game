/**
 * Codex / Encyclopedia Data
 * Updated via Author Editor
 */

export const CODEX_CATEGORIES = [
  {
    "id": "clue",
    "label": "단서",
    "icon": "🔍"
  },
  {
    "id": "character",
    "label": "인물",
    "icon": "👤"
  },
  {
    "id": "magic",
    "label": "마법",
    "icon": "✨"
  },
  {
    "id": "incident",
    "label": "사건",
    "icon": "🗂️"
  }
];

export const CODEX_DATA = [
  {
    "id": "clue_herb_quiz",
    "category": "clue",
    "role": "keyword",
    "title": "약초 퀴즈",
    "icon": "🌿",
    "summary": "안개 숲에서 발견한 식물 후보들 중 해독제에 쓸 수 있는 약초를 가려내야 한다.",
    "description": "도서관의 식물학 서적과 현장 조사를 통해 수집한 조건들을 바탕으로, 올바른 약초를 추론해내자.\n진회색 조건 타일에 세부 식물 타일을 붙여 부합 여부를 검증할 수 있다.",
    "keywords": [
      "약초 퀴즈"
    ],
    "relatedEpisode": "ep1",
    "unlockedByDefault": true,
    "subClues": [
      {
        "id": "sc_herb_not_poison",
        "label": "독초 X",
        "sub": "단서",
        "desc": "독성이 없는 식물이어야 합니다. 섭취하거나 피부에 닿았을 때 마력 발작을 일으키는 독초는 제외됩니다.",
        "validTargets": [
          "달빛 이끼",
          "은방울풀"
        ],
        "invalidTargets": [
          "붉은 독버섯"
        ],
        "unlockedByDefault": true
      },
      {
        "id": "sc_herb_edible",
        "label": "식용 가능",
        "sub": "단서",
        "desc": "가공 없이 달여 마실 수 있는 식용 약초여야 합니다. 쓴맛이 과하거나 섬유질이 억센 식물은 탈락입니다.",
        "validTargets": [
          "달빛 이끼"
        ],
        "invalidTargets": [
          "은방울풀",
          "붉은 독버섯"
        ],
        "unlockedByDefault": true
      }
    ],
    "subItems": [
      {
        "id": "item_moonlight_moss",
        "label": "달빛 이끼",
        "sub": "후보 식물",
        "desc": "밤안개 속에서 은은한 푸른빛을 내는 이끼. 쓴맛이 없고 해독 성분이 풍부해 식용으로 바로 섭취 가능하다."
      },
      {
        "id": "item_red_mushroom",
        "label": "붉은 독버섯",
        "sub": "후보 식물",
        "desc": "선명한 붉은 갓에 흰 점이 박혀 있는 버섯. 소량만 닿아도 신경 마비를 유발하는 맹독초다."
      },
      {
        "id": "item_silver_bell",
        "label": "은방울풀",
        "sub": "후보 식물",
        "desc": "종 모양의 은백색 꽃. 독성은 없으나 질긴 섬유질과 강한 알칼로이드 성분 때문에 식용으로는 부적합하다."
      }
    ]
  },
  {
    "id": "clue_muddy_footprints",
    "category": "clue",
    "title": "주머니...쥐?",
    "icon": "🐭",
    "summary": "주머니에서 쥐가 나왔다.",
    "description": "중고로 산 주머니에서 쥐가 튀어나왔다.\n얼떨결에 계약을 했지만...\n상태창? 아이템? 이게 다 뭐지?",
    "keywords": [
      "주머니"
    ],
    "relatedEpisode": "ep1",
    "unlockedByDefault": true,
    "subItems": [
      {
        "id": "clue_muddy_footprints_keyword_1",
        "label": "상태창",
        "sub": "키워드",
        "desc": "상태창"
      },
      {
        "id": "clue_muddy_footprints_keyword_2",
        "label": "손전등",
        "sub": "키워드",
        "desc": "손전등"
      },
      {
        "id": "clue_muddy_footprints_keyword_3",
        "label": "포랫",
        "sub": "키워드",
        "desc": "포랫"
      }
    ]
  },
  {
    "id": "clue_torn_parchment",
    "category": "clue",
    "title": "찢겨진 마법 양피지",
    "icon": "📜",
    "summary": "고대 마법 연단에서 발견된 불완전한 소환진 기록.",
    "description": "도난당한 금서 [어스름의 서]에서 강제로 뜯겨 나간 것으로 추정되는 양피지 조각입니다. 희미한 푸른 인광이 글귀를 따라 맥동하고 있으며, 마력 공명 의식의 1단계 주석이 적혀 있습니다. 일정 수준 이상의 마력을 가진 자만 해독할 수 있습니다.",
    "keywords": [
      "공명 의식",
      "마력 룬"
    ],
    "relatedEpisode": "ep1",
    "unlockedByDefault": false
  },
  {
    "id": "clue_ritual_journal",
    "category": "clue",
    "title": "조난 당했을 때 당신을 살릴 606가지 마법식물 도감",
    "icon": "📓",
    "summary": "약초 도감이다.",
    "description": "이것만 알면 당신도 생존 전문가!\n약초처럼 생긴 독초, 독초처럼 생긴 버섯...\n606가지의 마법식물 수록!",
    "keywords": [
      "자정 밀회",
      "내부 공모"
    ],
    "relatedEpisode": "ep1",
    "unlockedByDefault": false
  },
  {
    "id": "clue_broken_lock",
    "category": "clue",
    "title": "해제된 결계 자물쇠",
    "icon": "🔓",
    "summary": "물리적 파괴가 아닌 정교한 마력 공명으로 풀려난 마법 자물쇠.",
    "description": "금서가 안치되어 있던 철창의 마법 자물쇠입니다. 외형에는 단 하나의 흠집도 없으나 내부의 룬 핵이 완전히 용해되어 있습니다. 이는 고위 마법사급의 해제 영창이나 정식 관리자의 허가 마력이 없이는 불가능한 작업입니다.",
    "keywords": [
      "마력 공명",
      "용해된 룬"
    ],
    "relatedEpisode": "ep1",
    "unlockedByDefault": false
  },
  {
    "id": "ep_01",
    "category": "episode",
    "title": "제1화. 안개 낀 아카데미",
    "icon": "🏰",
    "summary": "한밤중 아카데미 중앙 서고에서 발생한 금서 도난 사건.",
    "description": "자정을 알리는 종소리가 짙은 안개 너머로 울려 퍼질 때, 천 년 역사를 자랑하는 아르카디아 아카데미의 중앙 서고에서 일급 금서 [어스름의 서]가 도난당하는 초유의 사건이 발생했습니다. 견습 수사관 아렌은 사건의 진상을 밝히기 위해 현장에 급파됩니다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": true
  },
  {
    "id": "ep_02",
    "category": "episode",
    "title": "제2화. 시계탑의 밀회 (미공개)",
    "icon": "🕰️",
    "summary": "12시에 멈춰선 아카데미 대시계탑에서 벌어질 추격전.",
    "description": "서고에서 발견된 단서들은 모두 안개 낀 시계탑 꼭대기 테라스를 가리키고 있습니다. 어둠 속에서 마법을 완성하려는 의문의 인물과 마주하게 될 다음 에피소드입니다.",
    "relatedEpisode": "ep2",
    "unlockedByDefault": false
  },
  {
    "id": "char_laiden",
    "category": "character",
    "title": "프라마",
    "icon": "🕵️",
    "summary": "공간 마법학 교수.",
    "description": "빨간 머리 마법사가 교수였다니.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": true,
    "keywords": [
      "프라마"
    ]
  },
  {
    "id": "char_elena",
    "category": "character",
    "title": "사서 엘레나",
    "icon": "👩‍🏫",
    "summary": "중앙 서고의 관리를 담당하는 젊은 사서.",
    "description": "고문서 복원과 서고 정리에 평생을 바친 온화한 성품의 사서. 하지만 금서 도난 현장에서 마주친 그녀는 손을 떨며 극도의 불안감을 감추지 못하고 있습니다. 무언가 중대한 비밀을 감추고 있는 듯합니다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": false
  },
  {
    "id": "char_felix",
    "category": "character",
    "title": "수석 연구원 펠릭스",
    "icon": "🧙‍♂️",
    "summary": "학술원 연금술 학부의 젊은 천재 마법사.",
    "description": "고대 마법과 시공간 주술 연구에 집착하는 인물. 사건 당일 밤 늦게까지 서고 근처 복도를 서성였다는 목격 정보가 있습니다. 사건과의 연관성에 대해 조사가 필요합니다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": false
  },
  {
    "id": "item_inquisitor_badge",
    "category": "item",
    "title": "수사관 배지",
    "icon": "🛡️",
    "summary": "아카데미 총장실 직속 규율단원임을 증명하는 은제 배지.",
    "description": "은빛 독수리 문양이 음각된 배지. 아카데미 내부의 제한 구역 출입 및 학생, 교직원에 대한 수사 심문 권한을 보장합니다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": true
  },
  {
    "id": "item_brass_key",
    "category": "item",
    "title": "오래된 황동 열쇠",
    "icon": "🔑",
    "summary": "서고 한구석 화분 뒤 틈새에 숨겨져 있던 묵직한 열쇠.",
    "description": "정교한 태엽 장치 문양이 새겨진 황동제 열쇠입니다. 서고 관리인의 육중한 마호가니 책상 서랍 잠금장치와 정확히 일치합니다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": false
  },
  {
    "id": "item_parchment",
    "category": "item",
    "title": "빛바랜 마법 양피지",
    "icon": "📜",
    "summary": "푸른빛 마력 룬이 은은하게 감도는 고대 문서의 파편.",
    "description": "도난당한 금서에서 찢겨 나간 페이지. 특정 공명 주문을 영창하면 숨겨진 비밀 통로나 은폐 결계를 강제로 해제할 수 있습니다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": false
  },
  {
    "id": "item_ritual_journal",
    "category": "item",
    "title": "봉인된 의식의 일지",
    "icon": "📓",
    "summary": "서고 관리자 책상 비밀 서랍에서 발견된 밀회 기록 일지.",
    "description": "자정에 시계탑의 태엽이 멈출 때 결계를 해제하고 금서를 탈취하겠다는 구체적인 계획이 적혀 있습니다. 내부 공모자의 존재를 증명하는 핵심 증거품입니다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": false
  },
  {
    "id": "magic_resonance",
    "category": "magic",
    "title": "마력 공명 감지술",
    "icon": "🔮",
    "summary": "사물이나 공간에 남겨진 미세한 마력 파장을 가시화하는 마법.",
    "description": "탐정 및 수사관들이 필수로 익히는 1환 주술. 일반인의 눈에는 보이지 않는 마력의 흔적, 룬의 잔열, 주술 결계의 미세한 균열을 푸른 빛으로 드러냅니다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": true
  }
];

export const CLUE_RECIPES = {};

export const INVENTORY_ITEMS = [
  {
    "id": "item_inquisitor_badge",
    "name": "손전등",
    "icon": "🔦",
    "category": "tool",
    "type": "key",
    "desc": "빛이 나는 막대."
  },
  {
    "id": "item_brass_key",
    "name": "오래된 황동 열쇠",
    "icon": "🔑",
    "category": "tool",
    "type": "key",
    "desc": "서고 관리인의 마호가니 책상 서랍을 여는 황동 열쇠."
  },
  {
    "id": "item_parchment",
    "name": "빛바랜 마법 양피지",
    "icon": "📜",
    "category": "clue",
    "type": "clue_item",
    "desc": "푸른빛 마력 룬이 은은하게 감도는 고대 문서의 파편."
  },
  {
    "id": "item_ritual_journal",
    "name": "봉인된 의식의 일지",
    "icon": "📓",
    "category": "clue",
    "type": "clue_item",
    "desc": "자정의 밀회와 결계 해제 계획이 적힌 비밀 일지."
  }
];
