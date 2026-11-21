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
    "summary": "아카데미에서 발견한 식물 중 정답을 가려내야 한다.",
    "description": "현장 조사와 대화를 통해 수집한 조건들을 바탕으로, 올바른 정답을 추론해내자.\n진회색 조건 타일에 세부 타일을 붙여 부합 여부를 검증할 수 있다.",
    "keywords": [
      "약초 퀴즈"
    ],
    "relatedEpisode": "ep1",
    "unlockedByDefault": false,
    "subClues": [
      {
        "id": "sc_herb_not_poison",
        "label": "독초 X",
        "sub": "단서",
        "desc": "독성이 없는 식물이어야 한다.",
        "validTargets": [
          "만드라고라",
          "허기덩굴",
          "별방울꽃",
          "문플라워",
          "용비늘풀"
        ],
        "invalidTargets": [
          "칠리카도",
          "뱀비늘풀",
          "망각초"
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_sc_1795181452003",
        "label": "꽃 X",
        "sub": "단서",
        "desc": "꽃이 아니다.",
        "validTargets": [
          "만드라고라",
          "허기덩굴",
          "칠리카도",
          "뱀비늘풀",
          "용비늘풀",
          "망각초"
        ],
        "invalidTargets": [
          "별방울꽃",
          "문플라워"
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_sc_1795181869078",
        "label": "반짝임",
        "sub": "단서",
        "desc": "반짝여야 한다.",
        "validTargets": [
          "별방울꽃",
          "문플라워",
          "용비늘풀"
        ],
        "invalidTargets": [
          "만드라고라",
          "허기덩굴",
          "칠리카도",
          "뱀비늘풀",
          "망각초"
        ],
        "unlockedByDefault": false
      }
    ],
    "subItems": [
      {
        "id": "clue_herb_quiz_keyword_1",
        "label": "만드라고라",
        "sub": "키워드",
        "desc": "만드라고라",
        "records": [
          {
            "id": "clue_herb_quiz_keyword_1_rec_1",
            "text": "뿌리 식물. 사람 모양의 뿌리르 뽑으면 '우는 소리'를 낸다.",
            "source": "book:loc_library:0",
            "targetClueId": "",
            "determination": "none",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_1_rec_2",
            "text": "못생겼다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181869078",
            "determination": "invalid",
            "unlockedByDefault": false
          }
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_keyword_2",
        "label": "허기덩굴",
        "sub": "키워드",
        "desc": "허기덩굴",
        "records": [
          {
            "id": "clue_herb_quiz_keyword_2_rec_1",
            "text": "덩굴 식물이다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181452003",
            "determination": "valid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_2_rec_2",
            "text": "딱히 반짝이지는 않는다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181869078",
            "determination": "invalid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_2_rec_3",
            "text": "허기덩굴 볶음은 아카데미의 인기 메뉴다.",
            "source": "",
            "targetClueId": "sc_herb_not_poison",
            "determination": "valid",
            "unlockedByDefault": false
          }
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_keyword_3",
        "label": "칠리카도",
        "sub": "키워드",
        "desc": "칠리카도",
        "records": [
          {
            "id": "clue_herb_quiz_keyword_3_rec_1",
            "text": "독성이 있다.",
            "source": "",
            "targetClueId": "sc_herb_not_poison",
            "determination": "invalid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_3_rec_2",
            "text": "매콤한 냄새가 난다.",
            "source": "",
            "targetClueId": "",
            "determination": "none",
            "unlockedByDefault": false
          }
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_keyword_4",
        "label": "별방울꽃",
        "sub": "키워드",
        "desc": "별방울꽃",
        "records": [
          {
            "id": "clue_herb_quiz_keyword_4_rec_1",
            "text": "별모양 꽃이다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181452003",
            "determination": "invalid",
            "unlockedByDefault": false
          }
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_keyword_5",
        "label": "문플라워",
        "sub": "키워드",
        "desc": "문플라워",
        "records": [
          {
            "id": "clue_herb_quiz_keyword_5_rec_1",
            "text": "은은하게 빛을 낸다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181869078",
            "determination": "valid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_5_rec_2",
            "text": "밤에 달빛을 받고 피는 꽃이다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181452003",
            "determination": "invalid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_5_rec_3",
            "text": "수면 효과와 미약한 독성이 있다.",
            "source": "",
            "targetClueId": "sc_herb_not_poison",
            "determination": "invalid",
            "unlockedByDefault": false
          }
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_keyword_6",
        "label": "뱀비늘풀",
        "sub": "키워드",
        "desc": "뱀비늘풀",
        "records": [
          {
            "id": "clue_herb_quiz_keyword_6_rec_1",
            "text": "독성이 있다.",
            "source": "",
            "targetClueId": "sc_herb_not_poison",
            "determination": "invalid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_6_rec_2",
            "text": "예쁘지만, 꽃은 아니다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181452003",
            "determination": "valid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_6_rec_3",
            "text": "은은하게 반짝인다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181869078",
            "determination": "valid",
            "unlockedByDefault": false
          }
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_keyword_7",
        "label": "용비늘풀",
        "sub": "키워드",
        "desc": "용비늘풀",
        "records": [
          {
            "id": "clue_herb_quiz_keyword_7_rec_1",
            "text": "빛을 받으면 반짝인다.",
            "source": "book:loc_library:0",
            "targetClueId": "clue_herb_quiz_sc_1795181869078",
            "determination": "valid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_7_rec_2",
            "text": "독성이 없다.",
            "source": "",
            "targetClueId": "sc_herb_not_poison",
            "determination": "valid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_7_rec_3",
            "text": "꽃이 아니다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181452003",
            "determination": "valid",
            "unlockedByDefault": false
          }
        ],
        "unlockedByDefault": false
      },
      {
        "id": "clue_herb_quiz_keyword_8",
        "label": "망각초",
        "sub": "키워드",
        "desc": "망각초",
        "records": [
          {
            "id": "clue_herb_quiz_keyword_8_rec_1",
            "text": "독성이 있다.",
            "source": "",
            "targetClueId": "sc_herb_not_poison",
            "determination": "invalid",
            "unlockedByDefault": false
          },
          {
            "id": "clue_herb_quiz_keyword_8_rec_2",
            "text": "사실 버섯이다.",
            "source": "",
            "targetClueId": "clue_herb_quiz_sc_1795181452003",
            "determination": "invalid",
            "unlockedByDefault": false
          }
        ],
        "unlockedByDefault": false
      }
    ],
    "answers": [
      "용비늘풀",
      "용비늘"
    ]
  },
  {
    "id": "clue_topic_1795254079199",
    "category": "clue",
    "role": "keyword",
    "title": "주머니...쥐?",
    "icon": "🐭",
    "summary": "주머니에서 쥐가 튀어나왔다. 상태창? 아이템? 이게 다 뭐지.",
    "description": "상세 설명을 입력하세요.",
    "keywords": [],
    "subItems": [
      {
        "id": "clue_topic_1795254079199_sub_1795254131590",
        "label": "포랫",
        "sub": "세부 타일",
        "desc": "주머니에서 튀어나온 말하는 쥐.",
        "records": [
          {
            "id": "rec_1795254131590",
            "title": "발견",
            "text": "기록 내용"
          }
        ],
        "unlockedByDefault": true
      },
      {
        "id": "clue_topic_1795254079199_sub_1795254150073",
        "label": "상태창",
        "sub": "세부 타일",
        "desc": "파란 창이 허공에 뜬다. 홀로...그램?",
        "records": [
          {
            "id": "rec_1795254150073",
            "title": "발견",
            "text": "기록 내용"
          }
        ],
        "unlockedByDefault": true
      },
      {
        "id": "clue_topic_1795254079199_sub_1795254198762",
        "label": "손전등",
        "sub": "세부 타일",
        "desc": "빛이 나는 막대. 이게 마법이 아니라니.",
        "records": [
          {
            "id": "rec_1795254198762",
            "title": "발견",
            "text": "기록 내용"
          }
        ],
        "unlockedByDefault": true
      }
    ],
    "subClues": [],
    "unlockedByDefault": true
  },
  {
    "id": "char_laiden",
    "category": "character",
    "title": "프라마",
    "icon": "👨🏻‍🦰",
    "summary": "공간 마법학 교수.",
    "description": "빨간 머리 마법사가 교수였다니.",
    "relatedEpisode": "",
    "unlockedByDefault": true,
    "keywords": [
      "프라마"
    ]
  },
  {
    "id": "char_칼릭스",
    "category": "character",
    "title": "칼릭스",
    "icon": "🙎🏼‍♂️",
    "summary": "수석 입학생",
    "description": "수석 입학생.\n나의 룸메이트다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": false,
    "keywords": [
      "칼릭스"
    ]
  },
  {
    "id": "char_elena",
    "category": "character",
    "title": "에밀리",
    "icon": "images/elena_avatar.png",
    "image": "images/elena.png",
    "summary": "네블라 홀에서 만난 선배.",
    "description": "네블라 홀에서 마주쳤다.",
    "relatedEpisode": "ep1",
    "unlockedByDefault": false,
    "keywords": [
      "엘레나",
      "사서",
      "도서관"
    ]
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
    "desc": "빛이 나는 막대.",
    "source": "inventory"
  },
  {
    "id": "item_종이_조각",
    "name": "종이 조각",
    "icon": "📜",
    "category": "clue",
    "type": "clue_item",
    "desc": "퀴즈의 정답을 적으라는 걸까?",
    "quantity": 1,
    "source": "story",
    "sourceNodeId": "ep1_return_from_investigation",
    "sourceNodeTitle": "식물이 낸 퀴즈?"
  },
  {
    "id": "item_custom_1795189625104",
    "name": "반딧물 포션",
    "icon": "🧪",
    "category": "material",
    "type": "item",
    "desc": "먹으면 어두운 곳도 잘 볼 수 있다.",
    "source": "scene",
    "sourceNodeId": "story_1795185391071",
    "sourceNodeTitle": "반딧물 포션?",
    "sourceSceneId": "loc_nebula",
    "sourceSceneTitle": "네블라 홀"
  }
];
