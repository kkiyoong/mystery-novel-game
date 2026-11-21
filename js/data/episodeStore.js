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
import { MAP_TILES } from '../isometricMap.js?v=20261121_1900';

const clone = (value) => JSON.parse(JSON.stringify(value));
const isCharacter = (entry) => Boolean(entry && entry.category === 'character');

let liveEpisodeId = null;

export function snapshotLive() {
  return {
    mapTiles: clone(MAP_TILES),
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
  // 타일 정보가 없는 구버전 보관본은 현재 타일을 그대로 유지
  if (Array.isArray(data.mapTiles)) {
    MAP_TILES.splice(0, MAP_TILES.length, ...clone(data.mapTiles));
  }
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

/**
 * 다른 회차의 지도 타일, 장소 상태, 조사 장면, 인물 배치를 현재(live) 회차로 복사해오기.
 * 모든 데이터는 반드시 깊은 복사(Deep Copy)로 복제되므로 원본 회차의 데이터는 절대 변경되지 않습니다.
 */
export function importFromEpisode(sourceEpisodeId, parts = null) {
  const result = { tiles: 0, locations: 0, scenes: 0, characters: 0 };
  if (!sourceEpisodeId || sourceEpisodeId === liveEpisodeId) return result;
  const source = EPISODE_DATA[sourceEpisodeId] || snapshotLive();
  const data = clone(source);

  const importAll = parts === null || typeof parts !== 'object';
  const shouldImportTiles = importAll || Boolean(parts?.tiles);
  const shouldImportLocations = importAll || Boolean(parts?.locations);
  const shouldImportScenes = importAll || Boolean(parts?.scenes);
  const shouldImportCharacters = importAll || Boolean(parts?.characters);

  // 1. 지도 타일 (MAP_TILES) - Deep Copy
  if (shouldImportTiles && Array.isArray(data.mapTiles) && data.mapTiles.length > 0) {
    MAP_TILES.splice(0, MAP_TILES.length, ...clone(data.mapTiles));
    result.tiles = MAP_TILES.length;
  }

  // 2. 구역 상태 (MAP_LOCATIONS) - Deep Copy
  if (shouldImportLocations && Array.isArray(data.mapLocations) && data.mapLocations.length > 0) {
    MAP_LOCATIONS.splice(0, MAP_LOCATIONS.length, ...clone(data.mapLocations));
    result.locations = MAP_LOCATIONS.length;
  }

  // 3. 조사 장면 (INVESTIGATION_SCENES) - Deep Copy
  if (shouldImportScenes && data.investigationScenes && typeof data.investigationScenes === 'object') {
    Object.keys(INVESTIGATION_SCENES).forEach((key) => delete INVESTIGATION_SCENES[key]);
    Object.assign(INVESTIGATION_SCENES, clone(data.investigationScenes));
    result.scenes = Object.keys(INVESTIGATION_SCENES).length;
  }

  // 4. 인물 배치 (CODEX_DATA 캐릭터) - Deep Copy
  if (shouldImportCharacters && Array.isArray(data.characters)) {
    const nonCharacters = CODEX_DATA.filter((entry) => !isCharacter(entry));
    CODEX_DATA.splice(0, CODEX_DATA.length, ...nonCharacters, ...clone(data.characters));
    result.characters = data.characters.length;
  }

  // 5. 현재 회차 저장소에도 즉시 동기화
  syncLiveToEpisode();
  return result;
}
