/**
 * Map and Investigation Scene Data
 * Updated via Author Editor
 */

export const MAP_LOCATIONS = [
  {
    "id": "loc_library",
    "name": "도서관",
    "subtitle": "아카데미 중앙부에 자리한 오래된 서고",
    "icon": "📚",
    "coords": {
      "x": 42,
      "y": 55
    },
    "unlocked": true,
    "hasInvestigation": true,
    "description": "수만 권의 고서와 마법 봉인 구역이 자리 잡은 웅장한 도서관. ",
    "targetStoryNode": "story_1795179565179",
    "travelMode": "story",
    "destinationType": "story"
  },
  {
    "id": "loc_clocktower",
    "name": "시계탑 테라스",
    "subtitle": "아카데미 최고층 첨탑",
    "icon": "🕰️",
    "coords": {
      "x": 74,
      "y": 28
    },
    "unlocked": false,
    "requiredFlag": "elena_clue_clocktower",
    "unlockHint": "엘레나에게 침입자의 행방을 물어보면 이동할 수 있습니다.",
    "hasInvestigation": true,
    "description": "12시 정각에 멈춰선 아카데미의 대시계탑. 짙은 안개 속에서 수상한 불빛이 목격되었습니다."
  },
  {
    "id": "loc_garden",
    "name": "정원",
    "subtitle": "서쪽 온실 외곽",
    "icon": "🌿",
    "coords": {
      "x": 20,
      "y": 36
    },
    "unlocked": true,
    "hasInvestigation": true,
    "description": "특유의 붉은 점토와 희귀 약초들이 자라는 정원입니다.",
    "destinationType": "story",
    "travelMode": "story",
    "targetStoryNode": "story_1795179345197"
  },
  {
    "id": "loc_lab",
    "name": "연구관",
    "subtitle": "약초학 연구실",
    "icon": "🧪",
    "coords": {
      "x": 26,
      "y": 80
    },
    "unlocked": true,
    "hasInvestigation": true,
    "description": "아카데미의 연구와 강의가 이루어지는 연구관입니다.",
    "destinationType": "story",
    "travelMode": "story",
    "targetStoryNode": "story_1795202607078"
  },
  {
    "id": "loc_nebula",
    "name": "네블라 홀",
    "subtitle": "별의 운행을 관측하던 돔형 강당",
    "icon": "🔭",
    "coords": {
      "x": 88,
      "y": 58
    },
    "unlocked": true,
    "hasInvestigation": true,
    "description": "아카데미 외곽에 자리한 돔형 강당. 제국의 첫 마법사가 지었다고 한다. 천장에는 빛 마법에 반응하는 조명이 달려 있다.",
    "destinationType": "story",
    "travelMode": "story",
    "targetStoryNode": "story_1795180010121"
  },
  {
    "id": "loc_main",
    "name": "본관",
    "subtitle": "약초학 강의실",
    "icon": "🏛️",
    "coords": {
      "x": 50,
      "y": 55
    },
    "unlocked": true,
    "hasInvestigation": false,
    "targetStoryNode": "story_1795161633215",
    "description": "아카데미 중앙 본관. 약초학 강의실에서 퀴즈의 답을 맞출 수 있습니다."
  },
  {
    "id": "loc_custom_1795174793503",
    "name": "새 장소",
    "subtitle": "새로운 조사 장소",
    "icon": "📍",
    "coords": {
      "x": 50,
      "y": 50
    },
    "unlocked": false,
    "hasInvestigation": false,
    "description": "장소 설명을 입력하세요."
  }
];

export const INVESTIGATION_SCENES = {
  "loc_library": {
    "id": "loc_library",
    "title": "도서관",
    "subtitle": "조사 지점을 눌러 단서를 찾거나 인물과 대화해 보세요.",
    "layout": "library",
    "exitStoryNode": "story_1795192473432",
    "hotspots": [
      {
        "id": "hotspot_1795178580065",
        "title": "기초 식물 도감",
        "type": "book",
        "coords": {
          "x": 22,
          "y": 38
        },
        "icon": "📖",
        "monologue": "",
        "pages": [
          {
            "indexTitle": "ㅁ",
            "pageTitle": "ㅁ",
            "content": "[세부타일: 약초 퀴즈 | 만드라고라 | 만드라고라]\n\n뿌리 식물로 알려진 만드라고라는 자연에서 쉽게 발견할 수 없어 주로 인위적으로 환경을 조정한다.\n널따란 잎이 특징이며, 뿌리가 다 자랄 즈음에 꽃봉오리를 터뜨린다.\n사람 모양의 뿌리를 한 번에 뽑으면 치명적인 ‘우는 소리’를 낸다. \n\n[기록: 만드라고라 | clue_herb_quiz_keyword_1_rec_1 | 뿌리 식물. 사람 모양의 뿌리르 뽑으면 '우는 소리'를 낸다.]\n\n[세부타일: 약초 퀴즈 | 망각초 | 망각초]\n\n주로 그늘진 곳에 있다.\n‘초’라고 불리지만 실제로는 버섯이다.\n잎처럼 보이는 초록색의 얇은 포자 여럿이 다발처럼 한 곳에서 이어져 나온다.\n\n[기록: 망각초 | clue_herb_quiz_keyword_8_rec_2 | 사실 버섯이다.]\n\n\n[세부타일: 약초 퀴즈 | 문플라워 | 문플라워]\n\n달이 뜰 때 개화하는 꽃.\n곳곳에 있지만 달빛을 받아야 그 모습을 보이기에 모르고 놓치기 십상이다.\n낮에는 녹색의 줄기가 잎만 보이며, 줄기는 굵고 잎은 뾰족하다.\n달빛을 받을 때 피어나는 꽃은 상아색에 가깝다. 은은한 빛을 낸다.\n꽃잎은 총 9장으로 동그랗게 말려있는 모양새로 마치 만월의 보름달 같다.\n\n[기록: 문플라워 | clue_herb_quiz_keyword_5_rec_2 | 밤에 달빛을 받고 피는 꽃이다.]\n[기록: 문플라워 | clue_herb_quiz_keyword_5_rec_1 | 은은하게 빛을 낸다.]\n\n"
          },
          {
            "indexTitle": "ㅂ",
            "pageTitle": "ㅂ",
            "content": "[세부타일: 약초 퀴즈 | 뱀비늘풀 | 뱀비늘풀]\n\n주로 늪의 주변, 안개가 서리고 음기진 곳에 있다.\n길게 쭉 뻗은 모습을 하고 있는 이 풀은, 자세히 보면 뱀의 비늘과 흡사하게 보인다.\n빛 아래 있으면 비늘이 반사되어 빛이 나는 것처럼 느껴진다.\n\n[기록: 뱀비늘풀 | clue_herb_quiz_keyword_6_rec_3 | 은은하게 반짝인다.]\n\n\n[세부타일: 약초 퀴즈 | 별방울꽃 | 별방울꽃]\n\n별이 방울진다는 뜻의 별방울꽃은 꽃이 연결된 것처럼 줄지어 있으며, 그 무게로 인해서 줄기가 축 처진 것처럼 보인다.\n길고 두꺼운 잎 사이에서 보이는 꽃은 별의 모양을 하고 있다.\n멀리서 보면 종으로 보이기도 하는 꽃의 끝에 방울 같은 원형이 맺혀 있어 조경용으로도 쓰인다.\n\n[기록: 별방울꽃 | clue_herb_quiz_keyword_4_rec_1 | 별모양 꽃이다.]\n"
          },
          {
            "indexTitle": "ㅇ",
            "pageTitle": "ㅇ",
            "content": "\n[세부타일: 약초 퀴즈 | 용비늘풀 | 용비늘풀]\n\n풀잎이 용의 비늘과 닮아 용비늘풀이라는 이름이 붙여졌다.\n비늘이 돋은 듯 보이는 잎을 보고 꽃이라고 착각할 수도 있다.\n[기록: 용비늘풀 | clue_herb_quiz_keyword_7_rec_3 | 꽃이 아니다.]\n뱀비늘풀과 구조는 흡사하다.\n다른 점이라면 용비늘풀은 여러 겹이 층을 이루듯 겹쳐져 있어 하나의 비늘 더미로 보인다는 것이다.\n푸르고도 하얀 빛이 감돌고 있으며, 빛을 받으면 반짝인다.\n[기록: 용비늘풀 | clue_herb_quiz_keyword_7_rec_1 | 빛을 받으면 반짝인다.]\n종종 ‘역린’이라고 부르는 작은 잎 하나가 거꾸로 자란다."
          },
          {
            "indexTitle": "ㅊ",
            "pageTitle": "ㅊ",
            "content": "[칠리카도]\n열매의 일종.\n붉은 가넷처럼 보이는 이 열매는 색뿐만 아니라 다 익었을 때 빛이 나는 것처럼 윤기가 흐른다.\n타원형의 열매는 가운데가 약간은 오목하게 들어갔으며, 아랫부분이 윗부분보다 더욱 볼록하게 튀어나와 있다.\n근처에 가도 코끝을 찌르는 듯한 알싸한 냄새가 나기에 보통은 마스크를 착용하고 수확한다.\n\n\n[세부타일: 약초 퀴즈 | 칠리카도 | 칠리카도]\n\n"
          },
          {
            "indexTitle": "ㅎ",
            "pageTitle": "ㅎ",
            "content": "[세부타일: 약초 퀴즈 | 허기덩굴 | 허기덩굴]\n\n마른 껍질을 엮어서 늘어놓은 것처럼 보이는 이 식물은 그늘 같은 음지에서 자란다.\n줄기의 색이 잿빛이기에 눈에 잘 띄지 않으나, 근처에 가면 특유의 냄새가 나 찾을 수 있다.\n\n[기록: 허기덩굴 | clue_herb_quiz_keyword_2_rec_1 | 덩굴 식물이다.]\n"
          }
        ]
      }
    ],
    "bgImage": "assets/images/scenes/library_bg.jpg"
  },
  "loc_garden": {
    "id": "loc_garden",
    "title": "정원",
    "subtitle": "싱그러운 정원.",
    "layout": "garden",
    "exitStoryNode": "story_1795192473432",
    "hotspots": [
      {
        "id": "hotspot_garden_clay",
        "title": "텃밭",
        "type": "inspect",
        "coords": {
          "x": 41,
          "y": 61
        },
        "icon": "🪴",
        "flag": "found_clay_source",
        "toast": "붉은 점토의 흔적을 확인했습니다.",
        "inspectText": "열매는 둥글고 통통했으며, 표면에는 매끄러운 윤기가 흘렀다.\n들여다보는데 매콤한 냄새가 나는 것도 같았다.\n표지판에 이름이 적혀 있었다.\n\n[세부타일: 약초 퀴즈 | 칠리카도 | 칠리카도]\n[기록: 칠리카도 | clue_herb_quiz_keyword_3_rec_2 | 매콤한 냄새가 난다.]",
        "monologue": "이름도 생김새도 묘하네. 매콤한 냄새도 나.",
        "memoId": "",
        "grantsSubItemId": "clue_herb_quiz_keyword_3"
      },
      {
        "id": "hotspot_1795184600662",
        "title": "화단",
        "type": "inspect",
        "coords": {
          "x": 90,
          "y": 76
        },
        "icon": "🔍",
        "monologue": "별별 꽃이 다 있네.",
        "inspectText": "작은 종처럼 생긴 꽃들이 눈에 들어왔다.\n가느다란 줄기 끝에 매달린 꽃들은 아래를 향해 고개를 숙이고 있었다. \n꽃잎은 둥글게 벌어져 있었고, 그 안쪽에는 맑은 물방울 같은 것이 맺혀 있었다.\n무엇보다 인상적인 건 꽃잎의 색이었다.\n희미한 푸른빛이 감도는 흰 꽃잎은 햇빛을 받을 때마다 은은하게 반짝였다. \n바람이 불 때마다 꽃들이 흔들리자 작은 종들이 일제히 고개를 끄덕이는 것 같았다.\n\n[세부타일: 약초 퀴즈 | 별방울꽃 | 별방울꽃]\n",
        "memoId": "",
        "grantsSubItemId": "clue_herb_quiz_keyword_4",
        "grantsRecordId": "clue_herb_quiz_keyword_4_rec_1"
      },
      {
        "id": "hotspot_1795184634558",
        "title": "수풀",
        "type": "inspect",
        "coords": {
          "x": 8,
          "y": 79
        },
        "icon": "🔍",
        "monologue": "이름이 꽤 잘 어울리네.",
        "inspectText": "길쭉하게 뻗은 잎사귀가 여러 겹으로 겹쳐져 있었는데, 그 모양이 마치 작은 비늘을 겹쳐 놓은 것 같았다.\n잎의 끝부분은 날카롭게 뾰족했고, 표면에는 푸른빛과 은빛이 뒤섞인 윤기가 흘렀다.\n햇빛이 닿을 때마다 잎맥을 따라 빛이 반사되어 반짝였다.\n\n[용비늘풀]\n\n이름만큼이나 독특한 생김새였다.\n나는 몸을 조금 숙여 잎사귀를 자세히 살펴보았다.\n잎의 표면은 매끄러워 보였지만, 겹쳐진 부분마다 미세한 굴곡이 있었다. 마치 진짜 용의 비늘을 잘게 잘라 붙여 놓은 듯했다.\n바람이 불자 잎사귀들이 서로 스치며 사각거리는 소리를 냈다.\n나는 잠시 그 모습을 바라보다가 몸을 일으켰다.",
        "grantsSubItemId": "clue_herb_quiz_keyword_7",
        "grantsRecordId": "clue_herb_quiz_keyword_7_rec_1"
      },
      {
        "id": "hotspot_1795194671044",
        "title": "뽑고 싶게 생긴 풀",
        "type": "inspect",
        "coords": {
          "x": 64,
          "y": 83
        },
        "icon": "🌱",
        "monologue": "정말 못생겼다. 소리도 시끄러워.",
        "inspectText": "넓적한 잎사귀들이 땅 위로 풍성하게 펼쳐져 있었다. \n잎은 짙은 녹색을 띠고 있었고, 가장자리에는 자잘한 굴곡이 있었다. \n얼핏 보면 흔히 볼 수 있는 평범한 식물과 다를 바 없었다.\n그런데 왠지 뽑고 싶게 생겼다....\n호기심이 생긴 나는 줄기 아랫부분을 잡고 살짝 당겨 보았다.\n“끼이이이이익!”\n“으아악!”\n갑작스러운 비명에 나도 모르게 손을 놓았다.\n귀가 아팠다.\n\n[스탯: 체력 -1 | 만드라고라의 울음 소리에 귀가 다쳤습니다.]\n\n흙이 우수수 쏟아지며 식물 하나가 통째로 뽑혀 나왔다. \n그리고 그 아래로 드러난 것은 놀랍게도 사람의 형상을 닮은 뿌리였다.\n굵은 몸통에 짧은 팔다리까지. 마치 작은 사람이 풀에 매달려 있는 듯한 모습이었다.\n[기록: 만드라고라 | clue_herb_quiz_keyword_1_rec_2 | 못생겼다.]",
        "grantsSubItemId": "clue_herb_quiz_keyword_1",
        "grantsRecordId": "clue_herb_quiz_keyword_1_rec_2"
      }
    ],
    "bgImage": "assets/images/scenes/garden_bg.jpg"
  },
  "loc_lab": {
    "id": "loc_lab",
    "title": "지하 연금술 연구실",
    "subtitle": "실험대와 연구 기록을 살펴보세요.",
    "layout": "laboratory",
    "exitStoryNode": "story_1795192473432",
    "hotspots": [
      {
        "id": "hotspot_lab_notes",
        "title": "실험대 위의 연구 기록",
        "type": "inspect",
        "coords": {
          "x": 74,
          "y": 78
        },
        "icon": "📜",
        "flag": "inspected_lab_notes",
        "toast": "연구 기록에서 의식의 흔적을 찾았습니다.",
        "inspectText": "뱀비늘풀 – 주의! 용비늘풀과 헷갈리지 말 것. 충분히 독성 휘발시켜 사용할 것.\n\n[기록: 뱀비늘풀 | clue_herb_quiz_keyword_6_rec_1 | 독성이 있다.]\n",
        "monologue": "풀 끝부분을 특히 조심하라고도 적혀 있었다. 겉보기에 위험해 보이진 않는데. 알아서 다행이다.\n\n[스탯: 지식 +1 | 새로운 정보를 습득했다.]\n"
      },
      {
        "id": "hotspot_1795198892580",
        "title": "보라색 병",
        "type": "inspect",
        "coords": {
          "x": 32,
          "y": 55
        },
        "icon": "🧫",
        "monologue": "수면제로 쓰이는 건가?\n\n[스탯: 지식+1 | 새로운 정보를 얻었습니다.]\n",
        "inspectText": "라벨에 이렇게 적혀 있다.\n\n[가운데: **꽃가루에 수면 유도 성분. (학생 취급 금지)**]\n\n",
        "grantsRecordId": "clue_herb_quiz_keyword_5_rec_3"
      },
      {
        "id": "hotspot_1795198929934",
        "title": "초록색 병",
        "type": "inspect",
        "coords": {
          "x": 65,
          "y": 66
        },
        "icon": "🧪",
        "monologue": "살벌하네. 알아서 다행이다.\n\n[스탯: 지식 +1 | 새로운 정보를 얻었습니다.]\n\n",
        "inspectText": "라벨에 이렇게 적혀 있다.\n\n[가운데: **용량에 따라 1~24시간 이내의 기억 말소. (학생 절대 취급 금지)**]\n\n",
        "grantsRecordId": "clue_herb_quiz_keyword_8_rec_1"
      }
    ],
    "bgImage": "assets/images/scenes/lab_bg.jpg"
  },
  "loc_nebula": {
    "id": "loc_nebula",
    "title": "네블라 홀",
    "subtitle": "불 꺼진 네블라 홀.",
    "layout": "library",
    "bgImage": "assets/images/scenes/nebula_bg.jpg",
    "exitStoryNode": "story_1795192473432",
    "hotspots": [
      {
        "id": "hotspot_1795188613657",
        "title": "학생",
        "type": "character",
        "coords": {
          "x": 21,
          "y": 80
        },
        "icon": "👤",
        "monologue": "선배인가?",
        "characterName": "새 인물 1",
        "characterRole": "학생",
        "dialogueTree": {
          "start": {
            "speaker": "새 인물 1",
            "text": "“너 뭐야. 여기서는 빛 마법 금지인 거 몰라?”\n“네? 입학식에서는….”\n“그건 입학식에서만 그런 거고. 보통은 다들 숨을 곳이 필요할 때 여기 와서 할 일을 한다고. 가만 보니 너, 신입생이구나?”\n“네.”\n“이름이 뭐야? 난 (강당의 선배 이름)이야.”\n“레이든 부르크입니다.”\n“그래, 레이든. 이제 그 빛 좀 꺼줄래? 다들 여기를 쳐다보잖아.”\n“아, 네…! 그런데 불을 끄면 하나도 안 보이는데요.”\n“에휴, 그러니까. 안 보여서 다들 숨어 있는 거라고.”\n“왜 숨나요?”\n“그건 과제를 못해서… 아니, 아니다. 자, 이거 얼른 받아서 마셔. 시선 끌리니까.”\n\n[아이템: 반딧물 포션 | 먹으면 어두운 곳도 잘 볼 수 있다. | 🧪]\n\n[아이템사용: 반딧물 포션 | 반딧물 포션을(를) 사용하여 상호작용했습니다. | 🧪]\n\"신입생이니까 특별히 줄게. 원래는 비싸게 파는 건데….”\n\"우와, 빛을 꺼도 앞이 보이네요? 감사합니다!”\n“그래, 이제 빨리 가 봐. 이목이 끌려서 곤란하다고.”\n“어, 저기, 물어볼 게….”",
            "options": [
              {
                "text": "대화를 마친다.",
                "nextNode": "exit"
              }
            ]
          }
        },
        "memoId": "char_elena"
      },
      {
        "id": "hotspot_1795194907673",
        "title": "바닥에 떨어진 쪽지",
        "type": "inspect",
        "coords": {
          "x": 68,
          "y": 87
        },
        "icon": "📜",
        "monologue": "아름다움이나 허기를 위해서 존재하지 않는다니.\n아름다움...식물...꽃?\n꽃이 아니라는 거 아닐까?\n\n[스탯: 관찰력 +1 | 스스로 생각해냈습니다.]\n\n[단서: 꽃 X | 약초 퀴즈 | 꽃이 아니다.]\n",
        "inspectText": "여긴 지옥이야. 얼른 도망쳐! 신입생에게. \n추신. 약초학 퀴즈 받았지? 퀴즈 문장에 정답이 다 들어 있을 거야.\n나는 메모해 둔 퀴즈를 다시 읽었다.\n"
      }
    ]
  }
};
