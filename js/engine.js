/**
 * Narrative Branching Engine & Layton-Style Investigation Controller
 */

import { state } from './state.js?v=20261121_1420';
import { STORY_EPISODES, STORY_NODES } from './data/storyData.js?v=20261121_1420';
import { INVESTIGATION_SCENES, MAP_LOCATIONS } from './data/mapData.js?v=20261121_1420';
import { CODEX_DATA, INVENTORY_ITEMS } from './data/codexData.js?v=20261121_1420';

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
    this.initExplanationModal();
    this.initBookReader();
  }

  initExplanationModal() {
    const modal = document.getElementById('story-explanation-modal');
    if (!modal) return;
    const closeBtn = document.getElementById('btn-close-explanation');
    const closeXBtn = document.getElementById('btn-close-explanation-x');
    const backdrop = modal.querySelector('.explanation-modal-backdrop');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeExplanationModal());
    }
    if (closeXBtn) {
      closeXBtn.addEventListener('click', () => this.closeExplanationModal());
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeExplanationModal());
    }
  }

  openExplanationModal({ title, content, icon } = {}) {
    const modal = document.getElementById('story-explanation-modal');
    if (!modal) return;
    const titleEl = document.getElementById('explanation-modal-title');
    const iconEl = document.getElementById('explanation-modal-icon');
    const textEl = document.getElementById('explanation-modal-text');

    if (titleEl) titleEl.textContent = title || '상세 설명';
    if (iconEl) iconEl.textContent = icon || '💡';
    if (textEl) {
      const raw = String(content || '');
      const paragraphs = raw.split('\n').map(p => p.trim()).filter(Boolean);
      if (paragraphs.length > 0) {
        textEl.innerHTML = paragraphs.map(p => `<p class="explanation-paragraph">${escapeHtml(p)}</p>`).join('');
      } else {
        textEl.innerHTML = `<p class="explanation-paragraph">${escapeHtml(raw)}</p>`;
      }
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    this.playAudio('click');
  }

  closeExplanationModal() {
    const modal = document.getElementById('story-explanation-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    this.playAudio('click');
  }

  initStoryExplanationWidgets(container) {
    // 팝업 없이 본문 인라인 박스만 표시하도록 처리됨
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

  _getLocationStatus(locId, choiceNode = null) {
    const activeScenes = (typeof INVESTIGATION_SCENES !== 'undefined' ? INVESTIGATION_SCENES : window.INVESTIGATION_SCENES) || {};
    const scene = activeScenes[locId];
    if (scene && Array.isArray(scene.hotspots) && scene.hotspots.length > 0) {
      const total = scene.hotspots.length;
      const collected = scene.hotspots.filter(hs => state.isHotspotCollected(hs.id)).length;
      if (collected >= total) {
        return { status: 'complete', label: '조사 완료 ✓', total, collected };
      }
      if (collected > 0) {
        return { status: 'in-progress', label: `조사 중 ${collected}/${total}`, total, collected };
      }
      if (state.isLocationDiscovered && state.isLocationDiscovered(locId)) {
        return { status: 'visited', label: '방문함', total, collected: 0 };
      }
      return { status: 'unvisited', label: '미방문', total, collected: 0 };
    }

    if (choiceNode) {
      const isVisited = state.hasVisitedNode ? state.hasVisitedNode(choiceNode) : false;
      return isVisited ? { status: 'complete', label: '조사 완료 ✓' } : { status: 'unvisited', label: '미방문' };
    }

    if (locId === 'loc_nebula') {
      const isVisited = state.hasVisitedNode ? state.hasVisitedNode('story_1795180010121') : false;
      return isVisited ? { status: 'complete', label: '조사 완료 ✓' } : { status: 'unvisited', label: '미방문' };
    }

    return { status: 'unvisited', label: '미방문' };
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

    html += `</div>`;

    const currentEp = (state.getCurrentEpisodeId && state.getCurrentEpisodeId()) || 'ep1';
    const activeEpisodes = (typeof STORY_EPISODES !== 'undefined' ? STORY_EPISODES : window.STORY_EPISODES) || {};
    const epHubNode = activeEpisodes[currentEp]?.hubNode || 'story_1795192473432';
    const hasInlineBriefing = (node.paragraphs || []).some((p) =>
      /^\s*\[(?:브리핑카드|브리핑 카드|탐사브리핑|탐사 브리핑|탐사허브|BRIEFING)/i.test(String(p ?? ''))
    );
    const isHub = Boolean(
      node.isHubNode ||
      node.id === epHubNode ||
      node.id === 'story_1795192473432' ||
      (node.chapter && node.chapter.includes('탐사 허브'))
    );

    if (isHub && !hasInlineBriefing) {
      html += this.renderBriefingCardHtml('story_1795161633215', 'clue_herb_quiz');
    }

    const totalChoices = node.choices || [];
    const evaluatedChoices = totalChoices.map((choice, index) => {
      const choiceKey = choice.id || `choice_${node.id}_${index}`;
      const isChosen = Boolean(
        state.getFlag(`chosen_${choiceKey}`) ||
        state.getFlag(`chosen_text_${node.id}_${choice.text.trim()}`) ||
        state.getFlag(`chosen_global_${choice.text.trim()}`) ||
        (choice.nextNode && state.getFlag(`visited_target_${choice.nextNode}`))
      );
      const shouldHide = isChosen && (choice.hideIfChosen === true);
      return { choice, index, isChosen, shouldHide };
    });

    const visibleChoices = evaluatedChoices.filter((item) => !item.shouldHide);
    const finalChoices = visibleChoices.length > 0 ? visibleChoices : evaluatedChoices;

    if (finalChoices.length > 0) {
      html += `<section class="story-choices-container"><h3 class="choices-heading">선택지</h3><div class="choices-list">`;

      if (visibleChoices.length === 0 && evaluatedChoices.length > 0) {
        html += `
          <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 8px; padding: 4px 10px; background: rgba(0,0,0,0.15); border-radius: 6px; display: inline-block;">
            ✔️ 모든 선택지를 확인했습니다. 선택지를 다시 이용할 수 있습니다.
          </div>
        `;
      }

      finalChoices.forEach(({ choice, index }) => {
        const evaluation = this.evaluateCondition(choice.condition);
        const disabledAttr = evaluation.met ? '' : 'disabled aria-disabled="true"';
        let disabledClass = evaluation.met ? '' : 'is-disabled';
        const badgeHtml = choice.requirementText
          ? `<span class="choice-requirement ${evaluation.met ? 'req-met' : 'req-unmet'}">${escapeHtml(choice.requirementText)}</span>`
          : '';

        const isMapChoice = Boolean(
          choice.isOpenMapTrigger ||
          choice.action === 'open_map' ||
          choice.nextNode === 'action:open_map' ||
          choice.mapLocationId ||
          (typeof choice.nextNode === 'string' && choice.nextNode.startsWith('map_loc:'))
        );

        const isConclusion = Boolean(choice.isConclusionChoice);
        const isDeductionSolved = Boolean(state.getFlag('deduction_any_solved'));
        if (isConclusion && isDeductionSolved) {
          disabledClass += ' is-conclusion-ready';
        }

        let lockIcon = evaluation.met ? (isMapChoice ? '🗺️' : '➔') : '🔒';
        let choiceText = choice.text;
        let choiceDesc = choice.desc;

        if (isConclusion) {
          if (isDeductionSolved) {
            lockIcon = '✨';
            choiceText = '✨ 알아냈다! 정답을 맞추러 가자 (결론 도출 완료)';
            choiceDesc = '수첩에서 단서들을 모두 맞춰냈습니다! 이제 교실로 가서 정답을 제출하세요.';
          } else {
            lockIcon = '💡';
            choiceDesc = choiceDesc || '(아직 모든 단서를 확실하게 밝혀내지 못했습니다. 수첩에서 단서들을 짜맞춰보세요.)';
          }
        }

        // Location badge for choice
        let locBadgeHtml = '';
        if (choice.locationId) {
          const stat = this._getLocationStatus(choice.locationId);
          locBadgeHtml = `<span class="choice-loc-status is-${stat.status}">[${escapeHtml(stat.label)}]</span>`;
        } else if (choice.text.includes('네블라 홀') || choice.nextNode === 'story_1795180010121') {
          const stat = this._getLocationStatus('loc_nebula', 'story_1795180010121');
          locBadgeHtml = `<span class="choice-loc-status is-${stat.status}">[${escapeHtml(stat.label)}]</span>`;
        } else if (choice.text.includes('도서관')) {
          const stat = this._getLocationStatus('loc_library');
          locBadgeHtml = `<span class="choice-loc-status is-${stat.status}">[${escapeHtml(stat.label)}]</span>`;
        } else if (choice.text.includes('연구동')) {
          const stat = this._getLocationStatus('loc_lab');
          locBadgeHtml = `<span class="choice-loc-status is-${stat.status}">[${escapeHtml(stat.label)}]</span>`;
        } else if (choice.text.includes('정원')) {
          const stat = this._getLocationStatus('loc_garden');
          locBadgeHtml = `<span class="choice-loc-status is-${stat.status}">[${escapeHtml(stat.label)}]</span>`;
        }

        html += `
          <button type="button" class="story-choice-btn ${disabledClass}" data-choice-index="${index}" ${disabledAttr}>
            <div class="choice-main">
              <span class="choice-marker">${lockIcon}</span>
              <span class="choice-text">${escapeHtml(choiceText)}</span>
              ${locBadgeHtml}
            </div>
            ${choiceDesc ? `
              <div class="choice-desc-subline">
                <span class="choice-desc-icon">💬</span>
                <span class="choice-desc-text">${escapeHtml(choiceDesc)}</span>
              </div>
            ` : ''}
            ${badgeHtml}
            ${!evaluation.met ? `<div class="choice-unmet-reason">${escapeHtml(evaluation.reason)}</div>` : ''}
          </button>
        `;
      });

      html += `</div></section>`;
    }

    contentContainer.innerHTML = html;

    const hubActionBtns = contentContainer.querySelectorAll('[data-hub-action]');
    hubActionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.hubAction;
        if (action === 'open-deduction') {
          const topic = btn.dataset.deductionTopic || 'clue_herb_quiz';
          if (this.onOpenDeduction) {
            this.onOpenDeduction(topic);
          } else {
            window.app?.openDeductionMode?.(topic);
          }
        } else if (action === 'open-map') {
          if (this.onOpenMap) {
            this.onOpenMap();
          } else {
            window.app?.openPocketModal?.('map');
          }
        } else if (action === 'goto-conclusion') {
          const targetNode = btn.dataset.conclusionNode || 'story_1795161633215';
          if (STORY_NODES[targetNode]) {
            state.setMode('story');
            state.setCurrentNode(targetNode);
            this.renderStoryNode(targetNode);
          }
        } else if (action === 'goto-location') {
          const locId = btn.dataset.hubLocId;
          const storyNode = btn.dataset.hubStoryNode;
          const mapLoc = (MAP_LOCATIONS || []).find((l) => l.id === locId);
          if (mapLoc && mapLoc.destinationType === 'story' && mapLoc.targetStoryNode && STORY_NODES[mapLoc.targetStoryNode]) {
            state.setMode('story');
            state.setCurrentNode(mapLoc.targetStoryNode);
            this.renderStoryNode(mapLoc.targetStoryNode);
          } else if (storyNode && STORY_NODES[storyNode] && (!mapLoc || mapLoc.destinationType !== 'investigation')) {
            state.setMode('story');
            state.setCurrentNode(storyNode);
            this.renderStoryNode(storyNode);
          } else if (locId && INVESTIGATION_SCENES[locId]) {
            this.startInvestigation(locId);
          } else if (mapLoc?.targetStoryNode && STORY_NODES[mapLoc.targetStoryNode]) {
            state.setMode('story');
            state.setCurrentNode(mapLoc.targetStoryNode);
            this.renderStoryNode(mapLoc.targetStoryNode);
          }
        }
      });
    });

    const choiceButtons = contentContainer.querySelectorAll('.story-choice-btn[data-choice-index]');
    choiceButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.choiceIndex, 10);
        this.selectChoice(node, idx, btn);
      });
    });

    // Initialize IntersectionObserver Typewriter effects for novel paragraphs
    this.initNovelTypewriters(contentContainer);

    // Initialize Deferred Story Unlocks (IntersectionObserver reveals toasts only when scrolled into view)
    this.initDeferredStoryUnlocks(contentContainer);

    // Initialize Interactive Topic Quizzes (정답 입력창)
    this.initStoryQuizzes(contentContainer);

    // Initialize Story Explanation Popups & Widgets (설명창 팝업)
    this.initStoryExplanationWidgets(contentContainer);
  }

  initStoryQuizzes(container) {
    if (!container) return;
    const quizWidgets = container.querySelectorAll('.story-quiz-widget');
    if (quizWidgets.length === 0) return;

    quizWidgets.forEach((widget) => {
      const advanceBtn = widget.querySelector('.quiz-advance-btn');
      if (advanceBtn) {
        advanceBtn.addEventListener('click', () => {
          const nextNode = advanceBtn.dataset.advanceNode;
          if (nextNode && STORY_NODES[nextNode]) {
            state.setCurrentNode(nextNode);
            this.renderStoryNode(nextNode);
          }
        });
      }

      if (widget.classList.contains('is-solved')) return;

      const input = widget.querySelector('.quiz-text-input');
      const submitBtn = widget.querySelector('.quiz-submit-btn');
      const feedbackBox = widget.querySelector('.quiz-feedback-box');
      if (!input || !submitBtn) return;

      const quizKey = widget.dataset.quizKey;
      const topicId = widget.dataset.quizTopic;
      const successMsg = widget.dataset.quizSuccess || '✨ 정답입니다!';
      const nextNodeId = widget.dataset.quizNext;

      let acceptedAnswers = [];
      try {
        acceptedAnswers = JSON.parse(widget.dataset.quizAnswers || '[]');
      } catch (e) {
        acceptedAnswers = ['달빛 이끼', '달빛이끼'];
      }

      const handleSubmit = () => {
        const rawVal = input.value.trim();
        if (!rawVal) {
          input.classList.remove('is-invalid');
          void input.offsetWidth;
          input.classList.add('is-invalid');
          if (feedbackBox) {
            feedbackBox.style.display = 'block';
            feedbackBox.className = 'quiz-feedback-box is-error';
            feedbackBox.textContent = '정답을 입력해 주세요.';
          }
          return;
        }

        const normInput = rawVal.toLowerCase().replace(/\s+/g, '');
        const isCorrect = acceptedAnswers.some((ans) => {
          return normInput === String(ans).trim().toLowerCase().replace(/\s+/g, '');
        });

        if (isCorrect) {
          this.playAudio('itemPickup');
          state.setFlag(quizKey, true);
          state.setFlag(`ans_${quizKey}`, rawVal);
          state.setFlag(`quiz_cleared_${topicId}`, true);
          if (topicId) state.unlockCodex(topicId);

          this.showToast('수수께끼의 정답을 맞췄습니다!', 'success', '🎉');

          const quizBody = widget.querySelector('.quiz-body');
          const statusPill = widget.querySelector('.quiz-status-pill');
          widget.classList.add('is-solved');
          if (statusPill) statusPill.textContent = '✔️ 정답 확인 완료';

          const nextNode = nextNodeId && STORY_NODES[nextNodeId];

          if (quizBody) {
            quizBody.innerHTML = `
              <div class="quiz-solved-banner">
                <span class="solved-sparkle">🎉</span>
                <div class="solved-info">
                  <strong class="solved-congrats">정답 확인 완료!</strong>
                  <p class="solved-desc">${escapeHtml(successMsg)}</p>
                  <span class="solved-ans-badge">입력했던 정답: <b>${escapeHtml(rawVal)}</b></span>
                </div>
                ${nextNode ? `
                  <button type="button" class="quiz-advance-btn" data-advance-node="${escapeHtml(nextNodeId)}">
                    <span>▶ ${escapeHtml(nextNode.title || '다음 장면으로')}</span>
                  </button>
                ` : ''}
              </div>
            `;
            const newAdvBtn = quizBody.querySelector('.quiz-advance-btn');
            if (newAdvBtn) {
              newAdvBtn.addEventListener('click', () => {
                state.setCurrentNode(nextNodeId);
                this.renderStoryNode(nextNodeId);
              });
            }
          }
        } else {
          this.playAudio('click');
          input.classList.remove('is-invalid');
          void input.offsetWidth;
          input.classList.add('is-invalid');
          if (feedbackBox) {
            feedbackBox.style.display = 'block';
            feedbackBox.className = 'quiz-feedback-box is-error';
            feedbackBox.textContent = '❌ 정답이 아닙니다. 주변 현장에서 수집한 단서를 다시 확인해 보세요.';
          }
          this.showToast('정답이 아닙니다. 다시 시도해 보세요.', 'warning', '❌');
          input.select();
        }
      };

      submitBtn.addEventListener('click', handleSubmit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      });
    });
  }

  initDeferredStoryUnlocks(container) {
    if (!container) return;
    const pendingWidgets = Array.from(container.querySelectorAll('.story-game-widget[data-pending-unlock="true"]'));
    if (pendingWidgets.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      pendingWidgets.forEach((w) => this.executeDeferredUnlock(w));
      return;
    }

    if (!this._unlockObserversByContainer) {
      this._unlockObserversByContainer = new WeakMap();
    }
    const prevObs = this._unlockObserversByContainer.get(container);
    if (prevObs) {
      prevObs.disconnect();
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const widget = entry.target;
          if (widget.dataset.twLockedHidden === 'true' || widget.closest('[data-tw-locked-hidden="true"]')) {
            return;
          }
          this.executeDeferredUnlock(widget);
          obs.unobserve(widget);
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.1
    });

    this._unlockObserversByContainer.set(container, observer);
    pendingWidgets.forEach((w) => observer.observe(w));
  }

  checkPendingUnlocksInElement(element) {
    if (!element) return;
    const widgets = [];
    if (element.matches?.('.story-game-widget[data-pending-unlock="true"]')) {
      widgets.push(element);
    }
    if (element.querySelectorAll) {
      element.querySelectorAll('.story-game-widget[data-pending-unlock="true"]').forEach((w) => widgets.push(w));
    }
    widgets.forEach((widget) => {
      const rect = widget.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        this.executeDeferredUnlock(widget);
      }
    });
  }

  flushPendingStoryUnlocks(container = this.storyView) {
    if (!container) return;
    const pending = Array.from(container.querySelectorAll('.story-game-widget[data-pending-unlock="true"]'));
    pending.forEach((w) => {
      this.executeDeferredUnlock(w);
    });
  }

  executeDeferredUnlock(widget) {
    if (!widget || widget.dataset.pendingUnlock !== 'true') return;
    const eventKey = widget.dataset.unlockEvent;
    if (!eventKey || state.getFlag(eventKey)) {
      widget.removeAttribute('data-pending-unlock');
      widget.classList.remove('is-pending-unlock');
      return;
    }

    state.setFlag(eventKey, true);
    widget.removeAttribute('data-pending-unlock');
    widget.classList.remove('is-pending-unlock');

    const type = widget.dataset.unlockType;
    let payload = {};
    try {
      payload = JSON.parse(widget.dataset.unlockPayload || '{}');
    } catch (e) {
      console.warn('Unlock payload parse error:', e);
    }

    const statusEl = widget.querySelector('[data-widget-status="true"]');

    switch (type) {
      case 'item': {
        state.addItem({
          id: payload.itemId,
          name: payload.itemName,
          desc: payload.itemDesc,
          icon: payload.itemIcon,
          quantity: 1,
          type: payload.itemType || 'item'
        });
        this.playAudio('itemPickup');
        this.showToast(`[${payload.itemName}] 소지품을 획득했습니다!`, 'success', (payload.itemIcon || '').includes('/') ? '🎁' : (payload.itemIcon || '🎁'));
        if (statusEl) statusEl.textContent = '✨ 새로운 소지품!';
        break;
      }
      case 'item_use': {
        const removed = state.removeItem(payload.itemId, 1);
        if (!removed && payload.existingId) {
          state.removeItem(payload.existingId, 1);
        }
        this.playAudio('itemPickup');
        this.showToast(`[${payload.itemName}] 아이템을 사용했습니다. (소지품 소모)`, 'info', (payload.itemIcon || '').includes('/') ? '🎒' : (payload.itemIcon || '🎒'));
        if (statusEl) statusEl.textContent = '✨ 소모 완료 (-1)';
        break;
      }
      case 'stat': {
        const currentVal = state.modifyStat(payload.statKey, payload.delta);
        this.playAudio('codexUnlock');
        const sign = payload.delta >= 0 ? `+${payload.delta}` : `${payload.delta}`;
        this.showToast(`[${payload.statLabel} ${sign}] 능력이 변동되었습니다!`, 'info', '⚡');
        if (statusEl) statusEl.textContent = '✨ 스탯 갱신!';
        const descEl = widget.querySelector('.widget-desc');
        if (descEl) descEl.textContent = `${payload.statDesc} (현재: ${currentVal})`;
        break;
      }
      case 'character': {
        state.unlockCodex(payload.charId, {
          title: payload.charName,
          summary: payload.charDesc,
          description: payload.charDesc,
          icon: payload.charIcon,
          category: 'character'
        });
        this.playAudio('codexUnlock');
        this.showToast(`[${payload.charName}] 인물 도감에 새로운 인물이 등록되었습니다!`, 'info', (payload.charIcon || '').includes('/') ? '👤' : (payload.charIcon || '👤'));
        if (statusEl) statusEl.textContent = '✨ 새 인물 등록!';
        break;
      }
      case 'topic': {
        state.unlockCodex(payload.topicId, {
          title: payload.topicTitle,
          summary: payload.topicDesc,
          description: payload.topicDesc,
          icon: payload.topicIcon,
          category: 'clue'
        });
        this.playAudio('codexUnlock');
        this.showToast(`[${payload.topicTitle}] 단서를 확인했습니다!`, 'info', (payload.topicIcon || '').includes('/') ? '🔍' : (payload.topicIcon || '🔍'));
        if (statusEl) statusEl.textContent = '✨ 새 단서 발견!';
        break;
      }
      case 'clue': {
        state.unlockClueCondition(payload.clueId);
        if (payload.clueLabel && payload.clueLabel !== payload.clueId) {
          state.unlockClueCondition(payload.clueLabel);
        }
        if (payload.matchedClueId && payload.matchedClueId !== payload.clueId) {
          state.unlockClueCondition(payload.matchedClueId);
        }
        if (payload.parentCodexId) {
          state.unlockCodex(payload.parentCodexId);
        }
        this.playAudio('codexUnlock');
        this.showToast(`[${payload.clueLabel}] 단서 조건을 수첩에 등록했습니다!`, 'info', '🔘');
        if (statusEl) statusEl.textContent = '✨ 새 단서 획득!';
        break;
      }
      case 'clue_major': {
        state.unlockCodex(payload.topicId);
        this.playAudio('codexUnlock');
        this.showToast(`[${payload.topicTitle}] 단서를 확인했습니다!`, 'info', (payload.topicIcon || '').includes('/') ? '🔍' : (payload.topicIcon || '🔍'));
        if (statusEl) statusEl.textContent = '✨ 새 단서 발견!';
        break;
      }
      case 'record': {
        state.unlockTileRecord(payload.recordId, {
          tileId: payload.tileId,
          text: payload.recordText
        });
        this.playAudio('codexUnlock');
        if (statusEl) statusEl.textContent = '✨ 새 정보 기록!';
        break;
      }
      case 'subitem': {
        state.setFlag(`unlocked_sub_${payload.subId}`, true);
        if (payload.parentId) {
          state.unlockCodex(payload.parentId);
        }
        this.playAudio('codexUnlock');
        this.showToast(`[${payload.finalLabel}] 발견! (${payload.parentTitle || '수첩'})`, 'info', '⬜');
        if (statusEl) statusEl.textContent = '✨ 새로 등록됨';
        break;
      }
    }

    widget.classList.add('is-new-anim');
  }

  initNovelTypewriters(container) {
    if (!container) return;

    // 1. Direct children list for sequential blocking after each typewriter paragraph
    const paragraphsParent = container.querySelector('.novel-paragraphs') || container;
    const directBlocks = Array.from(paragraphsParent.children);
    const hasAnyTypewriter = container.querySelector('[data-typewriter-paragraph="true"], [data-inline-typewriter="true"]');
    if (!hasAnyTypewriter) return;

    // Extra sections below .novel-paragraphs (e.g. .hub-dashboard, .story-choices-container)
    const trailingSections = paragraphsParent !== container
      ? Array.from(container.children).filter(
          (ch) => ch !== paragraphsParent && !ch.classList.contains('story-node-header')
        )
      : [];

    const allSequentialBlocks = [...directBlocks, ...trailingSections];

    // Helper: check if a block is or contains a typewriter target
    const getTypewriterTargetsInBlock = (block) => {
      if (!block || block.nodeType !== Node.ELEMENT_NODE) return [];
      const list = [];
      if (block.matches('[data-typewriter-paragraph="true"], [data-inline-typewriter="true"]')) {
        list.push(block);
      }
      block.querySelectorAll('[data-typewriter-paragraph="true"], [data-inline-typewriter="true"]').forEach((el) => {
        if (!list.includes(el)) list.push(el);
      });
      return list;
    };

    // Helper: traverse text nodes and wrap each character in a hidden span
    const wrapCharacters = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text) return;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const span = document.createElement('span');
          span.className = 'novel-tw-char';
          span.textContent = char;
          span.style.opacity = '0';
          fragment.appendChild(span);
        }
        node.parentNode.replaceChild(fragment, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.classList.contains('novel-typewriter-cursor')) return;
        const children = Array.from(node.childNodes);
        children.forEach((child) => wrapCharacters(child));
      }
    };

    // Prepare every typewriter element first
    const allTwElements = Array.from(
      container.querySelectorAll('[data-typewriter-paragraph="true"], [data-inline-typewriter="true"]')
    );

    allTwElements.forEach((el) => {
      if (el.dataset.twInitialized === 'true') return;
      el.dataset.twInitialized = 'true';
      wrapCharacters(el);

      const allChars = Array.from(el.querySelectorAll('.novel-tw-char'));
      const cursor = document.createElement('span');
      cursor.className = 'novel-typewriter-cursor';
      cursor.textContent = '|';
      cursor.style.opacity = '0';
      el.appendChild(cursor);

      el._twChars = allChars;
      el._twCursor = cursor;
      el._twOnCompleteCallbacks = [];

      el._finishTyping = () => {
        if (el.dataset.twCompleted === 'true') return;
        el.dataset.twCompleted = 'true';
        if (el._twInterval) {
          clearInterval(el._twInterval);
          el._twInterval = null;
        }
        allChars.forEach((c) => { c.style.opacity = '1'; });
        if (cursor) {
          cursor.style.opacity = '0';
          setTimeout(() => cursor.remove(), 350);
        }
        const cbs = el._twOnCompleteCallbacks.splice(0);
        cbs.forEach((cb) => cb());
      };

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        el._finishTyping?.();
      });

      el._startTyping = (onDone) => {
        if (onDone) el._twOnCompleteCallbacks.push(onDone);
        if (el.dataset.twCompleted === 'true') {
          const cbs = el._twOnCompleteCallbacks.splice(0);
          cbs.forEach((cb) => cb());
          return;
        }
        if (el._twRunning) return;
        el._twRunning = true;

        if (allChars.length === 0) {
          el._finishTyping();
          return;
        }

        cursor.style.opacity = '1';
        if (allChars[0]) {
          allChars[0].before(cursor);
        }

        let charIdx = 0;
        const speed = 52; // ms per char (natural visual typing)

        el._twInterval = setInterval(() => {
          if (charIdx < allChars.length) {
            const charSpan = allChars[charIdx];
            charSpan.style.opacity = '1';
            charSpan.after(cursor);
            charIdx++;
          } else {
            el._finishTyping();
          }
        }, speed);
      };
    });

    // Find the first block that contains a typewriter
    const firstTwBlockIdx = allSequentialBlocks.findIndex((b) => getTypewriterTargetsInBlock(b).length > 0);
    if (firstTwBlockIdx === -1) return;

    // Smooth layout-preserving hide for subsequent blocks until active typewriter finishes
    for (let i = firstTwBlockIdx + 1; i < allSequentialBlocks.length; i++) {
      const b = allSequentialBlocks[i];
      b.dataset.twLockedHidden = 'true';
      b.style.opacity = '0';
      b.style.pointerEvents = 'none';
      b.style.transform = 'translateY(6px)';
      b.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    }

    const revealBlockWithFade = (block) => {
      if (!block) return;
      if (block.dataset.twLockedHidden === 'true') {
        delete block.dataset.twLockedHidden;
        block.style.pointerEvents = '';
        block.style.opacity = '1';
        block.style.transform = 'translateY(0)';
        this.checkPendingUnlocksInElement(block);
      }
    };

    // Fast-forward on user tap/click anywhere on story text
    const skipAllTypewriters = (e) => {
      if (e && e.target && e.target.closest('button, a, .story-choice-btn, .story-game-widget, input, select, .author-btn')) return;
      allTwElements.forEach((el) => {
        el._finishTyping?.();
      });
      allSequentialBlocks.forEach((b) => {
        revealBlockWithFade(b);
      });
      this.checkPendingUnlocksInElement(container);
    };

    if (container._twSkipHandler) {
      container.removeEventListener('click', container._twSkipHandler);
    }
    container._twSkipHandler = skipAllTypewriters;
    container.addEventListener('click', skipAllTypewriters);

    // Recursively process blocks from `startIndex`
    const runSequenceFrom = (startIndex) => {
      for (let i = startIndex; i < allSequentialBlocks.length; i++) {
        const block = allSequentialBlocks[i];
        revealBlockWithFade(block);

        const twTargets = getTypewriterTargetsInBlock(block).filter((t) => t.dataset.twCompleted !== 'true');
        if (twTargets.length > 0) {
          // Click anywhere in the block to fast-forward active typing
          block.style.cursor = 'pointer';
          block.addEventListener('click', () => {
            const activeTw = twTargets.find((t) => t._twRunning && t.dataset.twCompleted !== 'true');
            if (activeTw) activeTw._finishTyping?.();
          });

          // Wait for all typewriter targets inside this block in order, then continue to i + 1
          const runTargetsInOrder = (tIdx) => {
            if (tIdx >= twTargets.length) {
              setTimeout(() => {
                runSequenceFrom(i + 1);
              }, 180);
              return;
            }
            const targetEl = twTargets[tIdx];
            const triggerTarget = () => {
              if (targetEl._hasTriggered) return;
              targetEl._hasTriggered = true;
              targetEl._startTyping(() => {
                runTargetsInOrder(tIdx + 1);
              });
            };

            if ('IntersectionObserver' in window) {
              const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach((entry) => {
                  if (entry.isIntersecting) {
                    obs.unobserve(entry.target);
                    triggerTarget();
                  }
                });
              }, {
                threshold: 0.01,
                rootMargin: '120px 0px 120px 0px'
              });
              observer.observe(targetEl);
              // Safety fallback: if offscreen or observer delayed, auto-trigger after 800ms so story never blocks
              setTimeout(triggerTarget, 800);
            } else {
              triggerTarget();
            }
          };

          runTargetsInOrder(0);
          return; // Pause sequence here until current block's typewriter(s) finish!
        }
      }
    };

    runSequenceFrom(firstTwBlockIdx);
  }

  renderBriefingCardHtml(conclusionNodeId = 'story_1795161633215', deductionTopicQuery = 'clue_herb_quiz') {
    const existingTopic = CODEX_DATA.find(
      (c) => c.id === deductionTopicQuery || c.title === deductionTopicQuery || (c.keywords && c.keywords.includes(deductionTopicQuery))
    ) || CODEX_DATA.find((c) => c.category === 'clue');
    const topicId = existingTopic ? existingTopic.id : 'clue_herb_quiz';

    let targetConclusionNode = conclusionNodeId || 'story_1795161633215';
    if (!STORY_NODES[targetConclusionNode]) {
      const matchedNode = Object.values(STORY_NODES).find((n) => n.title === targetConclusionNode || n.id === targetConclusionNode);
      targetConclusionNode = matchedNode ? matchedNode.id : 'story_1795161633215';
    }

    const hubLocations = [
      { id: 'loc_nebula', name: '네블라 홀', icon: '🔭', storyNode: 'story_1795180010121' },
      { id: 'loc_library', name: '도서관', icon: '📚' },
      { id: 'loc_lab', name: '연구동', icon: '🧪' },
      { id: 'loc_garden', name: '비밀 안개 정원', icon: '🌿' }
    ];

    const isDeductionSolved = Boolean(state.getFlag('deduction_any_solved'));

    let html = `
      <section class="hub-dashboard">
        <div class="hub-dashboard-header">
          <span class="hub-dashboard-icon">🧭</span>
          <div class="hub-dashboard-titles">
            <h4 class="hub-dashboard-title">아카데미 탐사 상황 브리핑</h4>
            <p class="hub-dashboard-desc">조사할 구역을 클릭하면 즉시 이동합니다. 단서를 모은 뒤 추론 모드에서 조합하거나 정답을 맞추러 갈 수 있습니다.</p>
          </div>
        </div>
        <div class="hub-loc-chips">
    `;

    hubLocations.forEach((loc) => {
      const stat = this._getLocationStatus(loc.id, loc.storyNode);
      html += `
        <button type="button" class="hub-loc-chip is-${stat.status}" data-hub-action="goto-location" data-hub-loc-id="${escapeHtml(loc.id)}" data-hub-story-node="${escapeHtml(loc.storyNode || '')}" title="${escapeHtml(loc.name)}(으)로 이동" style="cursor:pointer;">
          <span class="hub-loc-icon">${loc.icon}</span>
          <span class="hub-loc-name">${escapeHtml(loc.name)}</span>
          <span class="hub-loc-badge is-${stat.status}">${escapeHtml(stat.label)}</span>
          <span class="hub-loc-arrow" style="font-size:11px; opacity:0.75; margin-left:2px;">→</span>
        </button>
      `;
    });

    html += `
        </div>
        <div class="hub-action-row">
          <button type="button" class="hub-action-btn btn-open-deduction" data-hub-action="open-deduction" data-deduction-topic="${escapeHtml(topicId)}">
            <span aria-hidden="true">🧩</span>
            <span>수첩에서 단서들 짜맞춰보기 (추론 모드)</span>
          </button>
          <button type="button" class="hub-action-btn btn-open-map" data-hub-action="open-map">
            <span aria-hidden="true">🗺️</span>
            <span>지도 펼치기</span>
          </button>
        </div>
        <div class="hub-conclusion-row" style="margin-top: 10px;">
          <button type="button" class="story-choice-btn hub-conclusion-btn ${isDeductionSolved ? 'is-conclusion-ready' : ''}" data-hub-action="goto-conclusion" data-conclusion-node="${escapeHtml(targetConclusionNode)}" style="width: 100%; margin: 0;">
            <div class="choice-main">
              <span class="choice-marker">${isDeductionSolved ? '✨' : '💡'}</span>
              <span class="choice-text">${isDeductionSolved ? '✨ 알아냈다! 정답을 맞추러 가자 (결론 도출 완료)' : '알아냈다! 정답을 맞추러 가자'}</span>
            </div>
            <div class="choice-desc-subline">
              <span class="choice-desc-icon">💬</span>
              <span class="choice-desc-text">${isDeductionSolved ? '수첩에서 단서들을 모두 맞춰냈습니다! 이제 교실로 가서 정답을 제출하세요.' : '단서들을 종합하여 답을 알아냈다면 정답을 적으러 갈 수 있습니다.'}</span>
            </div>
          </button>
        </div>
      </section>
    `;

    return html;
  }

  parseStoryParagraph(p, index, nodeId) {
    let content = String(p ?? '');
    let trimmed = content.trim();

    // 0. Check conditional paragraph: [조건: 조건식 | 문단 내용] or [상황: ... | ...]
    const condMatch = trimmed.match(/^\[(?:조건|상황|분기|IF)\s*:\s*([^\|\]]+?)\s*\|\s*([\s\S]+)\]$/i);
    if (condMatch) {
      const conditionExpr = condMatch[1].trim();
      const conditionalContent = condMatch[2].trim();
      const isMet = this.evaluateParagraphCondition(conditionExpr, nodeId);
      if (!isMet) {
        return '';
      }
      p = conditionalContent;
      content = conditionalContent;
      trimmed = content.trim();
    }

    // 0.5. Check Exploration Hub Briefing Card tag: [브리핑카드] or [브리핑카드: 정답장면ID | 추론주제]
    const briefingMatch = trimmed.match(/^\[(?:브리핑카드|브리핑 카드|탐사브리핑|탐사 브리핑|탐사허브|BRIEFING)(?:\s*:\s*(.*?))?\]$/i);
    if (briefingMatch) {
      const rawArgs = (briefingMatch[1] || '').trim();
      const parts = rawArgs ? rawArgs.split('|').map((s) => s.trim()) : [];
      const conclusionNodeId = parts[0] || 'story_1795161633215';
      const deductionTopic = parts[1] || 'clue_herb_quiz';
      return this.renderBriefingCardHtml(conclusionNodeId, deductionTopic);
    }

    // Check quiz answer tag: [정답입력: topicQuery | acceptedAnswers | successMsg | nextNodeId]
    const quizMatch = trimmed.match(/^\[(?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ)\s*:\s*(.+?)\]$/i);
    if (quizMatch) {
      const parts = quizMatch[1].split('|').map(s => s.trim());
      const rawTopic = parts[0] || '약초 퀴즈';
      const customAnswersStr = parts[1] || '';
      const successMsg = parts[2] || '✨ 정답입니다! 수수께끼를 훌륭하게 해결했습니다.';
      const nextNodeId = parts[3] || '';

      const existingTopic = CODEX_DATA.find(c => c.id === rawTopic || c.title === rawTopic || (c.keywords && c.keywords.includes(rawTopic))) ||
                            CODEX_DATA.find(c => c.category === 'clue');
      const topicId = existingTopic ? existingTopic.id : (rawTopic.startsWith('clue_') ? rawTopic : `clue_${rawTopic.replace(/\s+/g, '_')}`);
      const topicTitle = existingTopic ? existingTopic.title : rawTopic;
      const topicIcon = existingTopic ? (existingTopic.icon || '🌿') : '🌿';
      const topicDesc = existingTopic ? (existingTopic.summary || existingTopic.description || '수집한 단서를 바탕으로 올바른 정답을 입력하세요.') : '수집한 단서를 바탕으로 올바른 정답을 입력하세요.';

      let acceptedAnswers = [];
      if (customAnswersStr) {
        acceptedAnswers = customAnswersStr.split(',').map(s => s.trim()).filter(Boolean);
      } else if (existingTopic?.answers && existingTopic.answers.length > 0) {
        acceptedAnswers = [...existingTopic.answers];
      } else {
        acceptedAnswers = ['달빛 이끼', '달빛이끼'];
      }

      const quizKey = `quiz_${nodeId}_${index}_${topicId}`;
      const isSolved = Boolean(state.getFlag(quizKey));
      const solvedAns = state.getFlag(`ans_${quizKey}`) || acceptedAnswers[0];

      const answersJson = escapeHtml(JSON.stringify(acceptedAnswers));

      return `
        <div class="story-quiz-widget ${isSolved ? 'is-solved' : ''}" 
             data-quiz-key="${escapeHtml(quizKey)}" 
             data-quiz-topic="${escapeHtml(topicId)}" 
             data-quiz-answers="${answersJson}" 
             data-quiz-success="${escapeHtml(successMsg)}" 
             data-quiz-next="${escapeHtml(nextNodeId)}">
          <div class="quiz-header">
            <div class="quiz-badge-wrap">
              <span class="quiz-badge-icon">${escapeHtml(topicIcon)}</span>
              <strong class="quiz-badge-title">${escapeHtml(topicTitle)}</strong>
              <span class="quiz-badge-sub">정답 추리</span>
            </div>
            <span class="quiz-status-pill">${isSolved ? '✔️ 정답 확인 완료' : '✍️ 정답 입력'}</span>
          </div>
          <div class="quiz-body">
            <div class="quiz-question-box">
              <span class="quiz-q-marker">Q.</span>
              <p class="quiz-q-text">${escapeHtml(topicDesc)}</p>
            </div>
            ${isSolved ? `
              <div class="quiz-solved-banner">
                <span class="solved-sparkle">🎉</span>
                <div class="solved-info">
                  <strong class="solved-congrats">정답 확인 완료!</strong>
                  <p class="solved-desc">${escapeHtml(successMsg)}</p>
                  <span class="solved-ans-badge">입력했던 정답: <b>${escapeHtml(solvedAns)}</b></span>
                </div>
                ${nextNodeId && STORY_NODES[nextNodeId] ? `
                  <button type="button" class="quiz-advance-btn" data-advance-node="${escapeHtml(nextNodeId)}">
                    <span>▶ ${escapeHtml(STORY_NODES[nextNodeId].title || '다음 장면으로')}</span>
                  </button>
                ` : ''}
              </div>
            ` : `
              <div class="quiz-form-row">
                <input type="text" class="quiz-text-input" placeholder="정답을 입력하세요 (예: 식물 이름)" autocomplete="off" />
                <button type="button" class="quiz-submit-btn">
                  <span>확인</span>
                  <span class="btn-check-icon">✓</span>
                </button>
              </div>
              <div class="quiz-feedback-box" style="display:none;"></div>
            `}
          </div>
        </div>
      `;
    }

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

      const payload = {
        itemId,
        itemName,
        itemDesc,
        itemIcon,
        itemType: existing ? existing.type : 'item'
      };

      return `
        <div class="story-game-widget widget-item ${isNew ? 'is-pending-unlock' : ''}"
             ${isNew ? `data-pending-unlock="true" data-unlock-type="item" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
          <div class="widget-header">
            <span class="widget-badge">🎁 아이템 획득</span>
            <span class="widget-status" data-widget-status="true">${isNew ? '✨ 새로운 소지품 발견' : '✔️ 획득 완료'}</span>
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

    // Check item use/consume tag: [아이템사용: itemId_or_name | desc | icon]
    const itemUseMatch = trimmed.match(/^\[(?:아이템사용|아이템소모|아이템삭제|소지품사용|소지품소모|USE_ITEM|CONSUME_ITEM|REMOVE_ITEM)\s*:\s*(.+?)\]$/i);
    if (itemUseMatch) {
      const parts = itemUseMatch[1].split('|').map(s => s.trim());
      const rawIdOrName = parts[0] || '소지품';

      const inv = state.getInventory();
      const existing = inv.find(i => i.id === rawIdOrName || i.name === rawIdOrName) ||
                       INVENTORY_ITEMS.find(i => i.id === rawIdOrName || i.name === rawIdOrName);
      const itemId = existing ? existing.id : (rawIdOrName.startsWith('item_') ? rawIdOrName : `item_${rawIdOrName.replace(/\s+/g, '_')}`);
      const itemName = existing ? existing.name : rawIdOrName;
      const itemDesc = parts[1] || (existing ? (existing.desc || '소지품을 사용하여 상황을 해결했습니다.') : '소지품을 사용했습니다.');
      const itemIcon = parts[2] || (existing ? existing.icon : '🎒');

      const eventKey = `event_item_use_${nodeId}_${index}_${itemId}`;
      const isNew = !state.getFlag(eventKey);

      const payload = {
        itemId,
        existingId: existing?.id,
        itemName,
        itemDesc,
        itemIcon
      };

      return `
        <div class="story-game-widget widget-item widget-item-use ${isNew ? 'is-pending-unlock' : ''}"
             ${isNew ? `data-pending-unlock="true" data-unlock-type="item_use" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
          <div class="widget-header">
            <span class="widget-badge" style="background:#2D3748; color:#68D391; border:1px solid rgba(104, 211, 145, 0.4);">🎒 아이템 사용</span>
            <span class="widget-status" data-widget-status="true" style="color:#68D391;">${isNew ? '✨ 소모 대기' : '✔️ 사용 완료'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon" style="background:rgba(104, 211, 145, 0.15); color:#68D391; border:1.5px solid rgba(104, 211, 145, 0.3);">${escapeHtml(itemIcon)}</div>
            <div class="widget-details">
              <strong class="widget-name" style="color:#111827;">${escapeHtml(itemName)} <span class="stat-delta delta-neg" style="color:#E53E3E; font-size:12px; font-weight:700;">-1</span></strong>
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
      const statExpression = parts[0] || '마법 +1';
      const statDesc = parts[1] || '능력치에 변화가 생겼습니다.';

      const expMatch = statExpression.match(/^([^\s+-]+)\s*([+-]?\d+)/);
      let statKey = 'magic';
      let delta = 1;
      let statLabel = '마법';

      const statMap = {
        '마법': 'magic', '마력': 'magic', 'magic': 'magic',
        '지식': 'knowledge', '지력': 'knowledge', 'knowledge': 'knowledge',
        '관찰력': 'perception', '관찰': 'perception', 'perception': 'perception',
        '사교력': 'social', '사교': 'social', '화술': 'social', 'persuasion': 'social', 'social': 'social',
        '체력': 'stamina', 'stamina': 'stamina'
      };
      const labelMap = {
        'magic': '마법',
        'knowledge': '지식',
        'perception': '관찰력',
        'social': '사교력',
        'persuasion': '사교력',
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
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;

      const currentVal = state.getPlayer()?.stats?.[statKey] ?? 0;
      const payload = {
        statKey,
        delta,
        statLabel,
        statDesc
      };

      return `
        <div class="story-game-widget widget-stat ${isNew ? 'is-pending-unlock' : ''}"
             ${isNew ? `data-pending-unlock="true" data-unlock-type="stat" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
          <div class="widget-header">
            <span class="widget-badge">⚡ 능력치 변동</span>
            <span class="widget-status" data-widget-status="true">${isNew ? '✨ 스탯 갱신!' : '✔️ 반영 완료'}</span>
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

    // Check explanation popup tag: [설명창: 제목 | 내용 | 아이콘] or [설명창: 내용 | 아이콘] or [설명창: 내용]
    const explanationMatch = trimmed.match(/^\[(?:설명창|팝업|모달|설명|POPUP|MODAL|EXPLANATION)\s*:\s*(.+?)\]$/i);
    if (explanationMatch) {
      const parts = explanationMatch[1].split('|').map(s => s.trim());
      let title = '';
      let content = '';
      let icon = '💡';
      if (parts.length === 1) {
        content = parts[0];
      } else if (parts.length === 2) {
        if (parts[1].length <= 2 || ['💡', '📌', 'ℹ️', '🔍', '📜', '✨', '🐾', '🎒', '🧪', '🗝️', '🪴'].includes(parts[1])) {
          content = parts[0];
          icon = parts[1];
        } else {
          title = parts[0];
          content = parts[1];
        }
      } else {
        title = parts[0];
        content = parts[1];
        icon = parts[2] || '💡';
      }

      const encodedTitle = escapeHtml(title);
      const encodedContent = escapeHtml(content).replace(/\n/g, '<br>');
      const encodedIcon = escapeHtml(icon);

      return `
        <div class="story-explanation-box">
          <div class="explanation-box-header">
            <span class="explanation-box-icon">${encodedIcon}</span>
            <strong class="explanation-box-title">${encodedTitle || '안내'}</strong>
          </div>
          <div class="explanation-box-content">
            <p>${encodedContent}</p>
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

      const payload = {
        charId,
        charName,
        charDesc,
        charIcon
      };

      return `
        <div class="story-game-widget widget-character ${isNew ? 'is-pending-unlock' : ''}"
             ${isNew ? `data-pending-unlock="true" data-unlock-type="character" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
          <div class="widget-header">
            <span class="widget-badge" style="background:#1E293B; color:#60A5FA; border:1px solid rgba(96, 165, 250, 0.4);">👤 인물 등록</span>
            <span class="widget-status" data-widget-status="true">${isNew ? '✨ 새 인물 등록!' : '✔️ 도감 등록됨'}</span>
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
      let topicTitle = '';
      let topicDesc = '';
      let topicIcon = '🌿';
      let topicId = '';

      if (parts.length >= 4) {
        topicId = parts[0];
        topicTitle = parts[1];
        topicDesc = parts[2];
        topicIcon = parts[3];
      } else if (parts.length === 3) {
        topicTitle = parts[0];
        topicDesc = parts[1];
        topicIcon = parts[2];
      } else if (parts.length === 2) {
        topicTitle = parts[0];
        topicDesc = parts[1];
        topicIcon = '🔍';
      } else {
        topicTitle = parts[0];
        topicDesc = '새로운 수사 단서가 등록되었습니다.';
        topicIcon = '🔍';
      }

      let existing = CODEX_DATA.find(c => c.id === topicTitle || c.title === topicTitle || (topicId && (c.id === topicId || c.title === topicId)));
      if (!existing) {
        const cleanTitle = topicTitle.replace(/[\?\!\.\s]/g, '');
        if (cleanTitle) {
          existing = CODEX_DATA.find(c => {
            const cClean = (c.title || '').replace(/[\?\!\.\s]/g, '');
            return cClean.includes(cleanTitle) || cleanTitle.includes(cClean) ||
                   (c.keywords && c.keywords.some(k => k.includes(cleanTitle) || cleanTitle.includes(k)));
          });
        }
      }

      if (existing) {
        topicId = existing.id;
        topicTitle = existing.title || topicTitle;
        if (!topicDesc || topicDesc === '새로운 수사 단서가 등록되었습니다.') {
          topicDesc = existing.summary || existing.description || topicDesc;
        }
        if (parts.length < 3) {
          topicIcon = existing.icon || topicIcon;
        }
      } else if (!topicId) {
        topicId = `clue_${topicTitle.replace(/\s+/g, '_')}`;
      }

      const eventKey = `event_topic_${nodeId}_${index}_${topicId}`;
      const isNew = !state.getFlag(eventKey);

      const payload = {
        topicId,
        topicTitle,
        topicDesc,
        topicIcon
      };

      return `
        <div class="story-game-widget widget-topic ${isNew ? 'is-pending-unlock' : ''}"
             ${isNew ? `data-pending-unlock="true" data-unlock-type="topic" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
          <div class="widget-header">
            <span class="widget-badge" style="background:#1E293B; color:#F59E0B; border:1px solid rgba(245, 158, 11, 0.4);">${escapeHtml(topicIcon)} ${escapeHtml(topicTitle)}</span>
            <span class="widget-status" data-widget-status="true">${isNew ? '✨ 새 단서 발견!' : '✔️ 수첩 등록됨'}</span>
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
          const payload = {
            topicId,
            topicTitle: majorEntry.title,
            topicDesc: parts[1] || majorEntry.summary || majorEntry.description,
            topicIcon: majorEntry.icon || '🔍'
          };
          return `
            <div class="story-game-widget widget-topic ${isNew ? 'is-pending-unlock' : ''}"
                 ${isNew ? `data-pending-unlock="true" data-unlock-type="clue_major" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
              <div class="widget-header">
                <span class="widget-badge" style="background:#1E293B; color:#F59E0B; border:1px solid rgba(245, 158, 11, 0.4);">${escapeHtml(majorEntry.icon || '🔍')} ${escapeHtml(majorEntry.title)}</span>
                <span class="widget-status" data-widget-status="true">${isNew ? '✨ 새 단서 발견!' : '✔️ 수첩 등록됨'}</span>
              </div>
              <div class="widget-body">
                <div class="widget-icon">${escapeHtml(majorEntry.icon || '🗂️')}</div>
                <div class="widget-details">
                  <strong class="widget-name">${escapeHtml(majorEntry.title)}</strong>
                  <p class="widget-desc">${escapeHtml(payload.topicDesc)}</p>
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

      const payload = {
        clueId,
        clueLabel,
        matchedClueId: matchedClue?.id,
        parentCodexId: matchedParent?.id,
        displayParentTitle,
        displayDesc
      };

      return `
        <div class="story-game-widget widget-clue ${isNew ? 'is-pending-unlock' : ''}"
             ${isNew ? `data-pending-unlock="true" data-unlock-type="clue" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
          <div class="widget-header">
            <span class="widget-badge" style="background:#2D323F; color:#D4AF37; border:1px solid rgba(212, 175, 55, 0.6);">🔘 단서 발견</span>
            <span class="widget-status" data-widget-status="true">${isNew ? '✨ 새 단서 획득!' : '✔️ 메모 보드 등록됨'}</span>
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
    const recordMatch = trimmed.match(/^\[(?:추가기록|세부기록|기록추가|새기록|기록|정보|RECORD|INFO)\s*:\s*(.+?)\]$/i);
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
      const targetTileLabel = targetTile ? targetTile.label : parts[0];

      const payload = {
        recordId,
        tileId: targetTile ? targetTile.id : parts[0],
        recordText,
        targetTileLabel
      };

      return `
        <div class="story-game-widget widget-record ${isNew ? 'is-pending-unlock' : ''}"
             ${isNew ? `data-pending-unlock="true" data-unlock-type="record" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
          <div class="widget-header">
            <span class="widget-badge" style="background:#1E293B; color:#60A5FA; border:1px solid rgba(96, 165, 250, 0.4);">📝 추가 조사 기록</span>
            <span class="widget-status" data-widget-status="true">${isNew ? '✨ 새 정보 기록!' : '✔️ 수첩에 기록됨'}</span>
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

    // Check sub-item / detail tile tag: [세부타일: parentTopic | subItemName | desc] or [세부타일: subItemName | parentTopic | desc]
    const subItemMatch = trimmed.match(/^\[(?:세부타일|소분류|소분류타일|세부키워드|세부단서|SUBITEM|SUB_ITEM|DETAIL_TILE)\s*:\s*(.+?)\]$/i);
    if (subItemMatch) {
      const parts = subItemMatch[1].split('|').map(s => s.trim());
      let parentQuery = '';
      let subItemLabel = '';
      let subItemDesc = '';

      if (parts.length >= 3) {
        // [세부타일: 대분류 | 소분류명 | 설명] or [세부타일: 소분류명 | 대분류 | 설명]
        const entry0 = CODEX_DATA.find(c => c.id === parts[0] || c.title === parts[0]);
        const entry1 = CODEX_DATA.find(c => c.id === parts[1] || c.title === parts[1]);
        if (entry0 && !entry1) {
          parentQuery = parts[0];
          subItemLabel = parts[1];
        } else if (!entry0 && entry1) {
          parentQuery = parts[1];
          subItemLabel = parts[0];
        } else {
          parentQuery = parts[0];
          subItemLabel = parts[1];
        }
        subItemDesc = parts.slice(2).join(' | ');
      } else if (parts.length === 2) {
        const entry0 = CODEX_DATA.find(c => c.id === parts[0] || c.title === parts[0]);
        const entry1 = CODEX_DATA.find(c => c.id === parts[1] || c.title === parts[1]);
        if (entry0 && !entry1) {
          parentQuery = parts[0];
          subItemLabel = parts[1];
        } else if (!entry0 && entry1) {
          parentQuery = parts[1];
          subItemLabel = parts[0];
        } else {
          parentQuery = parts[0];
          subItemLabel = parts[1];
        }
        subItemDesc = `${subItemLabel}에 대한 세부 조사 정보입니다.`;
      } else {
        subItemLabel = parts[0];
        subItemDesc = `${subItemLabel}에 대한 세부 조사 정보입니다.`;
      }

      // Find parent CODEX entry
      let parentEntry = null;
      if (parentQuery) {
        parentEntry = CODEX_DATA.find(c => c.id === parentQuery || c.title === parentQuery);
        if (!parentEntry) {
          const cleanP = parentQuery.replace(/[\?\!\.\s]/g, '');
          parentEntry = CODEX_DATA.find(c => {
            const cleanC = (c.title || '').replace(/[\?\!\.\s]/g, '');
            return cleanC && (cleanC.includes(cleanP) || cleanP.includes(cleanC));
          });
        }
      }
      if (!parentEntry) {
        parentEntry = CODEX_DATA.find(c => c.category === 'clue') || CODEX_DATA[0];
      }

      if (parentEntry) {
        parentEntry.subItems = parentEntry.subItems || [];
      }

      // Find if this subItem already exists
      let existingSubItem = parentEntry ? parentEntry.subItems.find(s => s.id === subItemLabel || s.label === subItemLabel) : null;
      if (!existingSubItem) {
        for (const entry of CODEX_DATA) {
          const found = (entry.subItems || []).find(s => s.id === subItemLabel || s.label === subItemLabel);
          if (found) {
            existingSubItem = found;
            parentEntry = entry;
            break;
          }
        }
      }

      const subId = existingSubItem ? existingSubItem.id : (subItemLabel.startsWith('sub_') ? subItemLabel : `sub_${subItemLabel.replace(/\s+/g, '_')}`);
      const finalLabel = existingSubItem ? (existingSubItem.label || subItemLabel) : subItemLabel;
      const finalDesc = subItemDesc || (existingSubItem ? (existingSubItem.desc || existingSubItem.description) : `${finalLabel}에 대한 세부 정보입니다.`);

      if (!existingSubItem && parentEntry) {
        existingSubItem = {
          id: subId,
          label: finalLabel,
          sub: '세부 타일',
          desc: finalDesc,
          records: [
            { id: `rec_${subId}_1`, title: `${finalLabel} 발견`, text: finalDesc, unlockedByDefault: false }
          ],
          unlockedByDefault: false
        };
        parentEntry.subItems.push(existingSubItem);
      } else if (existingSubItem) {
        if (subItemDesc && !existingSubItem.desc) existingSubItem.desc = subItemDesc;
      }

      const eventKey = `event_subitem_${nodeId}_${index}_${subId}`;
      const isNew = !state.getFlag(eventKey);
      const displayParentTitle = parentEntry?.title || parentQuery || '';

      const payload = {
        subId,
        finalLabel,
        finalDesc,
        parentId: parentEntry?.id,
        parentTitle: parentEntry?.title
      };

      return `
        <div class="story-game-widget widget-subitem ${isNew ? 'is-pending-unlock' : ''}"
             ${isNew ? `data-pending-unlock="true" data-unlock-type="subitem" data-unlock-event="${escapeHtml(eventKey)}" data-unlock-payload="${escapeHtml(JSON.stringify(payload))}"` : ''}>
          <div class="widget-header">
            <span class="widget-badge" style="background:#1E293B; color:#E2E8F0; border:1px solid rgba(226, 232, 240, 0.4);">⬜ 새로운 정보</span>
            <span class="widget-status" data-widget-status="true">${isNew ? '✨ 새로 등록됨' : '✔️ 수첩에 등록됨'}</span>
          </div>
          <div class="widget-body">
            <div class="widget-icon" style="background:#F8FAFC; color:#0F172A; border-radius:8px; width:44px; height:44px; display:grid; place-items:center; font-size:20px; font-weight:800; border:2px solid #CBD5E1; box-shadow:0 2px 8px rgba(0,0,0,0.15);">⬜</div>
            <div class="widget-details">
              <div class="widget-name" style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">
                <strong style="color:var(--text-main); font-size:15px;">${escapeHtml(finalLabel)}</strong>
                ${displayParentTitle ? `<span style="font-size:12px; font-weight:500; color:#94A3B8;">${escapeHtml(displayParentTitle)}</span>` : ''}
              </div>
              <p class="widget-desc" style="margin:4px 0 0 0; font-size:13px; line-height:1.5; color:var(--text-muted);">${escapeHtml(finalDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }

    // Check paragraph formatting: Center alignment and Typewriter paragraph
    let isCenter = false;
    let isTypewriter = false;
    content = String(p ?? '');

    // Unpack outer wrappers iteratively (in case both [가운데: [타이핑: ...]] or [타이핑: [가운데: ...]] are used)
    for (let iter = 0; iter < 3; iter++) {
      const currentTrimmed = content.trim();

      // Center tags: [가운데: ...] or [중앙: ...] or [center: ...]
      const centerColonMatch = currentTrimmed.match(/^\[(?:가운데|중앙|CENTER)\s*:\s*([\s\S]+?)\]$/i);
      if (centerColonMatch) {
        isCenter = true;
        content = centerColonMatch[1];
        continue;
      }
      const centerPrefixMatch = currentTrimmed.match(/^\[(?:가운데|중앙|CENTER)\]\s*([\s\S]*)$/i);
      if (centerPrefixMatch) {
        isCenter = true;
        content = centerPrefixMatch[1];
        continue;
      }

      // Typewriter tags: [타이핑: ...] or [타자기: ...] or [typewriter: ...]
      const twColonMatch = currentTrimmed.match(/^\[(?:타이핑|타자기|TYPEWRITER)\s*:\s*([\s\S]+?)\]$/i);
      if (twColonMatch) {
        isTypewriter = true;
        content = twColonMatch[1];
        continue;
      }
      const twPrefixMatch = currentTrimmed.match(/^\[(?:타이핑|타자기|TYPEWRITER)\]\s*([\s\S]*)$/i);
      if (twPrefixMatch) {
        isTypewriter = true;
        content = twPrefixMatch[1];
        continue;
      }

      break;
    }

    const formattedContent = this.formatNovelText(content);
    const classes = ['novel-p'];
    if (isCenter) classes.push('novel-p-center');
    if (isTypewriter) classes.push('novel-p-typewriter');

    return `<p class="${classes.join(' ')}" ${isTypewriter ? 'data-typewriter-paragraph="true"' : ''}>${formattedContent}</p>`;
  }

  formatNovelText(rawText) {
    if (!rawText) return '';
    let text = escapeHtml(String(rawText));

    // 1. Glowing text: [빛: 텍스트] or [빛: 색상 | 텍스트]
    text = text.replace(/\[(?:빛|글로우|빛무리|오파츠|GLOW)\s*:\s*([^\]]+?)\]/gi, (match, inner) => {
      const parts = inner.split('|').map((s) => s.trim());
      let colorClass = 'novel-glow-gold';
      let content = parts[0];
      if (parts.length > 1) {
        const col = parts[0].toLowerCase();
        content = parts.slice(1).join('|');
        if (col.includes('파랑') || col.includes('blue') || col.includes('청') || col.includes('마력')) {
          colorClass = 'novel-glow-blue';
        } else if (col.includes('보라') || col.includes('purple') || col.includes('자색')) {
          colorClass = 'novel-glow-purple';
        } else if (col.includes('빨강') || col.includes('red') || col.includes('적') || col.includes('위험')) {
          colorClass = 'novel-glow-red';
        } else if (col.includes('초록') || col.includes('green') || col.includes('생명')) {
          colorClass = 'novel-glow-green';
        }
      }
      return `<span class="novel-glow-text ${colorClass}">${content}</span>`;
    });

    // 2. Inline Typewriter: [타이핑: 텍스트]
    text = text.replace(/\[(?:타이핑|타자기|TYPE)\s*:\s*([^\]]+?)\]/gi, (match, inner) => {
      return `<span class="novel-inline-typewriter" data-inline-typewriter="true">${inner}</span>`;
    });

    // 3. Bold: **텍스트** or [볼드: 텍스트] or [굵게: 텍스트]
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="novel-bold">$1</strong>');
    text = text.replace(/\[(?:볼드|굵게|BOLD)\s*:\s*([^\]]+?)\]/gi, '<strong class="novel-bold">$1</strong>');

    // 4. Italic: *텍스트* or _텍스트_ or [기울기: 텍스트] or [이탤릭: 텍스트]
    text = text.replace(/(\*|_)([^\*_\n]+?)\1/g, '<em class="novel-italic">$2</em>');
    text = text.replace(/\[(?:기울기|이탤릭|기울임|ITALIC)\s*:\s*([^\]]+?)\]/gi, '<em class="novel-italic">$1</em>');

    return text;
  }

  evaluateParagraphCondition(conditionExpr, nodeId) {
    if (!conditionExpr || conditionExpr === '기본' || conditionExpr.toLowerCase() === 'else') {
      return true;
    }

    const s = conditionExpr.trim();

    // 1. Tile record count: e.g. "타일기록 >= 2", "타일정보 == 0", "세부타일 >= 1", "기록 >= 1"
    const tileRecordCountMatch = s.match(/^(?:타일기록|타일정보|세부타일|세부기록|기록|tileRecords)\s*(>=|<=|>|<|==|!=)\s*(\d+)$/i);
    if (tileRecordCountMatch) {
      const op = tileRecordCountMatch[1];
      const targetVal = parseInt(tileRecordCountMatch[2], 10);
      const unlockedCount = Object.keys(state.getUnlockedTileRecords() || {}).length;
      return this.compareConditionNumbers(unlockedCount, op, targetVal);
    }

    // 2. Specific tile record unlocked: e.g. "기록: recordId" or "세부타일: recordId"
    const specificTileMatch = s.match(/^(?:기록|세부타일|tileRecord)\s*:\s*(.+)$/i);
    if (specificTileMatch) {
      const recId = specificTileMatch[1].trim();
      return state.isTileRecordUnlocked(recId);
    }

    // 3. Clues count: e.g. "단서 >= 2"
    const clueCountMatch = s.match(/^(?:단서|단서수|clues)\s*(>=|<=|>|<|==|!=)\s*(\d+)$/i);
    if (clueCountMatch) {
      const op = clueCountMatch[1];
      const targetVal = parseInt(clueCountMatch[2], 10);
      const unlockedClues = Object.keys(state.data.unlockedCodex || {}).length;
      return this.compareConditionNumbers(unlockedClues, op, targetVal);
    }

    // 4. Specific clue: e.g. "단서: clueId"
    const specificClueMatch = s.match(/^(?:단서|clue)\s*:\s*(.+)$/i);
    if (specificClueMatch) {
      const clueId = specificClueMatch[1].trim();
      return state.isClueConditionUnlocked(clueId) || Boolean(state.data.unlockedCodex?.[clueId]);
    }

    // 5. Item: e.g. "아이템: itemId" or "!아이템: itemId"
    const itemMatch = s.match(/^(!?)(?:아이템|item)\s*:\s*(.+)$/i);
    if (itemMatch) {
      const isNeg = itemMatch[1] === '!';
      const itemId = itemMatch[2].trim();
      const has = state.hasItem(itemId);
      return isNeg ? !has : has;
    }

    // 6. Flag: e.g. "플래그: flagKey" or "!플래그: flagKey"
    const flagMatch = s.match(/^(!?)(?:플래그|flag)\s*:\s*(.+)$/i);
    if (flagMatch) {
      const isNeg = flagMatch[1] === '!';
      const flagKey = flagMatch[2].trim();
      const val = Boolean(state.getFlag(flagKey));
      return isNeg ? !val : val;
    }

    // 7. Stat: e.g. "관찰력 >= 5", "magic > 3"
    const statMatch = s.match(/^([^\s><=!]+)\s*(>=|<=|>|<|==|!=)\s*(\d+)$/);
    if (statMatch) {
      const rawStat = statMatch[1].trim();
      const statMap = {
        '마법': 'magic', '마력': 'magic', 'magic': 'magic',
        '지식': 'knowledge', '지력': 'knowledge', 'knowledge': 'knowledge',
        '관찰력': 'perception', '관찰': 'perception', 'perception': 'perception',
        '사교력': 'social', '사교': 'social', '화술': 'social', 'persuasion': 'social', 'social': 'social',
        '체력': 'stamina', 'stamina': 'stamina'
      };
      const statKey = statMap[rawStat] || rawStat;
      const op = statMatch[2];
      const targetVal = parseInt(statMatch[3], 10);
      const currentVal = state.getPlayer()?.stats?.[statKey] ?? 0;
      return this.compareConditionNumbers(currentVal, op, targetVal);
    }

    // 8. Revisit / First visit: "재방문", "첫방문"
    if (s === '재방문' || s.toLowerCase() === 'revisit') {
      const history = state.getHistory() || [];
      const visits = history.filter(h => h.nodeId === nodeId).length;
      return visits > 0;
    }
    if (s === '첫방문' || s.toLowerCase() === 'first_visit') {
      const history = state.getHistory() || [];
      const visits = history.filter(h => h.nodeId === nodeId).length;
      return visits === 0;
    }

    return true;
  }

  compareConditionNumbers(a, op, b) {
    switch (op) {
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '<': return a < b;
      case '==': return a === b;
      case '!=': return a !== b;
      default: return true;
    }
  }

  evaluateCondition(condition) {
    if (!condition) return { met: true };

    const player = state.getPlayer();

    if (condition.stat) {
      for (const [statKey, reqVal] of Object.entries(condition.stat)) {
        const currentVal = player.stats[statKey] || 0;
        if (currentVal < reqVal) {
          const statNames = { magic: '마법', knowledge: '지식', perception: '관찰력', social: '사교력', persuasion: '사교력', stamina: '체력' };
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

  selectChoice(node, choiceIndex, choiceBtn = null) {
    this.flushPendingStoryUnlocks(this.storyView);
    const choice = node.choices[choiceIndex];
    if (!choice) return;

    // Record choice selection
    const choiceKey = choice.id || `choice_${node.id}_${choiceIndex}`;
    state.setFlag(`chosen_${choiceKey}`, true);
    if (choice.text) {
      state.setFlag(`chosen_text_${node.id}_${choice.text.trim()}`, true);
      state.setFlag(`chosen_global_${choice.text.trim()}`, true);
    }
    if (choice.nextNode) {
      state.setFlag(`visited_target_${choice.nextNode}`, true);
    }

    this.playAudio('click');

    const statDeltas = [];
    const statAlias = {
      '마법': 'magic', '마력': 'magic', 'magic': 'magic',
      '지식': 'knowledge', '지력': 'knowledge', 'knowledge': 'knowledge',
      '관찰력': 'perception', '관찰': 'perception', 'perception': 'perception',
      '사교력': 'social', '사교': 'social', '화술': 'social', 'persuasion': 'social', 'social': 'social',
      '체력': 'stamina', 'stamina': 'stamina'
    };
    const statNames = { magic: '마법', knowledge: '지식', perception: '관찰력', social: '사교력', persuasion: '사교력', stamina: '체력' };
    const statIcons = { magic: '✨', knowledge: '📖', perception: '👁️', social: '🗣️', persuasion: '🗣️', stamina: '⚡' };

    if (choice.effects) {
      const eff = choice.effects;
      if (eff.rewardStat) {
        const mergedStats = {};
        const hasExplicitSocial = Object.prototype.hasOwnProperty.call(eff.rewardStat, 'social');
        for (const [rawKey, val] of Object.entries(eff.rewardStat)) {
          if (rawKey === 'persuasion' && hasExplicitSocial) continue;
          const numVal = parseInt(val, 10) || 0;
          if (numVal === 0) continue;
          const canonicalKey = statAlias[rawKey] || rawKey;
          mergedStats[canonicalKey] = (mergedStats[canonicalKey] || 0) + numVal;
        }
        for (const [st, numVal] of Object.entries(mergedStats)) {
          if (numVal !== 0) {
            const currentVal = state.modifyStat(st, numVal);
            statDeltas.push({
              key: st,
              label: statNames[st] || st,
              icon: statIcons[st] || '📈',
              delta: numVal,
              current: currentVal
            });
          }
        }
      }
      if (eff.unlockCodex) {
        state.unlockCodex(eff.unlockCodex);
        this.playAudio('codexUnlock');
      }
      if (eff.removeItem || eff.consumeItem || eff.useItem) {
        const itemTarget = eff.removeItem || eff.consumeItem || eff.useItem;
        state.removeItem(itemTarget, 1);
        this.showToast(`[${itemTarget}] 아이템을 사용했습니다.`, 'info', '🎒');
      }
      if (eff.toast) {
        this.showToast(eff.toast, 'success', '✨');
      }
    }

    const proceed = () => {
      if (choice.isResetTrigger) {
        state.reset();
        this.showToast('게임 데이터가 초기화되었습니다. 처음부터 다시 시작합니다.', 'info', '🔄');
        this.renderStoryNode('ep1_pocket_intro');
        return;
      }

      if (choice.isOpenMapTrigger || choice.action === 'open_map' || choice.nextNode === 'action:open_map' || choice.mapLocationId || (typeof choice.nextNode === 'string' && choice.nextNode.startsWith('map_loc:'))) {
        const targetLocId = choice.mapLocationId || (choice.nextNode?.startsWith('map_loc:') ? choice.nextNode.slice('map_loc:'.length) : null);
        if (targetLocId) {
          state.setCurrentLocationId(targetLocId);
        }
        if (this.onOpenMap) {
          this.onOpenMap(targetLocId);
        } else {
          window.app?.openPocketModal('map');
        }
        this.showToast('노바리스 아카데미 지도를 열었습니다.', 'info', '🗺️');
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
    };

    if (statDeltas.length > 0) {
      if (choiceBtn) {
        choiceBtn.classList.add('is-chosen');
        const container = document.getElementById('story-content');
        container?.querySelectorAll('.story-choice-btn').forEach(btn => {
          btn.disabled = true;
          if (btn !== choiceBtn) btn.classList.add('is-disabled-other');
        });

        const feedbackBox = document.createElement('div');
        feedbackBox.className = 'choice-stat-feedback is-anim-in';
        feedbackBox.innerHTML = `
          <div class="stat-feedback-header">
            <span class="stat-feedback-icon">⚡</span>
            <strong class="stat-feedback-title">능력치 변동</strong>
          </div>
          <div class="stat-feedback-chips">
            ${statDeltas.map(s => {
              const sign = s.delta > 0 ? `+${s.delta}` : `${s.delta}`;
              const deltaClass = s.delta > 0 ? 'delta-pos' : 'delta-neg';
              return `
                <span class="stat-feedback-chip ${deltaClass}">
                  <span class="chip-icon">${s.icon}</span>
                  <span class="chip-name">${escapeHtml(s.label)}</span>
                  <strong class="chip-delta">${sign}</strong>
                  <span class="chip-current">(현재: ${s.current})</span>
                </span>
              `;
            }).join('')}
          </div>
        `;
        choiceBtn.insertAdjacentElement('afterend', feedbackBox);
      }

      this.playAudio('codexUnlock');
      const summaryText = statDeltas.map(s => `${s.label} ${s.delta > 0 ? `+${s.delta}` : s.delta}`).join(', ');
      this.showToast(`[능력치 변화] ${summaryText}`, 'info', '⚡');

      setTimeout(() => {
        proceed();
      }, 2800);
    } else {
      proceed();
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
      leaveButton.onclick = () => {
        this.playAudio('click');
        if (typeof this.onOpenMap === 'function') {
          this.onOpenMap();
        }
      };
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
      const currentEp = (state.getCurrentEpisodeId && state.getCurrentEpisodeId()) || 'ep1';
      const defaultHub = STORY_EPISODES[currentEp]?.hubNode ||
        Object.values(STORY_NODES).find((n) => n.isHubNode || (n.chapter && n.chapter.includes('탐사 허브')))?.id ||
        (STORY_NODES['story_1795192473432'] ? 'story_1795192473432' : 'ep1_return_from_investigation');
      const nextNode = (scene?.exitStoryNode && scene.exitStoryNode !== 'ep1_return_from_investigation')
        ? scene.exitStoryNode
        : defaultHub;
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
      const isCharDeparted = hs.type === 'character' && this.isCharacterDialogueDone(hs);
      const isCollected = state.isHotspotCollected(hs.id) || isCharDeparted;

      // 인물 핫스팟: 이미 대화를 마치고 자리를 떠난 경우(기본: 대화 후 사라짐) 장면에 아예 렌더링하지 않음
      if (hs.type === 'character' && isCollected && hs.hideAfterDialogue !== false) {
        return;
      }

      const spot = document.createElement('button');
      spot.type = 'button';
      spot.className = `investigation-hotspot hotspot-type-${hs.type} ${isCollected ? 'is-collected' : ''} ${isCharDeparted ? 'is-departed' : ''}`;
      if (isCharDeparted) {
        spot.disabled = true;
        spot.style.pointerEvents = 'none';
        spot.style.opacity = '0.35';
      }
      spot.style.left = `${hs.coords.x}%`;
      spot.style.top = `${hs.coords.y}%`;
      spot.dataset.id = hs.id;
      spot.setAttribute('aria-label', hs.type === 'character'
        ? `${hs.characterName || hs.title} (${isCharDeparted ? '대화 완료' : '대화하기'})`
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

      const tooltipTitle = hs.type === 'character' ? (hs.characterName || hs.title) : hs.title;
      const tooltipAction = hs.type === 'character' ? '대화하기' : '조사하기';
      const isRightEdge = hs.coords?.x > 75;
      const isLeftEdge = hs.coords?.x < 25;
      const alignClass = isRightEdge ? 'align-right' : (isLeftEdge ? 'align-left' : '');

      spot.innerHTML = `
        <span class="hotspot-pulse"></span>
        ${hotspotMarker}
        <span class="hotspot-tooltip ${alignClass}">
          <span class="hotspot-tooltip-title">${escapeHtml(tooltipTitle)} ${isCollected ? '<span class="status-checked">[완료]</span>' : ''}</span>
          <span class="hotspot-tooltip-hint-mobile">👆 다시 탭하여 ${escapeHtml(tooltipAction)}</span>
          <span class="hotspot-tooltip-hint-desktop">클릭하여 ${escapeHtml(tooltipAction)}</span>
        </span>
      `;

      let lastTapTime = 0;
      const doInteract = () => {
        spot.classList.remove('is-selected');
        this.interactHotspot(hs, spot);
      };

      spot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (spot.disabled || spot.classList.contains('is-departed')) return;

        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime;
        lastTapTime = now;

        const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        const isTouchPointer = e.pointerType === 'touch';
        const isMobileLike = isTouchDevice || isTouchPointer;

        if (isMobileLike) {
          // If already selected or fast double-tap (<500ms) -> interact!
          if (spot.classList.contains('is-selected') || timeSinceLastTap < 500) {
            doInteract();
          } else {
            // First tap: select and show tooltip/explanation
            this.hotspotsLayer.querySelectorAll('.investigation-hotspot.is-selected').forEach((s) => {
              if (s !== spot) s.classList.remove('is-selected');
            });
            spot.classList.add('is-selected');
          }
        } else {
          // Desktop mouse: hover already showed tooltip, direct click interacts
          doInteract();
        }
      });

      spot.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (spot.disabled || spot.classList.contains('is-departed')) return;
        doInteract();
      });

      this.hotspotsLayer.appendChild(spot);
    });

    // Deselect hotspots when tapping outside
    if (this.hotspotsLayer && !this.hotspotsLayer.dataset.boundDeselect) {
      this.hotspotsLayer.dataset.boundDeselect = 'true';
      this.hotspotsLayer.addEventListener('click', (e) => {
        if (!e.target.closest('.investigation-hotspot')) {
          this.hotspotsLayer.querySelectorAll('.investigation-hotspot.is-selected').forEach((s) => {
            s.classList.remove('is-selected');
          });
        }
      });
    }
  }

  unlockSubItem(subQuery, optionalParent = null, optionalDesc = null) {
    if (!subQuery) return null;
    let parentEntry = optionalParent ? CODEX_DATA.find((c) => c.title === optionalParent || c.id === optionalParent) : null;
    let existingSubItem = parentEntry ? (parentEntry.subItems || []).find((s) => s.id === subQuery || s.label === subQuery) : null;

    if (!existingSubItem) {
      for (const entry of CODEX_DATA) {
        const found = (entry.subItems || []).find((s) => s.id === subQuery || s.label === subQuery);
        if (found) {
          existingSubItem = found;
          parentEntry = entry;
          break;
        }
      }
    }

    const subId = existingSubItem ? existingSubItem.id : (subQuery.startsWith('sub_') ? subQuery : `sub_${subQuery.replace(/\s+/g, '_')}`);
    const finalLabel = existingSubItem ? (existingSubItem.label || subQuery) : subQuery;
    const finalDesc = optionalDesc || (existingSubItem ? (existingSubItem.desc || existingSubItem.description) : `${finalLabel}에 대한 세부 정보입니다.`);

    if (!existingSubItem && parentEntry) {
      existingSubItem = {
        id: subId,
        label: finalLabel,
        sub: '세부 타일',
        desc: finalDesc,
        records: [
          { id: `rec_${subId}_1`, title: `${finalLabel} 발견`, text: finalDesc, unlockedByDefault: false }
        ],
        unlockedByDefault: false
      };
      parentEntry.subItems = parentEntry.subItems || [];
      parentEntry.subItems.push(existingSubItem);
    } else if (existingSubItem) {
      if (optionalDesc && !existingSubItem.desc) existingSubItem.desc = optionalDesc;
    }

    const flagKey = `unlocked_sub_${subId}`;
    const isNew = !state.getFlag(flagKey);

    if (isNew) {
      state.setFlag(flagKey, true);
      if (parentEntry) {
        state.unlockCodex(parentEntry.id);
      }
      this.playAudio('codexUnlock');
      this.showToast(`[${finalLabel}] 발견! (${parentEntry?.title || '수첩'})`, 'info', '⬜');
    }

    return {
      sub: existingSubItem || { id: subId, label: finalLabel, desc: finalDesc },
      parent: parentEntry,
      label: finalLabel,
      desc: finalDesc,
      isNew
    };
  }

  interactHotspot(hs, spotElement) {
    this.playAudio('click');
    const isCollected = state.isHotspotCollected(hs.id);
    const linkedMemoId = hs.memoId !== undefined
      ? hs.memoId
      : (hs.codexId || hs.unlockedCodexId || (hs.type === 'character' ? hs.characterId : ''));

    // 탐사 핫스팟에 연결된 세부 타일 추가 기록 해금 검사
    const targetRecordId = hs.grantsRecordId || hs.recordId || hs.unlockedRecordId;
    if (targetRecordId) {
      if (state.unlockTileRecord(targetRecordId, { tileId: hs.tileId, text: hs.recordText })) {
        this.playAudio('codexUnlock');
        this.showToast('📝 새로운 세부 설명이 수첩에 추가되었습니다!', 'info', '📝');
      }
    }

    // 탐사 핫스팟에 연결된 세부 타일 (소분류) 해금 검사
    let subItemGranted = null;
    const targetSubItemId = hs.grantsSubItemId || hs.unlockSubItemId || hs.subItemId;
    if (targetSubItemId) {
      subItemGranted = this.unlockSubItem(targetSubItemId);
    }

    // 관찰문/상황설명 내 [세부타일: 대분류 | 이름 | 설명] 태그 자동 해금 검사 (중복 해금 방지)
    const textToCheck = `${hs.inspectText || ''} ${hs.unlockedText || ''}`;
    const subTileMatch = textToCheck.match(/\[(?:세부타일|소분류|SUBITEM|DETAIL_TILE)\s*:\s*(.+?)\]/i);
    if (subTileMatch && !subItemGranted) {
      const parts = subTileMatch[1].split('|').map((s) => s.trim());
      const parentName = parts[0];
      const subName = parts[1];
      const subDesc = parts[2] || '';
      const unlocked = this.unlockSubItem(subName, parentName, subDesc);
      if (unlocked) {
        subItemGranted = unlocked;
      }
    }

    if (hs.type === 'book') {
      if (linkedMemoId && state.unlockCodex(linkedMemoId)) {
        this.playAudio('codexUnlock');
      }
      if (!isCollected) {
        state.collectHotspot(hs.id);
        this.showToast(`[${hs.title}] 책을 펼쳤습니다.`, 'success', (hs.icon && !hs.icon.includes('/')) ? hs.icon : '📖');
        this.markHotspotCollectedInDOM(spotElement);
      }
      this.openBookReader(hs);
      return;
    }

    if (hs.type === 'character') {
      const isDone = this.isCharacterDialogueDone(hs);
      if (isDone) {
        this.showToast(`${hs.characterName || hs.title}은(는) 이미 대화를 마치고 자리를 떠났습니다.`, 'info', '👤');
        return;
      }
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
      if (hs.grantsRecordId && !state.isTileRecordUnlocked(hs.grantsRecordId)) {
        state.unlockTileRecord(hs.grantsRecordId);
        this.playAudio('codexUnlock');
        this.showToast('새로운 세부 설명을 수첩에 기록했습니다!', 'success', '📝');
      }
      if (hs.unlockedFlag) {
        state.setFlag(hs.unlockedFlag, true);
      }

      this.showToast(hs.unlockedToast, 'success', '✨');
      this.showHotspotModal(hs.title, hs.unlockedText, grantedItem, hs.monologue, subItemGranted);

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
      this.showHotspotModal(hs.title, hs.inspectText, item, hs.monologue, subItemGranted);

      this.markHotspotCollectedInDOM(spotElement);
      return;
    }

    if (hs.type === 'inspect') {
      if (linkedMemoId && state.unlockCodex(linkedMemoId)) {
        this.playAudio('codexUnlock');
      }
      if (hs.grantsRecordId && !state.isTileRecordUnlocked(hs.grantsRecordId)) {
        state.unlockTileRecord(hs.grantsRecordId);
        this.playAudio('codexUnlock');
        this.showToast('새로운 세부 설명을 수첩에 기록했습니다!', 'success', '📝');
      }
      if (hs.flag) {
        state.setFlag(hs.flag, true);
      }
      if (!isCollected) {
        state.collectHotspot(hs.id);
        this.showToast(hs.toast, 'success', '🔍');
        this.markHotspotCollectedInDOM(spotElement);
      }

      this.showHotspotModal(hs.title, hs.inspectText, null, hs.monologue, subItemGranted);
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

  renderRichTextInto(containerEl, rawText, contextId = 'rich_text') {
    if (!containerEl) return;
    const lines = String(rawText ?? '').split(/\r?\n/);
    const renderedParts = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        renderedParts.push('<div style="height: 6px;"></div>');
        return;
      }
      const parsed = this.parseStoryParagraph(trimmed, idx, contextId);
      if (parsed) {
        renderedParts.push(parsed);
      }
    });
    containerEl.innerHTML = renderedParts.join('');
    this.initNovelTypewriters?.(containerEl);
    this.initDeferredStoryUnlocks?.(containerEl);
    this.initStoryQuizzes?.(containerEl);
    this.initStoryExplanationWidgets?.(containerEl);
  }

  showHotspotModal(title, description, itemGranted = null, monologue = null, subItemGranted = null) {
    const overlay = document.getElementById('inspect-detail-modal');
    if (!overlay) return;

    const titleEl = document.getElementById('inspect-modal-title');
    const descEl = document.getElementById('inspect-modal-desc');
    const monologueBox = document.getElementById('inspect-modal-monologue');
    const monologueTextEl = document.getElementById('inspect-modal-monologue-text');
    const rewardBox = document.getElementById('inspect-modal-reward');

    if (titleEl) titleEl.textContent = title;
    if (descEl) {
      this.renderRichTextInto(descEl, description, `inspect_desc_${title}`);
    }

    if (monologueBox && monologueTextEl) {
      if (monologue && String(monologue).trim()) {
        this.renderRichTextInto(monologueTextEl, String(monologue).trim(), `inspect_mono_${title}`);
        monologueBox.classList.remove('hidden');
      } else {
        monologueTextEl.innerHTML = '';
        monologueBox.classList.add('hidden');
      }
    }

    const hasInlineSubItemWidget = Boolean(descEl?.querySelector('.widget-subitem') || monologueTextEl?.querySelector('.widget-subitem'));
    const hasInlineItemWidget = Boolean(descEl?.querySelector('.widget-item') || monologueTextEl?.querySelector('.widget-item'));

    if (rewardBox) {
      let rewardHtml = '';
      if (itemGranted && !hasInlineItemWidget) {
        rewardHtml += `
          <div class="reward-pill" style="margin-bottom: ${(subItemGranted && !hasInlineSubItemWidget) ? '8px' : '0'};">
            <span class="reward-icon">${escapeHtml(itemGranted.icon || '🎁')}</span>
            <div class="reward-info">
              <strong>${escapeHtml(itemGranted.name)}</strong> 획득!
              <span class="reward-sub">소지품에 추가되었습니다.</span>
            </div>
          </div>
        `;
      }
      if (subItemGranted && !hasInlineSubItemWidget) {
        const s = subItemGranted.sub || subItemGranted;
        const p = subItemGranted.parent;
        const parentTitle = p?.title || '';
        rewardHtml += `
          <div class="reward-pill" style="background: rgba(30, 41, 59, 0.95); border: 1.5px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <span class="reward-icon" style="background: #f1f5f9; color: #0f172a; border-radius: 6px; padding: 2px 6px; font-weight: 800; font-size: 15px;">⬜</span>
            <div class="reward-info">
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <strong style="color: #fff; font-size: 14.5px;">${escapeHtml(s.label || '새로운 정보')}</strong>
                ${parentTitle ? `<span style="font-size: 12px; color: #94a3b8; font-weight: 500;">${escapeHtml(parentTitle)}</span>` : ''}
              </div>
              <span class="reward-sub" style="color: #cbd5e1; margin-top: 2px;">수첩에 새로운 정보가 등록되었습니다.</span>
            </div>
          </div>
        `;
      }

      if (rewardHtml) {
        rewardBox.innerHTML = rewardHtml;
        rewardBox.classList.remove('hidden');
      } else {
        rewardBox.innerHTML = '';
        rewardBox.classList.add('hidden');
      }
    }

    overlay.classList.remove('hidden');

    const closeHandler = () => {
      overlay.classList.add('hidden');
    };

    const closeBtn = document.getElementById('inspect-modal-close');
    const closeTopBtn = document.getElementById('inspect-modal-close-top');
    if (closeBtn) closeBtn.onclick = closeHandler;
    if (closeTopBtn) closeTopBtn.onclick = closeHandler;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeHandler();
    };
  }

  openCharacterDialogue(hs, isFirstEncounter = false) {
    if (!this.dialogueModal) return;
    this.currentDialogueHotspot = hs;
    this.currentDialogueTree = hs.dialogueTree;
    this.currentDialogueNodeKey = 'start';
    this.currentDialoguePromptText = '';
    this.dialogueHadInteraction = false;

    const charNameEl = document.getElementById('dialogue-char-name');
    const charRoleEl = document.getElementById('dialogue-char-role');
    const avatarEl = document.querySelector('.dialogue-avatar');
    const badgeEl = document.getElementById('dialogue-char-badge');
    const widgetEl = document.getElementById('dialogue-new-char-widget');
    const monologueBox = document.getElementById('dialogue-monologue-box');
    const monologueTextEl = document.getElementById('dialogue-monologue-text');

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

    if (monologueBox && monologueTextEl) {
      if (hs.monologue && String(hs.monologue).trim()) {
        this.renderRichTextInto(monologueTextEl, String(hs.monologue).trim(), `char_mono_${hs.id || 'char'}`);
        monologueBox.classList.remove('hidden');
      } else {
        monologueTextEl.innerHTML = '';
        monologueBox.classList.add('hidden');
      }
    }

    let unlockedSubHtml = '';
    const targetSubItemId = hs.grantsSubItemId || hs.unlockSubItemId || hs.subItemId;
    if (targetSubItemId) {
      const unlockedSub = this.unlockSubItem(targetSubItemId);
      if (unlockedSub) {
        const s = unlockedSub.sub || unlockedSub;
        const p = unlockedSub.parent;
        const parentTitle = p?.title || '';
        unlockedSubHtml = `
          <div class="story-game-widget widget-subitem ${unlockedSub.isNew ? 'is-new-anim' : ''}" style="margin: 0 0 12px 0;">
            <div class="widget-header">
              <span class="widget-badge" style="background:#1E293B; color:#E2E8F0; border:1px solid rgba(226, 232, 240, 0.4);">⬜ 새로운 정보</span>
              <span class="widget-status">${unlockedSub.isNew ? '✨ 새로 등록됨' : '✔️ 수첩에 등록됨'}</span>
            </div>
            <div class="widget-body">
              <div class="widget-icon" style="background:#F8FAFC; color:#0F172A; border-radius:8px; width:44px; height:44px; display:grid; place-items:center; font-size:20px; font-weight:800; border:2px solid #CBD5E1; box-shadow:0 2px 8px rgba(0,0,0,0.15);">⬜</div>
              <div class="widget-details">
                <div class="widget-name" style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">
                  <strong style="color:var(--text-main); font-size:15px;">${escapeHtml(s.label || '새로운 정보')}</strong>
                  ${parentTitle ? `<span style="font-size:12px; font-weight:500; color:#94A3B8;">${escapeHtml(parentTitle)}</span>` : ''}
                </div>
                <p class="widget-desc" style="margin:4px 0 0 0; font-size:13px; line-height:1.5; color:var(--text-muted);">${escapeHtml(s.desc || `${s.label}에 대한 세부 정보입니다.`)}</p>
              </div>
            </div>
          </div>
        `;
      }
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
        ${unlockedSubHtml}
      `;
    }

    this.dialogueModal.classList.remove('hidden');
    this.renderDialogueStep();

    const closeBtn = document.getElementById('dialogue-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.finishCharacterDialogue(this.dialogueHadInteraction);
      };
    }
    this.dialogueModal.onclick = (e) => {
      if (e.target === this.dialogueModal) {
        this.finishCharacterDialogue(this.dialogueHadInteraction);
      }
    };
  }

  renderMessengerDialogueInto(container, rawText, contextId = 'dlg') {
    if (!container) return;
    if (this.messengerRevealTimers) {
      this.messengerRevealTimers.forEach((t) => clearTimeout(t));
    }
    this.messengerRevealTimers = [];

    const hs = this.currentDialogueHotspot || {};
    const node = this.currentDialogueTree?.[this.currentDialogueNodeKey] || {};
    const npcName = hs.characterName || node.speaker || hs.title || '상대';
    const avatarSrc = hs.avatar || (hs.icon && hs.icon.includes('/') ? hs.icon : (hs.image && hs.image.includes('/') ? hs.image : ''));
    const npcIcon = hs.icon && !hs.icon.includes('/') ? hs.icon : '👤';
    const playerName = state.getPlayer()?.name?.split(' ')[0] || '레이든';

    const rawLines = String(rawText || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const isQuoteLine = (str) => /^[“"‘'「『]/.test(str) || /[”"’'」』]$/.test(str);
    const hasAnyQuotes = rawLines.some((l) => isQuoteLine(l));

    const stripOuterQuotes = (str) => {
      const m = str.match(/^([“"'])(.+?)([”"'])$/);
      if (m) {
        const inner = m[2].trim();
        if (!/[“”"']/.test(inner)) return inner;
      }
      return str;
    };

    const entries = [];
    if (this.currentDialoguePromptText) {
      entries.push({
        type: 'bubble',
        speaker: 'player',
        html: this.formatNovelText(stripOuterQuotes(this.currentDialoguePromptText))
      });
    }

    let nextSpeaker = 'npc';

    rawLines.forEach((line, idx) => {
      // 1. Explicit speaker prefixes: "레이든: ...", "나: ...", "주인공: ..." or "상대: ..."
      const playerPrefix = line.match(/^(?:\[(?:레이든|주인공|나)\]|(?:레이든|주인공|나)\s*[:：])\s*(.+)$/);
      if (playerPrefix) {
        entries.push({
          type: 'bubble',
          speaker: 'player',
          html: this.formatNovelText(stripOuterQuotes(playerPrefix[1].trim()))
        });
        nextSpeaker = 'npc';
        return;
      }

      const npcPrefix = line.match(/^(?:\[(?:상대|인물|NPC)\]|(?:상대|인물|NPC)\s*[:：])\s*(.+)$/i);
      if (npcPrefix) {
        entries.push({
          type: 'bubble',
          speaker: 'npc',
          html: this.formatNovelText(stripOuterQuotes(npcPrefix[1].trim()))
        });
        nextSpeaker = 'player';
        return;
      }

      // 2. Game widgets / special block tags
      const parsedHtml = this.parseStoryParagraph(line, idx, contextId);
      if (!parsedHtml) return;
      if (parsedHtml.trim().startsWith('<div ')) {
        entries.push({
          type: 'widget',
          html: parsedHtml
        });
        nextSpeaker = 'npc';
        return;
      }

      // 3. Quoted dialogue line (or single unquoted line node) -> alternates between NPC and Protagonist
      if (isQuoteLine(line) || (!hasAnyQuotes && rawLines.length <= 2)) {
        const speaker = nextSpeaker;
        nextSpeaker = speaker === 'npc' ? 'player' : 'npc';
        entries.push({
          type: 'bubble',
          speaker,
          html: this.formatNovelText(stripOuterQuotes(line))
        });
        return;
      }

      // 4. Unquoted narration / monologue line
      entries.push({
        type: 'narration',
        html: this.formatNovelText(line)
      });
      nextSpeaker = 'npc';
    });

    container.innerHTML = '';
    const scrollBox = document.getElementById('dialogue-speech-container') || container.parentElement;

    const buildEntryNode = (entry) => {
      const wrapper = document.createElement('div');
      if (entry.type === 'bubble') {
        const isPlayer = entry.speaker === 'player';
        wrapper.className = `chat-bubble-row ${isPlayer ? 'is-player' : 'is-npc'}`;
        const avatarInner = isPlayer
          ? '🕵️'
          : (avatarSrc ? `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(npcName)}">` : escapeHtml(npcIcon));
        const labelText = isPlayer ? `${playerName} (나)` : npcName;
        wrapper.innerHTML = `
          <div class="chat-mini-avatar">${avatarInner}</div>
          <div class="chat-bubble-wrap">
            <span class="chat-speaker-label">${escapeHtml(labelText)}</span>
            <div class="chat-bubble-body">${entry.html}</div>
          </div>
        `;
      } else if (entry.type === 'narration') {
        wrapper.className = 'chat-narration-row';
        wrapper.innerHTML = `💭 ${entry.html}`;
      } else {
        wrapper.className = 'chat-event-row';
        wrapper.innerHTML = entry.html;
      }
      return wrapper;
    };

    const domNodes = entries.map(buildEntryNode);

    if (domNodes.length <= 2) {
      domNodes.forEach((n) => container.appendChild(n));
      this.initNovelTypewriters(container);
      this.bindInlineStoryWidgets(container);
      if (scrollBox) scrollBox.scrollTop = 0;
      return;
    }

    const skipHint = document.createElement('div');
    skipHint.className = 'messenger-skip-hint';
    skipHint.textContent = '💬 대화가 진행 중입니다 — 대화창을 클릭하면 전체 대화를 한 번에 표시합니다';
    container.appendChild(skipHint);

    let revealedCount = 0;
    const revealAllRemaining = () => {
      if (this.messengerRevealTimers) {
        this.messengerRevealTimers.forEach((t) => clearTimeout(t));
        this.messengerRevealTimers = [];
      }
      while (revealedCount < domNodes.length) {
        container.appendChild(domNodes[revealedCount]);
        revealedCount++;
      }
      if (skipHint.parentNode) skipHint.remove();
      this.initNovelTypewriters(container);
      this.bindInlineStoryWidgets(container);
    };

    skipHint.addEventListener('click', (e) => {
      e.stopPropagation();
      revealAllRemaining();
    });

    if (scrollBox) {
      scrollBox.onclick = (e) => {
        if (e.target.closest('button, a, .story-game-widget')) return;
        if (revealedCount < domNodes.length) {
          revealAllRemaining();
        }
      };
    }

    domNodes.forEach((nodeEl, i) => {
      const delay = i === 0 ? 0 : i * 380;
      const timer = setTimeout(() => {
        if (revealedCount <= i) {
          container.appendChild(nodeEl);
          revealedCount = i + 1;
          this.bindInlineStoryWidgets(nodeEl);
          if (scrollBox) {
            scrollBox.scrollTop = scrollBox.scrollHeight;
          }
          if (revealedCount >= domNodes.length && skipHint.parentNode) {
            skipHint.remove();
            this.initNovelTypewriters(container);
          }
        }
      }, delay);
      this.messengerRevealTimers.push(timer);
    });
  }

  bindInlineStoryWidgets(container) {
    if (!container) return;
    this.initNovelTypewriters?.(container);
    this.initDeferredStoryUnlocks?.(container);
    this.initStoryQuizzes?.(container);
    this.initStoryExplanationWidgets?.(container);
    this.initItemAcquisitionWidgets?.(container);
  }

  renderDialogueStep() {
    if (!this.currentDialogueTree || !this.currentDialogueNodeKey) return;
    const node = this.currentDialogueTree[this.currentDialogueNodeKey];
    if (!node) {
      this.closeCharacterDialogue();
      return;
    }

    // On follow-up question nodes, collapse character registration & initial monologue to maximize messenger height
    const isStartNode = this.currentDialogueNodeKey === 'start';
    const widgetEl = document.getElementById('dialogue-new-char-widget');
    const monologueBox = document.getElementById('dialogue-monologue-box');
    const hs = this.currentDialogueHotspot;
    if (widgetEl) {
      widgetEl.style.display = isStartNode ? '' : 'none';
    }
    if (monologueBox) {
      const hasMono = Boolean(hs?.monologue && String(hs.monologue).trim());
      if (isStartNode && hasMono) {
        monologueBox.classList.remove('hidden');
      } else {
        monologueBox.classList.add('hidden');
      }
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
      this.renderMessengerDialogueInto(textEl, node.text || '', `dlg_${this.currentDialogueNodeKey}`);
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
            this.finishCharacterDialogue(true);
          } else {
            this.dialogueHadInteraction = true;
            this.currentDialoguePromptText = opt.nextNode === 'start' ? '' : (opt.text || '');
            this.currentDialogueNodeKey = opt.nextNode;
            this.renderDialogueStep();
          }
        });

        optionsContainer.appendChild(btn);
      });
    }
  }

  finishCharacterDialogue(markCompleted = true) {
    const hs = this.currentDialogueHotspot;
    this.closeCharacterDialogue();

    if (hs && markCompleted) {
      state.collectHotspot(hs.id);
      state.setFlag(`dialogue_done_${hs.id}`, true);

      // 장면 내 인물 버튼 요소 제거 또는 비활성화
      const spotEl = this.hotspotsLayer?.querySelector(`[data-id="${hs.id}"]`);
      if (spotEl) {
        if (hs.hideAfterDialogue !== false) {
          spotEl.classList.add('hotspot-departing');
          setTimeout(() => {
            if (spotEl.parentNode) spotEl.remove();
          }, 500);
        } else {
          spotEl.classList.add('is-collected', 'is-departed');
          spotEl.disabled = true;
          spotEl.style.pointerEvents = 'none';
          spotEl.style.opacity = '0.35';
          const tip = spotEl.querySelector('.hotspot-tooltip');
          if (tip) tip.innerHTML = `${escapeHtml(hs.title)} <span class="status-checked">[대화 완료 - 자리 비움]</span>`;
        }
      }

      this.showToast(`[${hs.characterName || hs.title}] 대화를 마쳤습니다.`, 'info', '👤');
    }
  }

  isCharacterDialogueDone(hs) {
    if (!hs) return false;
    if (state.isHotspotCollected(hs.id)) return true;
    if (state.getFlag(`dialogue_done_${hs.id}`)) return true;
    if (hs.dialogueTree) {
      const flags = state.data?.flags || {};
      for (const nodeKey of Object.keys(hs.dialogueTree)) {
        if (nodeKey === 'start') continue;
        for (const k of Object.keys(flags)) {
          if (k.includes(`dlg_${nodeKey}`)) {
            state.collectHotspot(hs.id);
            return true;
          }
        }
      }
    }
    return false;
  }

  closeCharacterDialogue() {
    if (this.messengerRevealTimers) {
      this.messengerRevealTimers.forEach((t) => clearTimeout(t));
      this.messengerRevealTimers = [];
    }
    if (this.dialogueModal) {
      this.dialogueModal.classList.add('hidden');
    }
    this.currentDialogueHotspot = null;
    this.currentDialogueTree = null;
    this.currentDialogueNodeKey = null;
    this.currentDialoguePromptText = '';
  }

  initBookReader() {
    this.bookReaderModal = document.getElementById('book-reader-modal');
    if (!this.bookReaderModal) return;

    this.bookTitleEl = document.getElementById('book-title');
    this.bookMonologueBox = document.getElementById('book-monologue');
    this.bookMonologueTextEl = document.getElementById('book-monologue-text');
    this.bookPageBadgeEl = document.getElementById('book-page-badge');
    this.bookPageTitleEl = document.getElementById('book-page-title');
    this.bookPageContentEl = document.getElementById('book-page-content');
    this.bookIndexNavEl = document.getElementById('book-index-nav');
    this.bookPrevPageBtn = document.getElementById('book-prev-page-btn');
    this.bookNextPageBtn = document.getElementById('book-next-page-btn');
    this.bookPageIndicatorEl = document.getElementById('book-page-indicator');
    this.bookCloseTopBtn = document.getElementById('book-close-top-btn');
    this.bookCloseBottomBtn = document.getElementById('book-close-bottom-btn');
    const backdrop = this.bookReaderModal.querySelector('.book-reader-backdrop');

    this.currentBookHotspot = null;
    this.currentBookPageIndex = 0;

    if (this.bookPrevPageBtn) {
      this.bookPrevPageBtn.addEventListener('click', () => this.changeBookPage(-1));
    }
    if (this.bookNextPageBtn) {
      this.bookNextPageBtn.addEventListener('click', () => this.changeBookPage(1));
    }
    if (this.bookCloseTopBtn) {
      this.bookCloseTopBtn.addEventListener('click', () => this.closeBookReader());
    }
    if (this.bookCloseBottomBtn) {
      this.bookCloseBottomBtn.addEventListener('click', () => this.closeBookReader());
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeBookReader());
    }
  }

  openBookReader(hs) {
    if (!this.bookReaderModal) return;
    this.currentBookHotspot = hs;
    this.currentBookPageIndex = 0;

    const targetSubItemId = hs.grantsSubItemId || hs.unlockSubItemId || hs.subItemId;
    if (targetSubItemId) {
      this.unlockSubItem(targetSubItemId);
    }

    if (this.bookTitleEl) {
      this.bookTitleEl.textContent = hs.title || '고서 열람';
    }

    if (this.bookMonologueBox && this.bookMonologueTextEl) {
      if (hs.monologue && String(hs.monologue).trim()) {
        this.renderRichTextInto(this.bookMonologueTextEl, String(hs.monologue).trim(), `book_mono_${hs.id || 'book'}`);
        this.bookMonologueBox.classList.remove('hidden');
      } else {
        this.bookMonologueTextEl.innerHTML = '';
        this.bookMonologueBox.classList.add('hidden');
      }
    }

    this.bookReaderModal.classList.remove('hidden');
    this.playAudio('click');
    this.renderBookPage();
  }

  closeBookReader() {
    if (!this.bookReaderModal) return;
    this.bookReaderModal.classList.add('hidden');
    this.currentBookHotspot = null;
  }

  goToBookPage(pageIndex) {
    const pages = this.currentBookHotspot?.pages || [];
    if (pageIndex < 0 || pageIndex >= pages.length) return;
    this.currentBookPageIndex = pageIndex;
    this.playAudio('click');
    this.renderBookPage();
  }

  changeBookPage(delta) {
    this.goToBookPage(this.currentBookPageIndex + delta);
  }

  renderBookPage() {
    const hs = this.currentBookHotspot;
    if (!hs) return;
    const pages = hs.pages && hs.pages.length > 0 ? hs.pages : [
      {
        indexTitle: '1장: 내용',
        pageTitle: hs.title || '첫 번째 쪽',
        content: hs.inspectText || '기록된 내용이 없습니다.'
      }
    ];

    if (this.currentBookPageIndex >= pages.length) {
      this.currentBookPageIndex = pages.length - 1;
    }
    if (this.currentBookPageIndex < 0) {
      this.currentBookPageIndex = 0;
    }

    const curPage = pages[this.currentBookPageIndex];

    if (this.bookPageBadgeEl) {
      this.bookPageBadgeEl.textContent = `제 ${this.currentBookPageIndex + 1} 쪽`;
    }
    if (this.bookPageTitleEl) {
      this.bookPageTitleEl.textContent = curPage.pageTitle || `제 ${this.currentBookPageIndex + 1} 장`;
    }
    if (this.bookPageIndicatorEl) {
      this.bookPageIndicatorEl.textContent = `${this.currentBookPageIndex + 1} / ${pages.length} 쪽`;
    }
    if (this.bookPrevPageBtn) {
      this.bookPrevPageBtn.disabled = this.currentBookPageIndex === 0;
    }
    if (this.bookNextPageBtn) {
      this.bookNextPageBtn.disabled = this.currentBookPageIndex >= pages.length - 1;
    }

    // Render Side Index Tabs
    if (this.bookIndexNavEl) {
      this.bookIndexNavEl.innerHTML = pages.map((page, idx) => {
        const isActive = idx === this.currentBookPageIndex;
        const tabLabel = page.indexTitle || page.pageTitle || `${idx + 1}쪽`;
        return `
          <button type="button" class="book-index-tab ${isActive ? 'is-active' : ''}" data-page-index="${idx}" title="${escapeHtml(tabLabel)}">
            <span class="book-index-label">${isActive ? '▶ ' : '🔖 '}${escapeHtml(tabLabel)}</span>
            <span class="book-index-page-num">${idx + 1}p</span>
          </button>
        `;
      }).join('');

      this.bookIndexNavEl.querySelectorAll('.book-index-tab').forEach((tab) => {
        tab.onclick = () => {
          const targetIdx = Number(tab.dataset.pageIndex);
          if (Number.isFinite(targetIdx)) {
            this.goToBookPage(targetIdx);
          }
        };
      });
    }

    // Render Page Content (supports paragraphs and story tags / widgets!)
    if (this.bookPageContentEl) {
      const rawContent = curPage.content || '';
      const paragraphs = rawContent.split(/\r?\n/).filter((p) => p.trim().length > 0);
      if (paragraphs.length === 0) {
        this.bookPageContentEl.innerHTML = '<p class="book-paragraph" style="color: var(--text-muted); font-style: italic;">이 페이지는 백지입니다.</p>';
      } else {
        const renderedHtml = paragraphs.map((para, pIdx) => {
          const trimmed = para.trim();
          // Check if it's a widget or tag
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const parsedWidget = this.parseStoryParagraph(trimmed, pIdx, `book_${hs.id}_p${this.currentBookPageIndex}`);
            if (parsedWidget) return parsedWidget;
          }
          // Regular text formatting
          const parsedParagraph = this.parseStoryParagraph(trimmed, pIdx, `book_${hs.id}_p${this.currentBookPageIndex}`);
          if (parsedParagraph) return parsedParagraph;
          let formattedText = this.formatNovelText(trimmed);
          return `<p class="book-paragraph">${formattedText}</p>`;
        }).join('');

        this.bookPageContentEl.innerHTML = renderedHtml;

        // Wire any interactive widgets (e.g. typewriters, quiz or explanation popups if any tag had it)
        this.initNovelTypewriters?.(this.bookPageContentEl);
        this.initStoryQuizzes?.(this.bookPageContentEl);
        this.initStoryExplanationWidgets?.(this.bookPageContentEl);
      }
      this.bookPageContentEl.scrollTop = 0;
    }
  }
}