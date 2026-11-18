/**
 * Narrative Branching Engine & Layton-Style Investigation Controller
 */

import { state } from './state.js';
import { STORY_EPISODES, STORY_NODES } from './data/storyData.js';
import { INVESTIGATION_SCENES } from './data/mapData.js';
import { CODEX_DATA, INVENTORY_ITEMS } from './data/codexData.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[char]);

export class GameEngine {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = true;

    this.storyView = document.getElementById('story-view');
    this.investigationView = document.getElementById('investigation-view');
    this.sceneCanvas = document.getElementById('investigation-scene-canvas');
    this.hotspotsLayer = document.getElementById('investigation-hotspots');
    this.dialogueModal = document.getElementById('npc-dialogue-overlay');
    this.toastContainer = document.getElementById('toast-container');

    this.currentDialogueTree = null;
    this.currentDialogueNodeKey = null;
    this.isLeavingInvestigation = false;
    this.leaveTimeoutId = null;

    this.initAudio();
  }

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  ensureAudioContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playAudio(type) {
    if (!this.soundEnabled || !this.audioCtx) return;
    this.ensureAudioContext();

    const now = this.audioCtx.currentTime;

    try {
      if (type === 'click' || type === 'wheelTick') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(type === 'wheelTick' ? 640 : 480, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'itemPickup' || type === 'codexUnlock') {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);

          gain.gain.setValueAtTime(0.12, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.2);
        });
      } else if (type === 'drawerOpen') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'drawerClose') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  showToast(message, type = 'info', icon = '💡') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `game-toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${escapeHtml(icon)}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;

    this.toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3200);
  }

  renderStoryNode(nodeId) {
    const node = STORY_NODES[nodeId];
    if (!node) {
      console.error(`Story node not found: ${nodeId}`);
      return;
    }

    if (node.grantsPocket) {
      state.setHasPocket(true);
    }

    if (this.storyView) {
      this.storyView.classList.remove('hidden');
    }
    if (this.investigationView) {
      this.investigationView.classList.remove('is-leaving');
      this.investigationView.classList.add('hidden');
    }

    const episode = STORY_EPISODES[node.episodeId];
    const epIndicator = document.getElementById('viewer-episode-title');
    const chIndicator = document.getElementById('viewer-chapter-title');
    if (epIndicator) epIndicator.textContent = episode?.title || node.title;
    if (chIndicator) chIndicator.textContent = node.chapter;

    const contentContainer = document.getElementById('story-content');
    if (!contentContainer) return;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    let html = `
      <header class="story-node-header">
        <span class="chapter-badge">${escapeHtml(node.chapter)}</span>
        <h2 class="node-title">${escapeHtml(node.title)}</h2>
      </header>
      <div class="novel-paragraphs">
    `;

    node.paragraphs.forEach((p, idx) => {
      html += this.parseStoryParagraph(p, idx, node.id);
    });

    html += `</div><section class="story-choices-container"><h3 class="choices-heading">선택지</h3><div class="choices-list">`;

    node.choices.forEach((choice, index) => {
      const evaluation = this.evaluateCondition(choice.condition);
      const disabledAttr = evaluation.met ? '' : 'disabled aria-disabled="true"';
      const disabledClass = evaluation.met ? '' : 'is-disabled';
      const badgeHtml = choice.requirementText
        ? `<span class="choice-requirement ${evaluation.met ? 'req-met' : 'req-unmet'}">${escapeHtml(choice.requirementText)}</span>`
        : '';

      const lockIcon = evaluation.met ? '➔' : '🔒';
      const tooltipBubble = choice.desc
        ? `<div class="choice-tooltip-bubble" role="tooltip">${escapeHtml(choice.desc)}</div>`
        : '';
      const hintBadge = choice.desc
        ? `<span class="choice-hint-badge" title="상세 설명 보기">ℹ️ 힌트</span>`
        : '';

      html += `
        <button type="button" class="story-choice-btn ${disabledClass}" data-choice-index="${index}" ${disabledAttr}>
          <div class="choice-main">
            <span class="choice-marker">${lockIcon}</span>
            <span class="choice-text">${escapeHtml(choice.text)}</span>
          </div>
          ${choice.desc ? `
            <div class="choice-desc-subline">
              <span class="choice-desc-icon">💬</span>
              <span class="choice-desc-text" data-typewriter="${escapeHtml(choice.desc)}"></span>
            </div>
          ` : ''}
          ${badgeHtml}
          ${!evaluation.met ? `<div class="choice-unmet-reason">${escapeHtml(evaluation.reason)}</div>` : ''}
        </button>
      `;
    });

    html += `</div></section>`;
    contentContainer.innerHTML = html;

    const typewriters = contentContainer.querySelectorAll('.choice-desc-text[data-typewriter]');
    typewriters.forEach((el, tIdx) => {
      const fullText = el.getAttribute('data-typewriter') || '';
      el.textContent = '';
      let charIdx = 0;
      const startDelay = 120 + tIdx * 100;
      setTimeout(() => {
        const cursor = document.createElement('span');
        cursor.className = 'choice-typewriter-cursor';
        cursor.textContent = '|';
        el.appendChild(cursor);

        const timer = setInterval(() => {
          if (charIdx < fullText.length) {
            cursor.before(fullText.charAt(charIdx));
            charIdx++;
          } else {
            clearInterval(timer);
            setTimeout(() => {
              cursor.style.opacity = '0';
              setTimeout(() => cursor.remove(), 400);
            }, 800);
          }
        }, 22);
      }, startDelay);
    });

    const choiceButtons = contentContainer.querySelectorAll('.story-choice-btn');
    choiceButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.choiceIndex, 10);
        this.selectChoice(node, idx);
      });
    });
  }

  parseStoryParagraph(p, index, nodeId) {
    const trimmed = String(p ?? '').trim();

    // Check item tag: [아이템: itemId_or_name | desc | icon]
    const itemMatch = trimmed.match(/^\[(?:아이템|ITEM)\s*:\s*(.+?)\]$/i);
    if (itemMatch) {
      const parts = itemMatch[1].split('|').map(s => s.trim());
      const rawIdOrName = parts[0] || '미확인 물품';
      
      const existing = INVENTORY_ITEMS.find(i => i.id === rawIdOrName || i.name === rawIdOrName);
      const itemId = existing ? existing.id : (rawIdOrName.startsWith('item_') ? rawIdOrName : `item_${rawIdOrName.replace(/\s+/g, '_')}`);
      const itemName = existing ? existing.name : rawIdOrName;
      const itemDesc = parts[1] || (existing ? existing.desc : '새로운 소지품을 획득했습니다.');
      const itemIcon = parts[2] || (existing ? existing.icon : '🎁');

      const eventKey = `event_item_${nodeId}_${index}_${itemId}`;
      const isNew = !state.getFlag(eventKey);

      if (isNew) {
        state.setFlag(eventKey, true);
        state.addItem({
          id: itemId,
          name: itemName,
          desc: itemDesc,
          icon: itemIcon,
          quantity: 1,
          type: existing ? existing.type : 'item'
        });
        this.playAudio('itemPickup');
        this.showToast(`[${itemName}] 소지품을 획득했습니다!`, 'success', itemIcon.includes('/') ? '🎁' : itemIcon);
      }

      return `
        <div class="story-game-widget widget-item ${isNew ? 'is-new-anim' : ''}">
          <div class="widget-header">
            <span class="widget-badge">🎁 아이템 획득</span>
            <span class="widget-status">${isNew ? '✨ 새로운 소지품!' : '✔️ 획득 완료'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon">${escapeHtml(itemIcon)}</div>
            <div class="widget-details">
              <strong class="widget-name">${escapeHtml(itemName)}</strong>
              <p class="widget-desc">${escapeHtml(itemDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }

    // Check stat tag: [스탯: statName +/-amount | desc]
    const statMatch = trimmed.match(/^\[(?:스탯|STAT)\s*:\s*(.+?)\]$/i);
    if (statMatch) {
      const parts = statMatch[1].split('|').map(s => s.trim());
      const statExpression = parts[0] || '마력 +1';
      const statDesc = parts[1] || '능력치에 변화가 생겼습니다.';

      const expMatch = statExpression.match(/^([^\s+-]+)\s*([+-]?\d+)/);
      let statKey = 'magic';
      let delta = 1;
      let statLabel = '마력';

      const statMap = {
        '마력': 'magic', 'magic': 'magic',
        '관찰력': 'perception', 'perception': 'perception',
        '화술': 'persuasion', 'persuasion': 'persuasion',
        '체력': 'stamina', 'stamina': 'stamina'
      };
      const labelMap = {
        'magic': '마력',
        'perception': '관찰력',
        'persuasion': '화술',
        'stamina': '체력'
      };

      if (expMatch) {
        const rawStat = expMatch[1].trim();
        statKey = statMap[rawStat] || 'magic';
        delta = parseInt(expMatch[2], 10) || 1;
        statLabel = labelMap[statKey] || rawStat;
      }

      const eventKey = `event_stat_${nodeId}_${index}_${statKey}`;
      const isNew = !state.getFlag(eventKey);

      let currentVal = state.getPlayer()?.stats?.[statKey] ?? 0;
      if (isNew) {
        state.setFlag(eventKey, true);
        currentVal = state.modifyStat(statKey, delta);
        this.playAudio('codexUnlock');
        this.showToast(`[${statLabel} ${sign}] 능력이 변동되었습니다!`, 'info', '⚡');
      }

      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      return `
        <div class="story-game-widget widget-stat ${isNew ? 'is-new-anim' : ''}">
          <div class="widget-header">
            <span class="widget-badge">⚡ 능력치 변동</span>
            <span class="widget-status">${isNew ? '✨ 스탯 갱신!' : '✔️ 반영 완료'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon">📈</div>
            <div class="widget-details">
              <strong class="widget-name">${escapeHtml(statLabel)} <span class="stat-delta ${delta >= 0 ? 'delta-pos' : 'delta-neg'}">${sign}</span></strong>
              <p class="widget-desc">${escapeHtml(statDesc)} (현재: ${currentVal})</p>
            </div>
          </div>
        </div>
      `;
    }

    // Check character tag: [인물: charName_or_id | desc | icon]
    const charMatch = trimmed.match(/^\[(?:인물|캐릭터|CHARACTER|PERSON)\s*:\s*(.+?)\]$/i);
    if (charMatch) {
      const parts = charMatch[1].split('|').map(s => s.trim());
      const rawIdOrName = parts[0] || '미지의 인물';
      const existing = CODEX_DATA.find(c => c.category === 'character' && (c.id === rawIdOrName || c.title === rawIdOrName || (c.keywords && c.keywords.includes(rawIdOrName))));
      const charId = existing ? existing.id : (rawIdOrName.startsWith('char_') ? rawIdOrName : `char_${rawIdOrName.replace(/\s+/g, '_')}`);
      const charName = existing ? existing.title : rawIdOrName;
      const charDesc = parts[1] || (existing ? (existing.summary || existing.description) : '새로운 인물과 조우했습니다.');
      const charIcon = parts[2] || (existing ? existing.icon : '👤');

      if (!existing) {
        CODEX_DATA.push({
          id: charId,
          category: 'character',
          title: charName,
          icon: charIcon,
          summary: charDesc,
          description: parts[1] || charDesc,
          relatedEpisode: 'ep1',
          unlockedByDefault: false,
          keywords: [charName]
        });
      }

      const eventKey = `event_char_${nodeId}_${index}_${charId}`;
      const isNew = !state.getFlag(eventKey);

      if (isNew) {
        state.setFlag(eventKey, true);
        state.unlockCodex(charId);
        this.playAudio('codexUnlock');
        this.showToast(`[${charName}] 인물 도감에 새로운 인물이 등록되었습니다!`, 'info', charIcon.includes('/') ? '👤' : charIcon);
      }

      return `
        <div class="story-game-widget widget-character ${isNew ? 'is-new-anim' : ''}">
          <div class="widget-header">
            <span class="widget-badge" style="background:#1E293B; color:#60A5FA; border:1px solid rgba(96, 165, 250, 0.4);">👤 인물 등록</span>
            <span class="widget-status">${isNew ? '✨ 새 인물 등록!' : '✔️ 도감 등록됨'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon" style="background:rgba(30, 41, 59, 0.85); color:#60A5FA; border-radius:50%; width:44px; height:44px; display:grid; place-items:center; font-size:22px; border:2px solid #60A5FA; overflow:hidden;">${charIcon.includes('/') ? `<img src="${escapeHtml(charIcon)}" style="width:100%; height:100%; object-fit:contain; border-radius:50%;">` : escapeHtml(charIcon)}</div>
            <div class="widget-details">
              <strong class="widget-name">${escapeHtml(charName)}</strong>
              <p class="widget-desc">${escapeHtml(charDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }

    // Check topic tag: [주제: topicTitle_or_id | desc | icon]
    const topicMatch = trimmed.match(/^\[(?:주제|TOPIC)\s*:\s*(.+?)\]$/i);
    if (topicMatch) {
      const parts = topicMatch[1].split('|').map(s => s.trim());
      const rawIdOrTitle = parts[0] || '미지의 사건';
      const existing = CODEX_DATA.find(c => c.id === rawIdOrTitle || c.title === rawIdOrTitle);
      const topicId = existing ? existing.id : (rawIdOrTitle.startsWith('clue_') ? rawIdOrTitle : `clue_${rawIdOrTitle.replace(/\s+/g, '_')}`);
      const topicTitle = existing ? existing.title : (parts[1] || rawIdOrTitle);
      const topicDesc = parts[2] || (existing ? (existing.summary || existing.description) : '새로운 수사 주제가 등록되었습니다.');
      const topicIcon = parts[3] || (existing ? existing.icon : '🗂️');

      const eventKey = `event_topic_${nodeId}_${index}_${topicId}`;
      const isNew = !state.getFlag(eventKey);

      if (isNew) {
        state.setFlag(eventKey, true);
        state.unlockCodex(topicId);
        this.playAudio('codexUnlock');
      }

      return `
        <div class="story-game-widget widget-topic ${isNew ? 'is-new-anim' : ''}">
          <div class="widget-header">
            <span class="widget-badge" style="background:#1E293B; color:#F59E0B; border:1px solid rgba(245, 158, 11, 0.4);">🗂️ 수사 주제 등록</span>
            <span class="widget-status">${isNew ? '✨ 새 주제!' : '✔️ 수첩 등록됨'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon">${escapeHtml(topicIcon)}</div>
            <div class="widget-details">
              <strong class="widget-name">${escapeHtml(topicTitle)}</strong>
              <p class="widget-desc">${escapeHtml(topicDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }

    // Check clue tag: [단서: clueName | parentTopic | desc]
    const clueMatch = trimmed.match(/^\[(?:단서|CLUE|조건|단서조건)\s*:\s*(.+?)\]$/i);
    if (clueMatch) {
      const parts = clueMatch[1].split('|').map(s => s.trim());
      const rawClueName = parts[0];
      const parentName = parts[1] || '';
      const clueDesc = parts[2] || '';

      // Find matching subClue across CODEX_DATA
      let matchedParent = null;
      let matchedClue = null;

      for (const entry of CODEX_DATA) {
        if (parentName && entry.title !== parentName && entry.id !== parentName) continue;
        const found = (entry.subClues || []).find(sc => sc.id === rawClueName || sc.label === rawClueName);
        if (found) {
          matchedParent = entry;
          matchedClue = found;
          break;
        }
      }

      if (!matchedClue) {
        for (const entry of CODEX_DATA) {
          const found = (entry.subClues || []).find(sc => sc.id === rawClueName || sc.label === rawClueName);
          if (found) {
            matchedParent = entry;
            matchedClue = found;
            break;
          }
        }
      }

      // If not a subClue, check if matching a major entry
      if (!matchedClue) {
        const majorEntry = CODEX_DATA.find(c => c.id === rawClueName || c.title === rawClueName);
        if (majorEntry) {
          const topicId = majorEntry.id;
          const eventKey = `event_clue_${nodeId}_${index}_${topicId}`;
          const isNew = !state.getFlag(eventKey);
          if (isNew) {
            state.setFlag(eventKey, true);
            state.unlockCodex(topicId);
            this.playAudio('codexUnlock');
          }
          return `
            <div class="story-game-widget widget-topic ${isNew ? 'is-new-anim' : ''}">
              <div class="widget-header">
                <span class="widget-badge" style="background:#1E293B; color:#F59E0B; border:1px solid rgba(245, 158, 11, 0.4);">🗂️ 수사 주제 등록</span>
                <span class="widget-status">${isNew ? '✨ 새 주제!' : '✔️ 수첩 등록됨'}</span>
              </div>
              <div class="widget-body">
                <div class="widget-icon">${escapeHtml(majorEntry.icon || '🗂️')}</div>
                <div class="widget-details">
                  <strong class="widget-name">${escapeHtml(majorEntry.title)}</strong>
                  <p class="widget-desc">${escapeHtml(parts[1] || majorEntry.summary || majorEntry.description)}</p>
                </div>
              </div>
            </div>
          `;
        }
      }

      const clueId = matchedClue ? matchedClue.id : (rawClueName.startsWith('sc_') ? rawClueName : `sc_${rawClueName.replace(/\s+/g, '_')}`);
      const clueLabel = matchedClue ? matchedClue.label : rawClueName;
      const displayParentTitle = matchedParent ? matchedParent.title : (parentName || '수사 주제');
      const displayDesc = clueDesc || (matchedClue ? (matchedClue.desc || matchedClue.conditionDesc) : '수사에 필요한 새로운 단서를 획득했습니다.');

      const eventKey = `event_cluecond_${nodeId}_${index}_${clueId}`;
      const isNew = !state.getFlag(eventKey);

      if (isNew) {
        state.setFlag(eventKey, true);
        state.unlockClueCondition(clueId);
        if (matchedParent) {
          state.unlockCodex(matchedParent.id);
        }
        this.playAudio('codexUnlock');
      }

      return `
        <div class="story-game-widget widget-clue ${isNew ? 'is-new-anim' : ''}">
          <div class="widget-header">
            <span class="widget-badge" style="background:#2D323F; color:#D4AF37; border:1px solid rgba(212, 175, 55, 0.6);">🔘 단서 발견</span>
            <span class="widget-status">${isNew ? '✨ 새 단서 획득!' : '✔️ 메모 보드 등록됨'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon" style="background:rgba(45, 50, 63, 0.85); color:#D4AF37; border-radius:50%; width:44px; height:44px; display:grid; place-items:center; font-size:20px; border:2px solid #D4AF37;">🔘</div>
            <div class="widget-details">
              <strong class="widget-name">${escapeHtml(clueLabel)} <span style="font-size:11px; font-weight:600; padding:2px 6px; background:rgba(0,0,0,0.25); border-radius:4px; color:var(--text-muted); margin-left:6px;">주제: ${escapeHtml(displayParentTitle)}</span></strong>
              <p class="widget-desc">${escapeHtml(displayDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }

    // Check tile record tag: [기록: tileName | recordId | text] or [기록: tileName | text] or [기록: recordId]
    const recordMatch = trimmed.match(/^\[(?:기록|정보|RECORD|INFO)\s*:\s*(.+?)\]$/i);
    if (recordMatch) {
      const parts = recordMatch[1].split('|').map(s => s.trim());
      let targetTile = null;
      let targetRecord = null;
      let recordId = '';
      let recordText = '';

      if (parts.length === 1) {
        const query = parts[0];
        for (const entry of CODEX_DATA) {
          for (const sub of (entry.subItems || [])) {
            const rec = (sub.records || []).find(r => r.id === query);
            if (rec) {
              targetTile = sub;
              targetRecord = rec;
              recordId = rec.id;
              recordText = rec.text;
              break;
            }
          }
          if (targetTile) break;
        }
        if (!targetTile) {
          recordId = `rec_${query.replace(/\s+/g, '_')}`;
          recordText = query;
        }
      } else if (parts.length === 2) {
        const tileQuery = parts[0];
        const detailQuery = parts[1];
        for (const entry of CODEX_DATA) {
          const sub = (entry.subItems || []).find(s => s.id === tileQuery || s.label === tileQuery);
          if (sub) {
            targetTile = sub;
            const rec = (sub.records || []).find(r => r.id === detailQuery);
            if (rec) {
              targetRecord = rec;
              recordId = rec.id;
              recordText = rec.text;
            } else {
              recordId = `rec_${tileQuery}_${detailQuery.slice(0, 10).replace(/\s+/g, '_')}`;
              recordText = detailQuery;
            }
            break;
          }
        }
        if (!targetTile) {
          recordId = `rec_${tileQuery}_${detailQuery.slice(0, 10).replace(/\s+/g, '_')}`;
          recordText = detailQuery;
        }
      } else {
        const tileQuery = parts[0];
        for (const entry of CODEX_DATA) {
          const sub = (entry.subItems || []).find(s => s.id === tileQuery || s.label === tileQuery);
          if (sub) { targetTile = sub; break; }
        }
        recordId = parts[1];
        recordText = parts[2];
      }

      const eventKey = `event_rec_${nodeId}_${index}_${recordId}`;
      const isNew = !state.getFlag(eventKey);

      if (isNew) {
        state.setFlag(eventKey, true);
        state.unlockTileRecord(recordId, {
          tileId: targetTile ? targetTile.id : parts[0],
          text: recordText
        });
        this.playAudio('codexUnlock');
      }

      const targetTileLabel = targetTile ? targetTile.label : parts[0];

      return `
        <div class="story-game-widget widget-record ${isNew ? 'is-new-anim' : ''}">
          <div class="widget-header">
            <span class="widget-badge" style="background:#1E293B; color:#60A5FA; border:1px solid rgba(96, 165, 250, 0.4);">📝 추가 조사 기록</span>
            <span class="widget-status">${isNew ? '✨ 새 정보 기록!' : '✔️ 수첩에 기록됨'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon" style="background:rgba(30, 41, 59, 0.85); color:#60A5FA; border-radius:50%; width:44px; height:44px; display:grid; place-items:center; font-size:20px; border:2px solid #60A5FA;">📝</div>
            <div class="widget-details">
              <strong class="widget-name">${escapeHtml(targetTileLabel)}</strong>
              <p class="widget-desc">${escapeHtml(recordText)}</p>
            </div>
          </div>
        </div>
      `;
    }

    return `<p class="novel-p">${escapeHtml(p)}</p>`;
  }

  evaluateCondition(condition) {
    if (!condition) return { met: true };

    const player = state.getPlayer();

    if (condition.stat) {
      for (const [statKey, reqVal] of Object.entries(condition.stat)) {
        const currentVal = player.stats[statKey] || 0;
        if (currentVal < reqVal) {
          const statNames = { perception: '관찰력', magic: '마력', persuasion: '화술', stamina: '체력' };
          const name = statNames[statKey] || statKey;
          return {
            met: false,
            reason: `[조건 미달] ${name} ${reqVal} 이상 필요 (현재: ${currentVal})`
          };
        }
      }
    }

    if (condition.hasItem) {
      if (!state.hasItem(condition.hasItem)) {
        const itemObj = CODEX_DATA.find(c => c.id === condition.hasItem);
        const name = itemObj ? itemObj.title : (condition.hasItem === 'item_ritual_journal' ? '봉인된 의식의 일지' : '특정 아이템');
        return {
          met: false,
          reason: `[아이템 필요] [${name}] 소지 필요`
        };
      }
    }

    if (condition.flag) {
      if (!state.getFlag(condition.flag)) {
        return {
          met: false,
          reason: `[단서 필요] 현장 조사에서 관련 정보 미확보`
        };
      }
    }

    return { met: true };
  }

  selectChoice(node, choiceIndex) {
    const choice = node.choices[choiceIndex];
    if (!choice) return;

    this.playAudio('click');

    if (choice.effects) {
      const eff = choice.effects;
      if (eff.rewardStat) {
        for (const [st, val] of Object.entries(eff.rewardStat)) {
          state.modifyStat(st, val);
        }
      }
      if (eff.unlockCodex) {
        state.unlockCodex(eff.unlockCodex);
        this.playAudio('codexUnlock');
      }
      if (eff.toast) {
        this.showToast(eff.toast, 'success', '✨');
      }
    }

    if (choice.isResetTrigger) {
      state.reset();
      this.showToast('게임 데이터가 초기화되었습니다. 처음부터 다시 시작합니다.', 'info', '🔄');
      this.renderStoryNode('ep1_pocket_intro');
      return;
    }

    if (choice.isInvestigationTrigger) {
      const locId = choice.locationId || state.getCurrentLocationId();
      state.setMode('investigation', locId);
      this.startInvestigation(locId);
      return;
    }

    if (choice.nextNode) {
      state.setCurrentNode(choice.nextNode);
      this.renderStoryNode(choice.nextNode);
    }
  }

  startInvestigation(locationId) {
    const scene = INVESTIGATION_SCENES[locationId];
    if (!scene) {
      console.error(`Investigation scene not found for location: ${locationId}`);
      return;
    }

    if (this.leaveTimeoutId !== null) {
      clearTimeout(this.leaveTimeoutId);
      this.leaveTimeoutId = null;
    }

    if (this.storyView) {
      this.storyView.classList.add('hidden');
    }
    if (this.investigationView) {
      this.investigationView.classList.remove('is-leaving');
      this.investigationView.classList.remove('hidden');
    }
    this.isLeavingInvestigation = false;

    const titleEl = document.getElementById('investigation-title');
    const subtitleEl = document.getElementById('investigation-subtitle');
    if (titleEl) titleEl.textContent = scene.title;
    if (subtitleEl) subtitleEl.textContent = scene.subtitle;

    this.renderSceneIllustration(scene);
    this.renderHotspots(scene);

    const leaveButton = document.getElementById('leave-investigation-btn');
    if (leaveButton) {
      leaveButton.disabled = false;
      leaveButton.onclick = () => this.leaveInvestigation(scene);
    }
  }

  leaveInvestigation(scene) {
    if (this.isLeavingInvestigation) return;
    this.isLeavingInvestigation = true;
    this.playAudio('click');
    if (this.investigationView) {
      this.investigationView.classList.add('is-leaving');
    }
    const leaveButton = document.getElementById('leave-investigation-btn');
    if (leaveButton) leaveButton.disabled = true;

    this.leaveTimeoutId = setTimeout(() => {
      const nextNode = scene.exitStoryNode || 'ep1_return_from_investigation';
      state.setMode('story');
      state.setCurrentNode(nextNode);
      this.renderStoryNode(nextNode);
      this.isLeavingInvestigation = false;
      this.leaveTimeoutId = null;
    }, 240);
  }

  renderSceneIllustration(scene) {
    if (!this.sceneCanvas) return;

    if (scene.bgImage) {
      this.sceneCanvas.innerHTML = `
        <div class="investigation-bg-wrapper">
          <img src="${escapeHtml(scene.bgImage)}" alt="${escapeHtml(scene.title)}" class="investigation-bg-image" />
          <div class="investigation-bg-vignette"></div>
        </div>
      `;
      return;
    }

    const sketches = {
      library: `
        <g stroke="#111111" stroke-width="4" fill="#FAFAFA">
          <path d="M38 52H962V462H38Z" fill="none"/>
          <path d="M38 462H962M38 480L962 480M55 462L110 590M210 462L240 590M420 462L400 590M620 462L650 590M810 462L770 590M940 462L890 590" fill="none" stroke-width="2"/>
          <path d="M397 219V123Q500 -12 603 123V219Z" fill="#FFFFFF"/>
          <path d="M397 123Q500 -12 603 123M500 52V219M397 155H603" fill="none" stroke-width="3"/>
          <rect x="65" y="130" width="190" height="300" rx="2"/>
          <path d="M65 205H255M65 280H255M65 355H255M65 430H255" fill="none"/>
          <path d="M83 135V198M105 145V198M128 132V198M151 140V198M175 130V198M198 144V198M220 137V198M84 210V273M107 216V273M132 208V273M158 218V273M183 209V273M208 214V273M231 209V273M83 287V348M108 291V348M136 283V348M160 293V348M185 284V348M210 290V348M230 286V348M84 362V423M110 367V423M137 360V423M161 370V423M189 361V423M215 366V423" fill="none" stroke-width="3"/>
          <rect x="745" y="130" width="190" height="300" rx="2"/>
          <path d="M745 205H935M745 280H935M745 355H935M745 430H935" fill="none"/>
          <path d="M765 135V198M790 141V198M817 132V198M844 146V198M871 134V198M900 142V198M766 211V273M795 216V273M824 208V273M852 219V273M882 209V273M911 215V273M767 286V348M796 292V348M825 283V348M854 295V348M884 285V348M913 291V348" fill="none" stroke-width="3"/>
          <path d="M277 362L430 362L414 405H262ZM287 405V515M397 405V515M278 434H310V452H278ZM278 462H310V480H278Z"/>
          <path d="M464 382H536L526 448H474ZM452 382H548L536 398H464Z"/>
          <path d="M478 367L522 367M500 350V367" fill="none" stroke-width="3"/>
          <path d="M270 555Q300 519 330 555M260 562H340" fill="none" stroke-width="3"/>
          <path d="M700 52V462M690 52H710" fill="none" stroke-width="3"/>
          <path d="M32 460L52 450M70 470L91 460M122 469L145 459M322 473L343 463M540 472L563 462M900 474L921 464" fill="none" stroke-width="2"/>
        </g>`,
      clocktower: `
        <g stroke="#111111" stroke-width="4" fill="#FAFAFA">
          <path d="M38 52H962V462H38Z" fill="none"/>
          <path d="M190 462V181Q500 -70 810 181V462Z"/>
          <circle cx="520" cy="185" r="112" fill="#FFFFFF"/>
          <circle cx="520" cy="185" r="96" fill="none" stroke-width="2"/>
          <path d="M520 82V101M520 269V288M417 185H436M604 185H623M447 112L460 125M580 245L593 258M593 112L580 125M460 245L447 258" fill="none" stroke-width="5"/>
          <path d="M520 185V119M520 185L572 212" fill="none" stroke-width="6"/>
          <circle cx="520" cy="185" r="8" fill="#111111"/>
          <path d="M38 462H962M190 386H810M240 386V462M760 386V462" fill="none"/>
          <path d="M205 490H795M245 515H755M285 540H715M325 565H675" fill="none" stroke-width="3"/>
          <path d="M200 490L180 510H820L800 490M240 515L220 535H780L760 515M280 540L260 560H740L720 540" fill="none" stroke-width="2"/>
          <path d="M95 80V440M905 80V440M95 90H150M850 90H905" fill="none" stroke-width="3"/>
        </g>`,
      garden: `
        <g stroke="#111111" stroke-width="4" fill="#FAFAFA">
          <path d="M38 52H962V462H38Z" fill="none"/>
          <path d="M110 462V225Q500 -58 890 225V462ZM160 462V242Q500 4 840 242V462" fill="none"/>
          <path d="M500 35V462M160 242H840M250 174V462M750 174V462M110 330H890" fill="none" stroke-width="3"/>
          <path d="M38 462H962M75 484L925 484M130 510L870 510M195 536L805 536M270 562L730 562" fill="none" stroke-width="2"/>
          <path d="M175 462Q150 396 186 350Q220 407 175 462ZM202 462Q196 390 244 363Q256 425 202 462ZM340 462Q301 400 331 348Q381 398 340 462ZM360 462Q365 394 416 380Q416 440 360 462ZM650 462Q620 399 654 350Q698 406 650 462ZM678 462Q685 395 733 371Q733 433 678 462ZM800 462Q775 399 810 357Q853 412 800 462Z"/>
          <path d="M150 462H220L210 505H160ZM315 462H385L375 505H325ZM625 462H695L685 505H635ZM780 462H850L840 505H790Z"/>
          <path d="M179 349Q188 323 205 307M343 348Q350 322 370 304M655 350Q663 323 682 308M811 357Q822 330 840 318" fill="none" stroke-width="2"/>
          <path d="M480 462Q500 420 520 462M460 462H540" fill="none" stroke-width="3"/>
        </g>`,
      laboratory: `
        <g stroke="#111111" stroke-width="4" fill="#FAFAFA">
          <path d="M38 52H962V462H38Z" fill="none"/>
          <rect x="80" y="96" width="230" height="300"/>
          <path d="M80 190H310M80 290H310M190 96V396" fill="none"/>
          <path d="M112 130V180H148V130ZM220 126V180H267V126ZM116 220V280H154V220ZM222 218V280H269V218ZM116 322V380H156V322ZM224 318V380H270V318Z"/>
          <path d="M142 130H118M253 126H235M144 220H126M251 218H235" fill="none" stroke-width="3"/>
          <rect x="680" y="96" width="230" height="300"/>
          <path d="M680 190H910M680 290H910M795 96V396" fill="none"/>
          <path d="M714 130V180H752V130ZM826 126V180H873V126ZM714 220V280H752V220ZM826 218V280H873V218ZM714 322V380H754V322ZM826 318V380H874V318Z"/>
          <path d="M265 370L740 370L710 433H295Z"/>
          <path d="M320 433V535M685 433V535M295 535H710M368 371V335H420V371M582 371V335H635V371" fill="none"/>
          <circle cx="500" cy="310" r="68" fill="none" stroke-width="2"/>
          <path d="M500 242V378M432 310H568M452 262L548 358M548 262L452 358" fill="none" stroke-width="2"/>
          <path d="M38 462H962M65 495L935 495M110 530L890 530M180 565L820 565" fill="none" stroke-width="2"/>
        </g>`
    };
    const sketch = sketches[scene.layout] || sketches.library;

    this.sceneCanvas.innerHTML = `
      <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" class="investigation-svg" role="img" aria-label="${escapeHtml(scene.title)}의 흑백 건축 스케치">
        <defs>
          <pattern id="paperGrain" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="3" r="0.7" fill="#111111" opacity="0.08"/>
            <circle cx="9" cy="8" r="0.55" fill="#111111" opacity="0.06"/>
          </pattern>
          <pattern id="floorHatch" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M-3 3L3 -3M0 12L12 0M9 15L15 9" fill="none" stroke="#111111" stroke-width="0.7" opacity="0.16"/>
          </pattern>
        </defs>
        <rect width="1000" height="600" fill="#FFFFFF"/>
        <rect width="1000" height="600" fill="url(#paperGrain)"/>
        <rect x="20" y="24" width="960" height="552" fill="#FAFAFA" stroke="#111111" stroke-width="3"/>
        <rect x="24" y="462" width="952" height="110" fill="url(#floorHatch)"/>
        ${sketch}
      </svg>
    `;
  }

  renderHotspots(scene) {
    if (!this.hotspotsLayer) return;
    this.hotspotsLayer.innerHTML = '';

    (scene.hotspots || []).forEach((hs) => {
      const isCollected = state.isHotspotCollected(hs.id);

      const spot = document.createElement('button');
      spot.type = 'button';
      spot.className = `investigation-hotspot hotspot-type-${hs.type} ${isCollected ? 'is-collected' : ''}`;
      spot.style.left = `${hs.coords.x}%`;
      spot.style.top = `${hs.coords.y}%`;
      spot.dataset.id = hs.id;
      spot.setAttribute('aria-label', hs.type === 'character'
        ? `${hs.characterName || hs.title}와 대화하기`
        : `${hs.title} (${isCollected ? '조사 완료' : '조사하기'})`);

      let icon = hs.icon || '🔍';
      if (isCollected) {
        icon = '✓';
      }

      const hotspotMarker = hs.type === 'character'
        ? `
          <span class="hotspot-character-art">
            ${hs.image
              ? `<img class="hotspot-character-image" src="${escapeHtml(hs.image)}" alt="">`
              : `<svg class="hotspot-character-placeholder" viewBox="0 0 64 112" aria-hidden="true">
                  <circle cx="32" cy="15" r="9" fill="#FFFFFF" stroke="#111111" stroke-width="2.5"/>
                  <path d="M23 29Q32 24 41 29L47 63L42 82H22L17 63Z" fill="#FAFAFA" stroke="#111111" stroke-width="2.5" stroke-linejoin="round"/>
                  <path d="M21 34L10 58M43 34L54 58M27 82L23 108M37 82L41 108" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round"/>
                  <path d="M24 39L32 46L40 39M28 52H36M24 65H40" fill="none" stroke="#111111" stroke-width="1.5"/>
                </svg>`}
          </span>
          <span class="hotspot-character-badge" aria-hidden="true">!</span>
        `
        : `
          <span class="hotspot-pin">
            <span class="hotspot-icon">${escapeHtml(icon)}</span>
          </span>
        `;

      spot.innerHTML = `
        <span class="hotspot-pulse"></span>
        ${hotspotMarker}
        <span class="hotspot-tooltip">${escapeHtml(hs.title)} ${isCollected ? '<span class="status-checked">[완료]</span>' : ''}</span>
      `;

      spot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.interactHotspot(hs, spot);
      });

      this.hotspotsLayer.appendChild(spot);
    });
  }

  interactHotspot(hs, spotElement) {
    this.playAudio('click');
    const isCollected = state.isHotspotCollected(hs.id);
    const linkedMemoId = hs.memoId !== undefined
      ? hs.memoId
      : (hs.codexId || hs.unlockedCodexId || (hs.type === 'character' ? hs.characterId : ''));

    // 탐사 핫스팟에 연결된 세부 타일 추가 기록 해금 검사
    const targetRecordId = hs.recordId || hs.unlockedRecordId;
    if (targetRecordId) {
      if (state.unlockTileRecord(targetRecordId, { tileId: hs.tileId, text: hs.recordText })) {
        this.playAudio('codexUnlock');
        this.showToast('📝 새로운 조사 기록이 세부 타일에 추가되었습니다!', 'info', '📝');
      }
    }

    if (hs.type === 'character') {
      const isAlreadyUnlocked = linkedMemoId ? state.isCodexUnlocked(linkedMemoId) : false;
      let isFirstEncounter = false;
      if (linkedMemoId) {
        isFirstEncounter = state.unlockCodex(linkedMemoId);
      }
      this.playAudio('codexUnlock');
      this.showToast(`[${hs.characterName || '인물'}] 인물 도감에 등록되었습니다!`, 'success', (hs.icon && !hs.icon.includes('/')) ? hs.icon : '👤');
      this.openCharacterDialogue(hs, isFirstEncounter || !isAlreadyUnlocked);
      return;
    }

    if (hs.type === 'interactive') {
      if (isCollected) {
        this.showToast('이미 서랍을 열고 [봉인된 의식의 일지]를 확보했습니다.', 'info', '📓');
        return;
      }

      if (hs.requiresItem && !state.hasItem(hs.requiresItem)) {
        this.showToast(hs.lockedMessage, 'warning', '🔒');
        return;
      }

      state.collectHotspot(hs.id);
      const grantedItem = INVENTORY_ITEMS.find((item) => item.id === hs.grantsItemId) || hs.grantsItem;
      if (grantedItem) {
        state.addItem(grantedItem);
        this.playAudio('itemPickup');
      }
      if (linkedMemoId && state.unlockCodex(linkedMemoId)) {
        this.playAudio('codexUnlock');
      }
      if (hs.unlockedFlag) {
        state.setFlag(hs.unlockedFlag, true);
      }

      this.showToast(hs.unlockedToast, 'success', '✨');
      this.showHotspotModal(hs.title, hs.unlockedText, grantedItem);

      this.markHotspotCollectedInDOM(spotElement);
      return;
    }

    if (hs.type === 'item') {
      if (isCollected) {
        this.showToast('이미 수색을 마친 장소입니다.', 'info', '✓');
        return;
      }

      state.collectHotspot(hs.id);
      const item = INVENTORY_ITEMS.find((catalogItem) => catalogItem.id === hs.itemId) || hs.item;
      if (item) {
        state.addItem(item);
        this.playAudio('itemPickup');
      }
      if (linkedMemoId && state.unlockCodex(linkedMemoId)) {
        this.playAudio('codexUnlock');
      }

      this.showToast(hs.toast, 'success', '🎁');
      this.showHotspotModal(hs.title, hs.inspectText, item);

      this.markHotspotCollectedInDOM(spotElement);
      return;
    }

    if (hs.type === 'inspect') {
      if (linkedMemoId && state.unlockCodex(linkedMemoId)) {
        this.playAudio('codexUnlock');
      }
      if (hs.flag) {
        state.setFlag(hs.flag, true);
      }
      if (!isCollected) {
        state.collectHotspot(hs.id);
        this.showToast(hs.toast, 'success', '🔍');
        this.markHotspotCollectedInDOM(spotElement);
      }

      this.showHotspotModal(hs.title, hs.inspectText);
      return;
    }
  }

  markHotspotCollectedInDOM(spotElement) {
    if (!spotElement) return;
    spotElement.classList.add('is-collected');
    const iconEl = spotElement.querySelector('.hotspot-icon');
    if (iconEl) iconEl.textContent = '✓';
    const tooltip = spotElement.querySelector('.hotspot-tooltip');
    if (tooltip && !tooltip.innerHTML.includes('[완료]')) {
      tooltip.innerHTML += ' <span class="status-checked">[완료]</span>';
    }
  }

  showHotspotModal(title, description, itemGranted = null) {
    const overlay = document.getElementById('inspect-detail-modal');
    if (!overlay) return;

    const titleEl = document.getElementById('inspect-modal-title');
    const descEl = document.getElementById('inspect-modal-desc');
    const rewardBox = document.getElementById('inspect-modal-reward');

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;

    if (rewardBox) {
      if (itemGranted) {
        rewardBox.innerHTML = `
          <div class="reward-pill">
            <span class="reward-icon">${escapeHtml(itemGranted.icon)}</span>
            <div class="reward-info">
              <strong>${escapeHtml(itemGranted.name)}</strong> 획득!
              <span class="reward-sub">소지품에 추가되었습니다.</span>
            </div>
          </div>
        `;
        rewardBox.classList.remove('hidden');
      } else {
        rewardBox.innerHTML = '';
        rewardBox.classList.add('hidden');
      }
    }

    overlay.classList.remove('hidden');

    const closeBtn = document.getElementById('inspect-modal-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        overlay.classList.add('hidden');
      };
    }
  }

  openCharacterDialogue(hs, isFirstEncounter = false) {
    if (!this.dialogueModal) return;
    this.currentDialogueTree = hs.dialogueTree;
    this.currentDialogueNodeKey = 'start';

    const charNameEl = document.getElementById('dialogue-char-name');
    const charRoleEl = document.getElementById('dialogue-char-role');
    const avatarEl = document.querySelector('.dialogue-avatar');
    const badgeEl = document.getElementById('dialogue-char-badge');
    const widgetEl = document.getElementById('dialogue-new-char-widget');

    if (charNameEl) charNameEl.textContent = hs.characterName;
    if (charRoleEl) charRoleEl.textContent = hs.characterRole;
    const avatarSrc = hs.avatar || (hs.icon && hs.icon.includes('/') ? hs.icon : (hs.image && hs.image.includes('/') ? hs.image : ''));
    if (avatarEl) {
      if (avatarSrc) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(hs.characterName || '인물')}" class="dialogue-avatar-img">`;
      } else {
        avatarEl.textContent = hs.icon || '👤';
      }
    }

    if (badgeEl) {
      badgeEl.textContent = isFirstEncounter ? '✨ 새 인물 등록!' : '✔️ 도감 등록 인물';
      badgeEl.style.display = 'inline-flex';
    }

    if (widgetEl) {
      const charCodex = CODEX_DATA.find((c) => c.id === hs.characterId || c.title === hs.characterName);
      const charDesc = hs.characterDesc || hs.desc || charCodex?.summary || charCodex?.description || '인물 도감에 정보가 등록되었습니다.';
      widgetEl.innerHTML = `
        <div class="story-game-widget widget-character ${isFirstEncounter ? 'is-new-anim' : ''}" style="margin: 0 0 12px 0;">
          <div class="widget-header">
            <span class="widget-badge" style="background:#1E293B; color:#60A5FA; border:1px solid rgba(96, 165, 250, 0.4);">👤 인물 등록</span>
            <span class="widget-status">${isFirstEncounter ? '✨ 새 인물 등록!' : '✔️ 도감 등록됨'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon" style="background:rgba(30, 41, 59, 0.85); color:#60A5FA; border-radius:50%; width:44px; height:44px; display:grid; place-items:center; font-size:22px; border:2px solid #60A5FA; overflow:hidden;">
              ${avatarSrc ? `<img src="${escapeHtml(avatarSrc)}" style="width:100%; height:100%; object-fit:contain; border-radius:50%;">` : escapeHtml(hs.icon || '👤')}
            </div>
            <div class="widget-details">
              <strong class="widget-name">${escapeHtml(hs.characterName || '인물')}</strong>
              <p class="widget-desc">${escapeHtml(hs.characterRole ? `${hs.characterRole} · ` : '')}${escapeHtml(charDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }

    this.dialogueModal.classList.remove('hidden');
    this.renderDialogueStep();

    const closeBtn = document.getElementById('dialogue-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.closeCharacterDialogue();
      };
    }
  }

  renderDialogueStep() {
    if (!this.currentDialogueTree || !this.currentDialogueNodeKey) return;
    const node = this.currentDialogueTree[this.currentDialogueNodeKey];
    if (!node) {
      this.closeCharacterDialogue();
      return;
    }

    if (node.effects) {
      if (node.effects.setFlag) {
        state.setFlag(node.effects.setFlag, true);
      }
      if (node.effects.unlockCodex) {
        state.unlockCodex(node.effects.unlockCodex);
        this.playAudio('codexUnlock');
      }
      if (node.effects.rewardStat) {
        for (const [st, val] of Object.entries(node.effects.rewardStat)) {
          state.modifyStat(st, val);
        }
      }
    }

    const textEl = document.getElementById('dialogue-speech-text');
    const optionsContainer = document.getElementById('dialogue-options-list');

    if (textEl) {
      textEl.textContent = node.text;
    }

    if (optionsContainer) {
      optionsContainer.innerHTML = '';

      (node.options || []).forEach((opt) => {
        const evaluation = this.evaluateCondition(opt.condition);
        if (!evaluation.met && opt.condition && opt.condition.hasItem) {
          return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dialogue-option-btn ${evaluation.met ? '' : 'is-locked'}`;
        if (!evaluation.met) {
          btn.disabled = true;
        }

        btn.innerHTML = `
          <span class="opt-bullet">💬</span>
          <span class="opt-text">${escapeHtml(opt.text)}</span>
          ${!evaluation.met ? `<span class="opt-lock-hint">(${escapeHtml(evaluation.reason)})</span>` : ''}
        `;

        btn.addEventListener('click', () => {
          this.playAudio('click');
          if (opt.nextNode === 'exit') {
            this.closeCharacterDialogue();
          } else {
            this.currentDialogueNodeKey = opt.nextNode;
            this.renderDialogueStep();
          }
        });

        optionsContainer.appendChild(btn);
      });
    }
  }

  closeCharacterDialogue() {
    if (this.dialogueModal) {
      this.dialogueModal.classList.add('hidden');
    }
    this.currentDialogueTree = null;
    this.currentDialogueNodeKey = null;
  }
}