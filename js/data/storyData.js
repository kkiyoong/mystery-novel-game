/**
 * Branching Story Data for the Playable Korean Scenario
 * Episode 1: 안개 낀 아카데미 (The Misty Academy)
 */

export const STORY_EPISODES = {
  ep1: {
    id: 'ep1',
    title: '제1화. 안개 낀 아카데미',
    chapter: '제1장. 한밤중의 비상 소집',
    startNode: 'ep1_pocket_intro'
  }
};

export const STORY_NODES = {
  ep1_pocket_intro: {
    id: 'ep1_pocket_intro',
    episodeId: 'ep1',
    title: '뜻밖의 선물',
    chapter: '서장. 주머니를 건네받다',
    grantsPocket: true,
    paragraphs: [
      '자정의 종이 울리기 전, 총장실 서기는 내게 낡은 가죽 주머니 하나를 건넸다.',
      '"현장을 살피다 보면 작은 단서도 놓치기 쉽지요. 필요한 물건과 기록을 여기에 챙겨 두세요."',
      '주머니의 버클을 채우자, 안쪽에서 작은 은빛 고리가 짤랑였다. 이제 출동할 시간이었다.'
    ],
    choices: [
      {
        text: '주머니를 허리에 걸고, 비상 소집 장소인 중앙 서고로 향한다.',
        nextNode: 'ep1_node_1'
      }
    ]
  },

  ep1_node_1: {
    id: 'ep1_node_1',
    episodeId: 'ep1',
    title: '제1화. 안개 낀 아카데미',
    chapter: '제1장. 한밤중의 비상 소집',
    paragraphs: [
      '자정을 알리는 아르카디아 아카데미의 육중한 청동 종소리가 깊은 밤의 적막을 열두 번 갈랐다.',
      '천 년의 역사를 간직한 대리석 회랑 위로 차갑고 눅눅한 밤안개가 밀려들고 있었다. 발소리를 죽이며 걷는 나의 망토 끝자락에 차가운 이슬방울이 맺혔다.',
      '규율단 본부로부터 급전이 내려온 것은 불과 삼십 분 전이었다. 아카데미의 절대 봉인 구역이자 태고의 비의가 잠든 곳—[중앙 서고]의 결계가 무력화되고, 일급 금서인 [어스름의 서]가 흔적도 없이 사라졌다는 충격적인 보고였다.',
      '서고 앞 거대한 아치형 석조 문 앞에는 은은한 푸른빛의 결계 파편들이 유리 부스러기처럼 바닥에 흩뿌려져 있었다. 서고 내부에서는 희미한 등불 불빛과 함께 누군가의 흐느끼는 듯한 숨소리가 들려온다.'
    ],
    choices: [
      {
        text: '복도 바닥과 결계 파편의 흔적을 면밀히 관찰한다.',
        requirementText: '관찰력 3 이상 필요',
        condition: { stat: { perception: 3 } },
        nextNode: 'ep1_corridor_inspect',
        effects: {
          rewardStat: { perception: 1 },
          unlockCodex: 'clue_muddy_footprints',
          toast: '단서를 발견했습니다! [수상한 진흙 발자국] 해금 (+1 관찰력)'
        }
      },
      {
        text: '지체할 틈이 없다. 서고 문을 열고 현장을 직접 조사한다.',
        requirementText: '현장 조사 모드 진입',
        isInvestigationTrigger: true,
        locationId: 'loc_library',
        nextNode: 'ep1_return_from_investigation'
      },
      {
        text: '주머니 속의 수사관 배지와 장비를 점검하며 마음을 가다듬는다.',
        nextNode: 'ep1_inspect_gear'
      }
    ]
  },

  ep1_corridor_inspect: {
    id: 'ep1_corridor_inspect',
    episodeId: 'ep1',
    title: '제1화. 안개 낀 아카데미',
    chapter: '제1장. 한밤중의 비상 소집',
    paragraphs: [
      '나는 무릎을 꿇고 차가운 바닥에 손을 얹었다. 손끝을 타고 미세한 잔류 마력의 진동이 전해졌다.',
      '바닥에 흩어진 결계 파편 사이로 유난히 짙은 얼룩이 눈에 띄었다. 그것은 평범한 먼지가 아니었다. 축축하고 끈적이는 특유의 [붉은 진흙 자국]이었다.',
      '아카데미 영지 내에서 이런 붉은 점토질 흙이 존재하는 곳은 서쪽 약초 온실과 인적이 드문 [비밀 안개 정원]뿐이다. 침입자는 정규 출입로가 아니라 정원 쪽 창문을 통해 침입한 것이 틀림없다.',
      '"안개 정원이라... 계획된 침입 경로군."',
      '나는 수사 수첩에 새로운 단서를 기록하고 굳게 닫힌 서고의 문을 향해 발걸음을 옮겼다.'
    ],
    choices: [
      {
        text: '이제 서고 안으로 진입하여 현장을 조사한다.',
        isInvestigationTrigger: true,
        locationId: 'loc_library',
        nextNode: 'ep1_return_from_investigation'
      }
    ]
  },

  ep1_inspect_gear: {
    id: 'ep1_inspect_gear',
    episodeId: 'ep1',
    title: '제1화. 안개 낀 아카데미',
    chapter: '제1장. 한밤중의 비상 소집',
    paragraphs: [
      '품속에서 차가운 은제 수사관 배지를 꺼내 쥐었다. 독수리 문양이 달빛을 받아 서늘하게 반짝였다.',
      '총장실 직속 규율단원으로서 이번 사건은 단순한 절도가 아니라는 직감이 들었다. [어스름의 서]는 고대 시공간 마법의 룬이 봉인된 위험한 마도서다. 악용된다면 아카데미 전체가 시공의 왜곡에 휘말릴 수도 있다.',
      '나는 가죽 주머니의 버클을 단단히 채우고, 굳은 결의와 함께 서고의 문을 힘차게 밀었다.'
    ],
    choices: [
      {
        text: '서고 문을 열고 들어가 사건 현장을 조사한다.',
        isInvestigationTrigger: true,
        locationId: 'loc_library',
        nextNode: 'ep1_return_from_investigation'
      }
    ]
  },

  ep1_return_from_investigation: {
    id: 'ep1_return_from_investigation',
    episodeId: 'ep1',
    title: '제1화. 안개 낀 아카데미',
    chapter: '제2장. 단서의 교차점',
    paragraphs: [
      '서고 내부의 현장 조사를 마치고 중앙 홀로 돌아왔다. 사방을 둘러싼 거대한 고서 서가 사이로 싸늘한 밤바람이 스쳐 지나갔다.',
      '내 머릿속에서 지금까지 수집한 단서들이 하나의 선으로 엮이기 시작했다. 현장에 흩뿌려진 흔적과 인물들의 태도는 사건의 진실을 가리키고 있다.',
      '어떤 방향으로 수사의 결론을 내리고 행동을 개시할 것인가? 나의 선택에 따라 아카데미의 운명이 좌우될 것이다.'
    ],
    choices: [
      {
        text: '[추리 전개] 사서 엘레나의 자백과 봉인 일지를 근거로 진실을 밝혀낸다.',
        requirementText: '봉인된 의식의 일지 소지 & 엘레나의 자백 필요',
        condition: {
          hasItem: 'item_ritual_journal',
          flag: 'elena_confession'
        },
        nextNode: 'ep1_ending_truth',
        effects: {
          rewardStat: { persuasion: 1 }
        }
      },
      {
        text: '[비전 개방] 찢겨진 마법 양피지의 공명 주문으로 비밀 통로를 연다.',
        requirementText: '마법 양피지 소지 & 마력 3 이상 필요',
        condition: {
          hasItem: 'item_parchment',
          stat: { magic: 3 }
        },
        nextNode: 'ep1_ending_secret_passage',
        effects: {
          rewardStat: { magic: 1 }
        }
      },
      {
        text: '[현장 추격] 창틀의 진흙 자국과 안개의 장막을 추적하여 시계탑으로 달린다.',
        requirementText: '창문 단서 확인 필요',
        condition: {
          flag: 'inspected_window'
        },
        nextNode: 'ep1_ending_chase_clocktower',
        effects: {
          rewardStat: { stamina: 10 }
        }
      },
      {
        text: '아직 놓친 것이 있을지 모른다. 서고를 다시 조사한다.',
        isInvestigationTrigger: true,
        locationId: 'loc_library',
        nextNode: 'ep1_return_from_investigation'
      }
    ]
  },

  ep1_ending_truth: {
    id: 'ep1_ending_truth',
    episodeId: 'ep1',
    title: '제1화. 안개 낀 아카데미',
    chapter: '최종 결말: 진실의 탄환 (추리 완료)',
    paragraphs: [
      '나는 품속에서 꺼낸 [봉인된 의식의 일지]를 사서 엘레나의 눈앞에 펼쳐 보였다.',
      '"엘레나 사서님. 이 일지에 적힌 필적과 비밀 서랍 속 황동 열쇠는 당신이 수석 연구원 펠릭스와 내통했음을 증명하고 있습니다. 하지만 당신이 동생의 불치병 치료를 위해 협박받았다는 사실 역시 확인했습니다."',
      '엘레나는 무너져 내리듯 주저앉으며 흐느꼈다.',
      '"죄송해요... 펠릭스 님이 금서의 한 페이지만 복사하고 돌려주겠다고 약속하셨어요... 하지만 그분은 지금 시계탑 꼭대기에서 금지된 시공간 의식을 강행하려 하고 있어요!"',
      '충분한 증거와 자백이 확보되었다. 나는 엘레나를 규율단 보호 병동으로 호송하도록 지시하고, 지원 병력을 시계탑으로 급파했다. 나의 냉철한 관찰력과 화술이 무고한 희생자를 막고 범인의 꼬리를 완벽하게 잡아챈 순간이었다.'
    ],
    choices: [
      {
        text: '사건 파일 종결 (처음부터 다시 플레이)',
        isResetTrigger: true
      },
      {
        text: '다른 선택지를 보기 위해 단서의 교차점으로 돌아가기',
        nextNode: 'ep1_return_from_investigation'
      }
    ]
  },

  ep1_ending_secret_passage: {
    id: 'ep1_ending_secret_passage',
    episodeId: 'ep1',
    title: '제1화. 안개 낀 아카데미',
    chapter: '최종 결말: 봉인된 지하 통로 (비전 개방)',
    paragraphs: [
      '나는 마법 연단에서 발견한 [빛바랜 마법 양피지]를 손바닥 위에 얹고 집중했다. 내 안의 마력이 양피지의 고대 룬 문자와 공명하며 파랗게 타오르기 시작했다.',
      '"...오스티움 아페리투르(문이여, 열려라)."',
      '나직한 영창과 함께 서고 중앙의 거대한 참나무 서가가 굉음을 내며 좌우로 미끄러져 갈라졌다! 그 뒤편에는 수백 년간 감춰져 있던 어두운 나선형 지하 계단이 아가리를 벌리고 있었다.',
      '지하 통로의 벽면에는 아직 꺼지지 않은 푸른 마법 불꽃이 일렁이고 있었고, 범인이 남기고 간 망토 깃털이 떨어져 있었다.',
      '"이 통로는 시계탑의 지하 태엽실과 곧바로 연결되어 있어...!"',
      '나는 마력의 광휘를 두른 채 어둠 속의 비밀 계단을 향해 망설임 없이 몸을 던졌다. 사건의 진실은 이제 손 닿을 곳에 있었다.'
    ],
    choices: [
      {
        text: '사건 파일 종결 (처음부터 다시 플레이)',
        isResetTrigger: true
      },
      {
        text: '다른 선택지를 보기 위해 단서의 교차점으로 돌아가기',
        nextNode: 'ep1_return_from_investigation'
      }
    ]
  },

  ep1_ending_chase_clocktower: {
    id: 'ep1_ending_chase_clocktower',
    episodeId: 'ep1',
    title: '제1화. 안개 낀 아카데미',
    chapter: '최종 결말: 안개 속의 추격전 (현장 돌파)',
    paragraphs: [
      '시간이 없었다. 나는 서고의 부서진 창문 턱을 딛고 안개 낀 밤의 정원으로 뛰어내렸다.',
      '바닥의 붉은 진흙 자국은 맹렬한 기세로 아카데미 최고층인 대시계탑 외벽 계단을 향해 이어져 있었다. 공기 중에는 찌릿한 오존 냄새와 함께 왜곡된 시공간 마력의 파동이 뿜어져 나오고 있었다.',
      '가쁜 숨을 몰아쉬며 시계탑 테라스의 철문에 도달했을 때, 자정을 가리킨 채 멈춰선 거대한 톱니바퀴 너머로 검은 로브를 두른 인영이 금서를 품에 안은 채 뒤를 돌아보았다.',
      '"기어코 여기까지 쫓아왔군, 규율단의 사냥개여."',
      '안개 너머로 번뜩이는 두 눈동자. 진정한 승부는 이제부터 시작이었다.'
    ],
    choices: [
      {
        text: '사건 파일 종결 (처음부터 다시 플레이)',
        isResetTrigger: true
      },
      {
        text: '다른 선택지를 보기 위해 단서의 교차점으로 돌아가기',
        nextNode: 'ep1_return_from_investigation'
      }
    ]
  }
};