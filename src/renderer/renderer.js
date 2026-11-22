const topbar = document.getElementById('topbar');
const jungleWidget = document.getElementById('jungleWidget');
const statusBadge = document.getElementById('statusBadge');
const lockStatus = document.getElementById('lockStatus');
const viewWaiting = document.getElementById('viewWaiting');
const viewChampSelect = document.getElementById('viewChampSelect');
const viewInGame = document.getElementById('viewInGame');

const btnDemoChamp = document.getElementById('btnDemoChamp');
const btnDemoGame = document.getElementById('btnDemoGame');
const btnLiveMode = document.getElementById('btnLiveMode');
const btnQuit = document.getElementById('btnQuit');

// Interactive Jungle Camp Timers State (stores target expiration timestamp in ms)
const campTimers = {};
const epicManualOverrides = {};

// Smart Click-Through: Only capture clicks when the mouse is over the Top Control Bar or Jungle Camp Buttons!
function enableInteractiveHover(el) {
  if (!el) return;
  el.addEventListener('mouseenter', () => {
    window.poromac.setIgnoreMouseEvents(false);
  });
  el.addEventListener('mouseleave', () => {
    window.poromac.setIgnoreMouseEvents(true);
  });
}

enableInteractiveHover(topbar);
enableInteractiveHover(jungleWidget);

// Setup click handlers for Jungle Camp buttons
document.querySelectorAll('.camp-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const campKey = btn.dataset.camp;
    const cooldownSec = parseInt(btn.dataset.cd, 10) || 300;
    const now = Date.now();

    // If already running and clicked again within 2s -> reset to ALIVE, else restart timer
    if (campTimers[campKey] && campTimers[campKey] > now) {
      delete campTimers[campKey];
    } else {
      campTimers[campKey] = now + cooldownSec * 1000;
    }
    updateJungleCampUI();
  });
});

// Allow clicking Epic Objective boxes (Drake, Pit, Baron) to manually start/reset their timer if killed out of vision
document.getElementById('dragonBox')?.addEventListener('click', () => {
  toggleManualEpicTimer('dragon', 300);
});
document.getElementById('pitBox')?.addEventListener('click', () => {
  toggleManualEpicTimer('topPit', 240);
});
document.getElementById('baronBox')?.addEventListener('click', () => {
  toggleManualEpicTimer('baron', 360);
});

function toggleManualEpicTimer(key, cdSec) {
  const now = Date.now();
  if (epicManualOverrides[key] && epicManualOverrides[key] > now) {
    delete epicManualOverrides[key];
  } else {
    epicManualOverrides[key] = now + cdSec * 1000;
  }
}

function updateJungleCampUI() {
  const now = Date.now();
  document.querySelectorAll('.camp-btn').forEach((btn) => {
    const campKey = btn.dataset.camp;
    const timerEl = document.getElementById(`timer_${campKey}`);
    if (!timerEl) return;

    const target = campTimers[campKey];
    if (!target || target <= now) {
      delete campTimers[campKey];
      timerEl.textContent = 'ALIVE';
      timerEl.className = 'camp-time';
      btn.classList.remove('active-timer', 'spawning-soon');
    } else {
      const remSec = Math.ceil((target - now) / 1000);
      timerEl.textContent = formatSeconds(remSec);
      if (remSec <= 15) {
        timerEl.className = 'camp-time imminent';
        btn.classList.add('spawning-soon');
        btn.classList.remove('active-timer');
      } else {
        timerEl.className = 'camp-time counting';
        btn.classList.add('active-timer');
        btn.classList.remove('spawning-soon');
      }
    }
  });
}

// Tick local camp countdowns every second
setInterval(updateJungleCampUI, 1000);

btnDemoChamp.addEventListener('click', () => {
  // Seed demo camp timers so user immediately sees Jungle Tracking in action
  const now = Date.now();
  campTimers.allyBlue = now + 82 * 1000;
  campTimers.enemyRed = now + 14 * 1000;
  campTimers.topScuttle = now + 45 * 1000;
  window.poromac.setDemoMode('champSelect');
});

btnDemoGame.addEventListener('click', () => {
  const now = Date.now();
  campTimers.allyBlue = now + 112 * 1000;
  campTimers.enemyBlue = now + 48 * 1000;
  campTimers.enemyRed = now + 12 * 1000;
  campTimers.topScuttle = now + 64 * 1000;
  campTimers.enemyRaptors = now + 29 * 1000;
  updateJungleCampUI();
  window.poromac.setDemoMode('inGame');
});

btnLiveMode.addEventListener('click', () => {
  window.poromac.setDemoMode(null);
});

btnQuit.addEventListener('click', () => {
  window.poromac.quitApp();
});

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateActiveButtons(demoMode) {
  btnDemoChamp.classList.toggle('active', demoMode === 'champSelect');
  btnDemoGame.classList.toggle('active', demoMode === 'inGame');
  btnLiveMode.classList.toggle('active', !demoMode);
}

function renderChampSelect(data) {
  document.getElementById('champTimer').textContent = `${data.timer || 0}s`;
  const container = document.getElementById('teamCardsContainer');

  const cardsHtml = (data.myTeam || [])
    .map((p) => {
      const wrClass = p.winrate >= 55 ? 'high' : p.winrate <= 47 ? 'low' : '';
      const totalGames = (p.wins || 0) + (p.losses || 0);
      const tagsHtml = (p.tags || [])
        .map((t) => `<span class="poro-tag ${t.type || 'neutral'}">${t.label}</span>`)
        .join('');

      return `
        <div class="player-card">
          <div class="card-top">
            <div class="card-top-left">
              <img class="champ-avatar" src="${p.champion?.icon || ''}" alt="${p.champion?.name || ''}" />
              <div class="player-ident">
                <div class="role-badge">${p.position || 'FLEX'} • ${p.champion?.name || 'Selecting...'}</div>
                <div class="summoner-name" title="${p.summonerName}">${p.summonerName}</div>
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <div class="rank-title">${p.rank || 'Unranked'}</div>
              <div class="rank-lp">${p.lp || 0} LP</div>
            </div>
          </div>

          <div class="winrate-box">
            <div class="wr-header">
              <span>WR (${totalGames}G): <strong class="wr-percent ${wrClass}">${p.winrate}%</strong></span>
              <span>KDA: <strong>${p.recentKda}</strong> (${p.kdaRatio})</span>
            </div>
            <div class="wr-bar-bg">
              <div class="wr-bar-fill" style="width: ${Math.min(100, Math.max(10, p.winrate))}%"></div>
            </div>
          </div>

          <div class="tags-list">
            ${tagsHtml}
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = cardsHtml;
}

function renderEpicTimerElement(el, objData, overrideKey) {
  if (!el || !objData) return;
  const now = Date.now();
  if (epicManualOverrides[overrideKey] && epicManualOverrides[overrideKey] > now) {
    const rem = Math.ceil((epicManualOverrides[overrideKey] - now) / 1000);
    el.textContent = formatSeconds(rem);
    el.className = 'obj-timer respawning';
    return;
  }

  if (objData.status === 'ALIVE') {
    el.textContent = 'ALIVE';
    el.className = 'obj-timer';
  } else if (objData.status === 'SLAIN' || objData.status === 'DESPAWNED') {
    el.textContent = objData.status;
    el.className = 'obj-timer slain';
  } else {
    el.textContent = formatSeconds(objData.remainingSec);
    el.className = 'obj-timer respawning';
  }
}

function renderInGame(data) {
  const me = data.activePlayer || {};
  document.getElementById('hudChampName').textContent = me.championName || 'Summoner';
  document.getElementById('hudLevel').textContent = `Lv. ${me.level || 1}`;
  document.getElementById('hudGameClock').textContent = formatSeconds(data.gameTime || 0);

  document.getElementById('hudKda').textContent = `${me.kills || 0} / ${me.deaths || 0} / ${me.assists || 0}`;
  document.getElementById('hudKdaRatio').textContent = `${me.kdaRatio || 0} KDA`;

  document.getElementById('hudCs').textContent = `${me.creepScore || 0} (${me.csPerMin || 0}/m)`;
  let csPace = 'Solid Pace';
  if (me.csPerMin >= 8.0) csPace = 'Challenger Pace 🔥';
  else if (me.csPerMin >= 7.0) csPace = 'Diamond Pace ⚡';
  else if (me.csPerMin < 5.0) csPace = 'Focus Farm 🌱';
  document.getElementById('hudCsRating').textContent = csPace;

  document.getElementById('hudGold').textContent = `${(me.currentGold || 0).toLocaleString()} G`;
  document.getElementById('hudWardScore').textContent = `Vision Score: ${me.wardScore || 0}`;

  // Epic Objective Timers (Drake, Voidgrubs/Herald, Baron)
  renderEpicTimerElement(document.getElementById('dragonTimer'), data.objectives?.dragon, 'dragon');
  renderEpicTimerElement(document.getElementById('baronTimer'), data.objectives?.baron, 'baron');

  const topPit = data.objectives?.topPit;
  if (topPit) {
    document.getElementById('pitIcon').textContent = topPit.icon || '🐛';
    document.getElementById('pitName').textContent = topPit.name || 'Voidgrubs';
    renderEpicTimerElement(document.getElementById('pitTimer'), topPit, 'topPit');
  }

  updateJungleCampUI();

  // Live Teams Table (with live item inventories for allies & enemies!)
  const renderTeamRows = (players, isChaos) =>
    (players || [])
      .map((p) => {
        const miniItemsHtml = (p.inventorySlots || p.items || [])
          .slice(0, 6)
          .map((item) =>
            item
              ? `<img class="lp-mini-item" src="${item.icon}" alt="${item.name}" title="${item.name}" />`
              : `<span class="lp-mini-empty"></span>`
          )
          .join('');

        return `
      <div class="live-player-row ${isChaos ? 'chaos' : ''} ${p.isDead ? 'dead' : ''}">
        <div class="lp-left">
          <div class="lp-champ">${p.championName} <span class="lp-meta">Lv.${p.level}</span></div>
          <div class="lp-items-row">${miniItemsHtml}</div>
        </div>
        <div class="lp-stats">
          ${
            p.isDead
              ? `<span class="dead-badge">💀 ${p.respawnTimer}s</span>`
              : `<div>${p.kills}/${p.deaths}/${p.assists}</div><div class="lp-meta">${p.cs} CS</div>`
          }
        </div>
      </div>
    `;
      })
      .join('');

  document.getElementById('orderTeamCol').innerHTML = renderTeamRows(data.teams?.ORDER, false);
  document.getElementById('chaosTeamCol').innerHTML = renderTeamRows(data.teams?.CHAOS, true);

  if (data.buildAnalysis) {
    renderBuildAdvisor(data.buildAnalysis);
  }
}

function renderBuildAdvisor(build) {
  const archEl = document.getElementById('buildArchetypeBadge');
  if (archEl) archEl.textContent = build.archetype || 'CORE';

  // 1. Enemy Damage Split & Threat Alerts
  const threat = build.threatAnalysis || { adPercent: 50, apPercent: 50, alerts: [] };
  const adLabel = document.getElementById('enemyAdLabel');
  const apLabel = document.getElementById('enemyApLabel');
  const adBar = document.getElementById('enemyAdBar');
  const apBar = document.getElementById('enemyApBar');

  if (adLabel) adLabel.textContent = `Gegner AD: ${threat.adPercent}%`;
  if (apLabel) apLabel.textContent = `AP: ${threat.apPercent}%`;
  if (adBar) adBar.style.width = `${threat.adPercent}%`;
  if (apBar) apBar.style.width = `${threat.apPercent}%`;

  const alertsRow = document.getElementById('threatAlertsRow');
  if (alertsRow) {
    alertsRow.innerHTML = (threat.alerts || [])
      .map(
        (a) =>
          `<span class="threat-badge ${a.type || 'warning'}" title="${a.detail || ''}">⚠️ ${a.label}</span>`
      )
      .join('');
  }

  // 2. Current Owned Items (6 Main Slots + 1 Trinket Slot)
  const ownedContainer = document.getElementById('ownedItemsContainer');
  if (ownedContainer) {
    const slots = [];
    const invSlots = build.inventorySlots || build.currentItems || [];
    for (let i = 0; i < 6; i++) {
      const item = invSlots[i];
      if (item) {
        const countBadge = item.count > 1 ? `<span class="slot-count">${item.count}</span>` : '';
        slots.push(`
          <div class="owned-slot filled" title="${item.name} (${item.cost || 0} G)">
            <img src="${item.icon}" alt="${item.name}" />
            ${countBadge}
          </div>
        `);
      } else {
        slots.push(`<div class="owned-slot empty" title="Leerer Slot ${i + 1}"></div>`);
      }
    }

    // Add Trinket Slot (Slot 7)
    const trinket = build.trinketSlot;
    if (trinket) {
      slots.push(`
        <div class="owned-slot trinket filled" title="Trinket: ${trinket.name}">
          <img src="${trinket.icon}" alt="${trinket.name}" />
        </div>
      `);
    } else {
      slots.push(`<div class="owned-slot trinket empty" title="Kein Trinket"></div>`);
    }

    ownedContainer.innerHTML = slots.join('');
  }

  // 3. Immediate Recall / Gold Buy Window Banner
  const banner = document.getElementById('recallAdviceBanner');
  const headline = document.getElementById('recallHeadline');
  const subtext = document.getElementById('recallSubtext');
  const advice = build.recallAdvice || {};

  if (banner && headline && subtext) {
    banner.className = `recall-banner ${(advice.status || 'FARM').toLowerCase()}`;
    headline.textContent = advice.headline || '';
    subtext.textContent = advice.subtext || '';
  }

  // 4. Recommended Next Items Cards
  const nextContainer = document.getElementById('nextItemsContainer');
  if (nextContainer) {
    nextContainer.innerHTML = (build.nextItems || [])
      .map((item, idx) => {
        let goldBadgeHtml = '';
        if (item.canAffordFull) {
          goldBadgeHtml = `<span class="buy-tag ready">JETZT KAUFBAR (${item.remainingCost} G)</span>`;
        } else if (item.nextComponentBuy && item.nextComponentBuy.canAfford) {
          goldBadgeHtml = `<span class="buy-tag comp">Teil-Item: ${item.nextComponentBuy.name} (${item.nextComponentBuy.cost} G)</span>`;
        } else {
          goldBadgeHtml = `<span class="buy-tag missing">Noch ${item.goldNeeded} G (${item.remainingCost} G)</span>`;
        }

        const ownedCompHint =
          item.ownedComponents && item.ownedComponents.length > 0
            ? `<div class="rec-comp-owned">✓ Im Inventar: ${item.ownedComponents.join(', ')}</div>`
            : '';

        return `
          <div class="rec-item-card ${idx === 0 ? 'primary-rec' : ''} ${item.canAffordFull ? 'affordable' : ''}">
            <div class="rec-item-left">
              <img class="rec-item-icon" src="${item.icon}" alt="${item.name}" />
              <div class="rec-item-info">
                <div class="rec-item-top">
                  <span class="rec-cat-tag">${item.category}</span>
                  ${goldBadgeHtml}
                </div>
                <div class="rec-item-name">${item.name}</div>
                <div class="rec-item-reason">${item.reason}</div>
                ${ownedCompHint}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }
}

window.poromac.onOverlayModeChanged((mode) => {
  lockStatus.textContent = mode.isClickThrough ? 'AN (Gesperrt)' : 'AUS';
  lockStatus.style.color = mode.isClickThrough ? '#34d399' : '#f0f4f8';
});

window.poromac.onLeagueStateUpdate((state) => {
  updateActiveButtons(state.demoMode);
  lockStatus.textContent = state.isClickThrough ? 'AN (Gesperrt)' : 'AUS';

  if (state.demoMode) {
    statusBadge.textContent = state.demoMode === 'champSelect' ? 'DEMO: CHAMP SELECT' : 'DEMO: IN-GAME';
    statusBadge.className = 'status-badge demo';
  } else if (state.connected) {
    statusBadge.textContent = `Verbunden (${state.phase})`;
    statusBadge.className = 'status-badge connected';
  } else {
    statusBadge.textContent = 'Warte auf LoL Client...';
    statusBadge.className = 'status-badge';
  }

  if (state.phase === 'ChampSelect') {
    viewWaiting.classList.add('hidden');
    viewInGame.classList.add('hidden');
    viewChampSelect.classList.remove('hidden');
    renderChampSelect(state);
  } else if (state.phase === 'InProgress') {
    viewWaiting.classList.add('hidden');
    viewChampSelect.classList.add('hidden');
    viewInGame.classList.remove('hidden');
    renderInGame(state);
  } else {
    viewChampSelect.classList.add('hidden');
    viewInGame.classList.add('hidden');
    viewWaiting.classList.remove('hidden');

    const titleEl = document.getElementById('waitingTitle');
    const subEl = document.getElementById('waitingSub');
    if (state.connected) {
      titleEl.textContent = `League Client erkannt (${state.summoner || 'Bereit'})`;
      subEl.innerHTML = `Aktuelle Phase: <strong>${state.phase}</strong>. Sobald du in die Champion-Auswahl oder ins Match gehst, schaltet das Overlay automatisch um!`;
    } else {
      titleEl.textContent = 'Warte auf League of Legends...';
      subEl.innerHTML = 'Starte League of Legends oder klicke oben auf <strong>Demo: Champ Select</strong> bzw. <strong>Demo: In-Game HUD</strong>, um das Overlay sofort live zu sehen!';
    }
  }
});
