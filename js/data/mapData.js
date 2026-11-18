/**
 * Map and Investigation Scene Data
 */

export const MAP_LOCATIONS = [
  {
    id: 'loc_library',
    name: '도서관',
    subtitle: '아카데미 중앙부에 자리한 오래된 서고',
    icon: '📚',
    coords: { x: 42, y: 55 },
    unlocked: true,
    isCurrent: true,
    hasInvestigation: true,
    description: '수만 권의 고서와 마법 봉인 구역이 자리 잡은 웅장한 도서관. 어젯밤 금서 [어스름의 서]가 도난당했습니다.'
  },
  {
    id: 'loc_clocktower',
    name: '시계탑 테라스',
    subtitle: '아카데미 최고층 첨탑',
    icon: '🕰️',
    coords: { x: 74, y: 28 },
    unlocked: false,
    requiredFlag: 'elena_clue_clocktower',
    unlockHint: '엘레나에게 침입자의 행방을 물어보면 이동할 수 있습니다.',
    hasInvestigation: true,
    description: '12시 정각에 멈춰선 아카데미의 대시계탑. 짙은 안개 속에서 수상한 불빛이 목격되었습니다.'
  },
  {
    id: 'loc_garden',
    name: '비밀 안개 정원',
    subtitle: '서쪽 온실 외곽',
    icon: '🌿',
    coords: { x: 20, y: 36 },
    unlocked: false,
    requiredFlag: 'inspected_window',
    unlockHint: '서고 창틀에 남은 흔적을 살펴보면 이동할 수 있습니다.',
    hasInvestigation: true,
    description: '특유의 붉은 점토와 희귀 약초들이 자라는 인적이 드문 안개 정원입니다.'
  },
  {
    id: 'loc_lab',
    name: '연구동',
    subtitle: '약초학 연구실',
    icon: '🧪',
    coords: { x: 26, y: 80 },
    unlocked: false,
    requiredFlag: 'unlocked_desk_drawer',
    unlockHint: '서랍 속 비밀 일지를 찾아내면 이동할 수 있습니다.',
    hasInvestigation: true,
    description: '수석 연구원 펠릭스의 개인 연구실. 수상한 시약과 금지된 마법진이 그려져 있습니다.'
  },
  {
    id: 'loc_nebula',
    name: '네블라 홀',
    subtitle: '별의 운행을 관측하던 돔형 강당',
    icon: '🔭',
    coords: { x: 88, y: 58 },
    unlocked: true,
    hasInvestigation: true,
    description: '아카데미 외곽에 자리한 돔형 강당입니다. 천장에는 별자리의 움직임을 비추던 낡은 관측 장치가 남아 있습니다.'
  }
];

export const INVESTIGATION_SCENES = {
  loc_library: {
    id: 'loc_library',
    title: '도서관',
    subtitle: '조사 지점을 눌러 단서를 찾거나 인물과 대화해 보세요.',
    layout: 'library',
    exitStoryNode: 'ep1_return_from_investigation',
    hotspots: [
      {
        id: 'hotspot_floor_crack',
        title: '구석 화분 뒤 카펫 틈새',
        type: 'item',
        coords: { x: 14, y: 76 },
        icon: '🔑',
        item: {
          id: 'item_brass_key',
          name: '오래된 황동 열쇠',
          icon: '🔑',
          quantity: 1,
          type: 'key',
          desc: '서고 관리인의 육중한 마호가니 책상 서랍 잠금장치와 일치하는 황동 열쇠.'
        },
        codexId: 'item_brass_key',
        toast: '[오래된 황동 열쇠]를 획득했습니다! (소지품 추가)',
        inspectText: '축축한 화분 받침대 뒤편, 젖혀진 카펫 틈새에서 차가운 금속 감촉의 묵직한 황동 열쇠를 찾아냈습니다. 누군가 급하게 흘리고 간 듯합니다.'
      },
      {
        id: 'hotspot_pedestal',
        title: '고대 마법 연단',
        type: 'item',
        coords: { x: 50, y: 64 },
        icon: '📜',
        item: {
          id: 'item_parchment',
          name: '빛바랜 마법 양피지',
          icon: '📜',
          quantity: 1,
          type: 'clue_item',
          desc: '푸른빛 마력 룬이 은은하게 감도는 고대 문서의 찢겨진 파편.'
        },
        codexId: 'clue_torn_parchment',
        toast: '[빛바랜 마법 양피지]를 입수했습니다! (단서 해금)',
        inspectText: '룬 문자가 새겨진 석조 연단 모서리에서 뜯겨 나간 양피지 조각을 발견했습니다. 도난당한 금서 [어스름의 서]의 일부로, 신비로운 푸른 마력이 희미하게 맥동하고 있습니다.'
      },
      {
        id: 'hotspot_desk',
        title: '사서의 마호가니 책상 서랍',
        type: 'interactive',
        coords: { x: 28, y: 62 },
        icon: '🔒',
        requiresItem: 'item_brass_key',
        lockedMessage: '묵직한 마호가니 책상의 아래쪽 서랍입니다. 정교한 황동 자물쇠로 잠겨 있어 손으로는 열리지 않습니다. [오래된 황동 열쇠가 필요합니다]',
        unlockedToast: '황동 열쇠로 서랍을 열고 [봉인된 의식의 일지]를 확보했습니다!',
        unlockedCodexId: 'clue_ritual_journal',
        grantsItem: {
          id: 'item_ritual_journal',
          name: '봉인된 의식의 일지',
          icon: '📓',
          quantity: 1,
          type: 'clue_item',
          desc: '자정에 벌어질 밀회와 결계 해제 계획이 빽빽하게 적힌 비밀 일지.'
        },
        unlockedFlag: 'unlocked_desk_drawer',
        unlockedText: '딸깍! 황동 열쇠가 꼭 들어맞으며 서랍이 열렸습니다. 서랍 안쪽 비밀 이중 바닥에서 얇은 가죽 장정 일지를 발견했습니다. "자정에 시계탑의 태엽이 멈출 때..."라는 구절이 선명히 적혀 있습니다!'
      },
      {
        id: 'hotspot_stained_glass',
        title: '달빛 드는 스테인드글라스 창문',
        type: 'inspect',
        coords: { x: 48, y: 22 },
        icon: '🔍',
        codexId: 'clue_muddy_footprints',
        flag: 'inspected_window',
        toast: '창문 틀의 흔적을 분석했습니다! [수상한 진흙 발자국] 단서 해금',
        inspectText: '높다란 아치형 창문의 잠금 빗장이 밖에서 도구로 강제로 젖혀져 있습니다. 창틀과 아래 대리석 바닥에는 아직 마르지 않은 특유의 붉은 진흙 자국과 푸른 환영 마력 가루가 남아 있습니다. (비밀 안개 정원의 흙입니다!)'
      },
      {
        id: 'hotspot_bookshelf_gate',
        title: '금서 보관 철창 자물쇠',
        type: 'inspect',
        coords: { x: 67, y: 35 },
        icon: '✨',
        codexId: 'clue_broken_lock',
        flag: 'inspected_lock',
        toast: '보관대의 결계를 감정했습니다! [해제된 결계 자물쇠] 단서 해금',
        inspectText: '금서가 안치되어 있던 철창입니다. 겉보기엔 멀쩡하지만 내부의 봉인 룬 핵이 정교하게 무력화되어 있습니다. 외부의 무력 침입자 혼자서는 불가능하며, 내부 관리자의 허가 마력이 공명했음을 뜻합니다.'
      },
      {
        id: 'hotspot_elena',
        title: '사서 엘레나',
        type: 'character',
        coords: { x: 80, y: 55 },
        icon: '👤',
        characterId: 'char_elena',
        characterName: '사서 엘레나',
        characterRole: '서고 보존 사서',
        image: null,
        dialogueTree: {
          start: {
            speaker: '사서 엘레나',
            text: '아... 규율단 수사관님이시군요. 자정에 갑자기 서고 결계 경보가 울려서 달려왔는데... 벌써 금서가 사라져 있었어요. 저는 아무것도 모릅니다...',
            options: [
              {
                text: '침입자의 인상착의를 보셨습니까?',
                nextNode: 'elena_intruder'
              },
              {
                text: '방금 전 바닥에서 황동 열쇠를 찾았습니다. 당신 것입니까?',
                condition: { hasItem: 'item_brass_key' },
                nextNode: 'elena_key_found'
              },
              {
                text: '손을 떨고 계시는군요. 무언가 숨기는 것이 있습니까? [화술 4 필요]',
                condition: { stat: { persuasion: 4 } },
                nextNode: 'elena_persuasion'
              },
              {
                text: '알겠습니다. 현장을 조금 더 둘러보겠습니다.',
                nextNode: 'exit'
              }
            ]
          },
          elena_intruder: {
            speaker: '사서 엘레나',
            text: '짙은 안개 장막을 두르고 있어서 얼굴은 보지 못했어요. 하지만 칠흑 같은 로브 아래로 놋쇠 회중시계 소리가 째깍째깍 울렸고... 시계탑 쪽 테라스로 황급히 뛰어갔습니다!',
            options: [
              {
                text: '시계탑 테라스라... 중요한 증언입니다.',
                nextNode: 'start'
              }
            ],
            effects: {
              setFlag: 'elena_clue_clocktower',
              unlockCodex: 'char_elena'
            }
          },
          elena_key_found: {
            speaker: '사서 엘레나',
            text: '(화들짝 놀라며) 아앗... 그건 제 책상 서랍 열쇠인데... 어디서 찾으셨나요? 어젯밤에 누군가와 부딪히면서 떨어뜨린 줄로만 알았는데...',
            options: [
              {
                text: '화분 뒤 구석에 떨어져 있었습니다. 서랍에 무엇이 들어 있습니까?',
                nextNode: 'elena_drawer_ask'
              }
            ],
            effects: {
              setFlag: 'elena_admitted_key'
            }
          },
          elena_drawer_ask: {
            speaker: '사서 엘레나',
            text: '그, 그건... 단순한 서고 관리 일지예요. 정말 중요한 건 아무것도 없어요...! (그녀의 눈동자가 심하게 흔들립니다)',
            options: [
              {
                text: '직접 열어 확인해 보면 알겠지요.',
                nextNode: 'start'
              }
            ]
          },
          elena_persuasion: {
            speaker: '사서 엘레나',
            text: '흑... 사실대로 말씀드릴게요. 수석 연구원 펠릭스 님이 제 동생의 치료 마법을 빌미로 결계 해제 주석을 요구하셨어요. 저는 거절하지 못하고... 자정에 시계탑에서 만나기로 약속했습니다...',
            options: [
              {
                text: '동생의 일은 안타깝지만, 범행을 막는 것이 먼저입니다. 자백에 감사드립니다.',
                nextNode: 'start'
              }
            ],
            effects: {
              setFlag: 'elena_confession',
              unlockCodex: 'char_felix',
              rewardStat: { perception: 1 }
            }
          }
        }
      }
    ]
  },
  loc_clocktower: {
    id: 'loc_clocktower',
    title: '시계탑 테라스',
    subtitle: '멈춰 선 시계와 테라스의 흔적을 살펴보세요.',
    layout: 'clocktower',
    exitStoryNode: 'ep1_return_from_investigation',
    hotspots: [
      {
        id: 'hotspot_clocktower_clock',
        title: '자정에 멈춘 대시계',
        type: 'inspect',
        coords: { x: 52, y: 28 },
        icon: '🕰️',
        flag: 'inspected_clocktower',
        toast: '멈춘 시계의 톱니에 남은 흔적을 확인했습니다.',
        inspectText: '시계는 자정을 가리킨 채 멈춰 있습니다. 톱니 사이에는 최근 누군가 손을 댄 듯한 금속 가루가 남아 있습니다.'
      }
    ]
  },
  loc_garden: {
    id: 'loc_garden',
    title: '비밀 안개 정원',
    subtitle: '온실 바닥과 희귀 약초 주변을 살펴보세요.',
    layout: 'garden',
    exitStoryNode: 'ep1_return_from_investigation',
    hotspots: [
      {
        id: 'hotspot_garden_clay',
        title: '붉은 흙이 묻은 화분',
        type: 'inspect',
        coords: { x: 30, y: 72 },
        icon: '🪴',
        flag: 'found_clay_source',
        toast: '붉은 점토의 흔적을 확인했습니다.',
        inspectText: '화분 밑에 굳은 붉은 점토가 묻어 있습니다. 서고 창틀에서 발견한 진흙과 같은 흙입니다.'
      }
    ]
  },
  loc_lab: {
    id: 'loc_lab',
    title: '지하 연금술 연구실',
    subtitle: '실험대와 연구 기록을 살펴보세요.',
    layout: 'laboratory',
    exitStoryNode: 'ep1_return_from_investigation',
    hotspots: [
      {
        id: 'hotspot_lab_notes',
        title: '실험대 위의 연구 기록',
        type: 'inspect',
        coords: { x: 58, y: 62 },
        icon: '📜',
        flag: 'inspected_lab_notes',
        toast: '연구 기록에서 의식의 흔적을 찾았습니다.',
        inspectText: '실험 기록에는 자정 무렵 시계탑의 태엽이 멈추는 순간을 이용한다는 메모가 적혀 있습니다.'
      }
    ]
  },
  loc_nebula: {
    id: 'loc_nebula',
    title: '네블라 홀',
    subtitle: '돔 아래 남겨진 관측 장치와 흔적을 살펴보세요.',
    layout: 'library',
    exitStoryNode: 'ep1_return_from_investigation',
    hotspots: [
      {
        id: 'hotspot_nebula_orrey',
        title: '강당 중앙의 별자리 관측 장치',
        type: 'inspect',
        coords: { x: 50, y: 58 },
        icon: '🔭',
        flag: 'inspected_nebula_orrey',
        toast: '관측 장치에 남은 흔적을 확인했습니다.',
        inspectText: '강당 중앙의 낡은 관측 장치는 북쪽 하늘을 향하고 있습니다. 황동 눈금에는 누군가 최근 만진 듯한 손자국이 남아 있고, 렌즈 가장자리에는 미세한 검은 가루가 묻어 있습니다.'
      },
      {
        id: 'hotspot_nebula_dome',
        title: '돔 천장의 별자리 투영 흔적',
        type: 'inspect',
        coords: { x: 52, y: 24 },
        icon: '✨',
        flag: 'inspected_nebula_dome',
        toast: '돔 천장에 남은 마력 흔적을 살폈습니다.',
        inspectText: '천장에 희미하게 남은 별자리 선들이 서로 어긋나 있습니다. 몇 개의 선은 지워진 듯 끊겨 있고, 그 주변에는 마력이 빠져나간 흔적이 옅게 번져 있습니다.'
      }
    ]
  }
};