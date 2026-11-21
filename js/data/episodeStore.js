/**
 * Episode-scoped data store (회차별 지도 · 조사 장면 · 인물 설정)
 *
 * - MAP_LOCATIONS / INVESTIGATION_SCENES / CODEX_DATA(인물) 는 "현재 로드된 회차"의 작업본(live)입니다.
 * - 각 회차의 데이터는 EPISODE_DATA[episodeId] 에 서로 완전히 독립된 복사본으로 보관됩니다.
 * - 회차를 바꾸면 해당 회차의 복사본이 live 로 교체되어, 다른 회차 데이터는 절대 덮어쓰이지 않습니다.
 * - 이야기 본문(STORY_NODES)은 node.episodeId 로 이미 회차별로 분리되어 있습니다.
 */
import { MAP_LOCATIONS, INVESTIGATION_SCENES, EPISODE_DATA } from './mapData.js?v=20261121_1900';
import { CODEX_DATA } from './codexData.js?v=20261121_1900';
import { STORY_EPISODES } from './storyData.js?v=20261121_1900';

const clone = (value) => JSON.parse(JSON.stringify(value));
const isCharacter = (entry) => Boolean(entry && entry.category === 'character');

let liveEpisodeId = null;

export function snapshotLive() {
  return {
    mapLocations: clone(MAP_LOCATIONS),
    investigationScenes: clone(INVESTIGATION_SCENES),
    characters: clone(CODEX_DATA.filter(isCharacter))
  };
}

export function getEpisodeIds() {
  return Object.keys(STORY_EPISODES);
}

export function getLiveEpisodeId() {
  return liveEpisodeId;
}

/** live 작업본을 현재 live 회차의 보관 슬롯에 기록 */
export function syncLiveToEpisode() {
  if (!liveEpisodeId) return;
  EPISODE_DATA[liveEpisodeId] = snapshotLive();
}

/** 보관된 회차 데이터를 live 로 불러오기 (보관본이 없으면 현재 live 를 그 회차의 시작 데이터로 복사) */
export function loadEpisodeToLive(episodeId) {
  if (!episodeId) return;
  if (!EPISODE_DATA[episodeId]) {
    EPISODE_DATA[episodeId] = snapshotLive();
  }
  const data = EPISODE_DATA[episodeId];
  MAP_LOCATIONS.splice(0, MAP_LOCATIONS.length, ...clone(data.mapLocations || []));
  Object.keys(INVESTIGATION_SCENES).forEach((key) => delete INVESTIGATION_SCENES[key]);
  Object.assign(INVESTIGATION_SCENES, clone(data.investigationScenes || {}));
  const others = CODEX_DATA.filter((entry) => !isCharacter(entry));
  CODEX_DATA.splice(0, CODEX_DATA.length, ...others, ...clone(data.characters || []));
  liveEpisodeId = episodeId;
}

/** 앱 시작 시: 모든 회차에 보관 슬롯을 보장하고 현재 회차를 live 로 로드 */
export function initEpisodeStore(currentEpisodeId) {
  const ids = getEpisodeIds();
  liveEpisodeId = null;
  ids.forEach((id) => {
    if (!EPISODE_DATA[id]) EPISODE_DATA[id] = snapshotLive();
  });
  const target = ids.includes(currentEpisodeId) ? currentEpisodeId : (ids[0] || 'ep1');
  loadEpisodeToLive(target);
  return target;
}

/** 새 회차의 데이터 슬롯 생성 (기준 회차를 복사하여 독립 객체로 생성) */
export function createEpisodeData(newEpisodeId, fromEpisodeId = null) {
  syncLiveToEpisode();
  const source = (fromEpisodeId && EPISODE_DATA[fromEpisodeId]) || EPISODE_DATA[liveEpisodeId] || snapshotLive();
  EPISODE_DATA[newEpisodeId] = clone(source);
}
