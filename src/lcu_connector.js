const https = require('https');
const { exec } = require('child_process');
const fs = require('fs');
const { BuildAdvisor } = require('./build_advisor');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

class LcuConnector {
  constructor() {
    this.credentials = null;
    this.championMap = {};
    this.latestDDragonVersion = '16.22.1';
    this.buildAdvisor = new BuildAdvisor(this.latestDDragonVersion);
    this.initDDragon();
  }

  async initDDragon() {
    try {
      const versions = await this.fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
      if (Array.isArray(versions) && versions.length > 0) {
        this.latestDDragonVersion = versions[0];
        this.buildAdvisor.setVersion(this.latestDDragonVersion);
      }
      const champData = await this.fetchJson(
        `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/data/en_US/champion.json`
      );
      if (champData && champData.data) {
        for (const key of Object.keys(champData.data)) {
          const champ = champData.data[key];
          this.championMap[parseInt(champ.key, 10)] = {
            id: champ.id,
            name: champ.name,
            icon: `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/img/champion/${champ.id}.png`
          };
        }
      }
    } catch (e) {
      // Fallback if offline
    }
  }

  getChampionInfo(champId) {
    if (!champId || champId === 0) {
      return {
        id: 'None',
        name: 'Selecting...',
        icon: `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/img/profileicon/29.png`
      };
    }
    return this.championMap[champId] || {
      id: `Champ_${champId}`,
      name: `Champion #${champId}`,
      icon: `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/img/profileicon/29.png`
    };
  }

  fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request(url, { ...options, agent: httpsAgent, timeout: 2500 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  /**
   * Discovers the LeagueClientUx process on macOS to extract port and remoting-auth-token
   */
  discoverLcuCredentials() {
    return new Promise((resolve) => {
      exec('ps -A -o args= | grep "LeagueClientUx" | grep -- "--app-port="', (err, stdout) => {
        if (!err && stdout) {
          const portMatch = stdout.match(/--app-port=([0-9]+)/);
          const tokenMatch = stdout.match(/--remoting-auth-token=([\w-_]+)/);
          if (portMatch && tokenMatch) {
            this.credentials = {
              port: portMatch[1],
              token: tokenMatch[1],
              authHeader: 'Basic ' + Buffer.from(`riot:${tokenMatch[1]}`).toString('base64')
            };
            return resolve(this.credentials);
          }
        }

        // Fallback: Check standard macOS lockfile path
        const lockfilePath = '/Applications/League of Legends.app/Contents/LoL/lockfile';
        if (fs.existsSync(lockfilePath)) {
          try {
            const content = fs.readFileSync(lockfilePath, 'utf8');
            const parts = content.split(':');
            if (parts.length >= 4) {
              this.credentials = {
                port: parts[2],
                token: parts[3],
                authHeader: 'Basic ' + Buffer.from(`riot:${parts[3]}`).toString('base64')
              };
              return resolve(this.credentials);
            }
          } catch (e) {
            // Ignore lockfile error
          }
        }

        this.credentials = null;
        resolve(null);
      });
    });
  }

  async lcuRequest(endpoint) {
    if (!this.credentials) {
      await this.discoverLcuCredentials();
    }
    if (!this.credentials) {
      throw new Error('LCU not running');
    }

    const url = `https://127.0.0.1:${this.credentials.port}${endpoint}`;
    try {
      return await this.fetchJson(url, {
        headers: {
          Authorization: this.credentials.authHeader,
          Accept: 'application/json'
        }
      });
    } catch (err) {
      // Reset credentials in case client restarted
      if (err.message !== 'HTTP 404') {
        this.credentials = null;
      }
      throw err;
    }
  }

  /**
   * Fetches player ranked stats & recent match performance directly from LCU via PUUID
   */
  async analyzePlayerByPuuid(puuid, summonerName, assignedPosition, championId) {
    const champInfo = this.getChampionInfo(championId);
    const playerAnalysis = {
      puuid,
      summonerName: summonerName || 'Hidden Summoner',
      position: (assignedPosition || 'FLEX').toUpperCase(),
      champion: champInfo,
      rank: 'Unranked',
      tier: 'UNRANKED',
      lp: 0,
      wins: 0,
      losses: 0,
      winrate: 50,
      recentKda: '0.0 / 0.0 / 0.0',
      kdaRatio: 2.5,
      csPerMin: 6.2,
      tags: []
    };

    if (!puuid || puuid === '00000000-0000-0000-0000-000000000000') {
      playerAnalysis.tags.push({ label: 'Streamer Mode / Hidden', type: 'neutral' });
      return playerAnalysis;
    }

    // 1. Fetch Ranked Stats from LCU
    try {
      const rankedData = await this.lcuRequest(`/lol-ranked/v1/ranked-stats/${puuid}`);
      const soloQueue = rankedData?.queueMap?.RANKED_SOLO_5x5;
      if (soloQueue && soloQueue.tier && soloQueue.tier !== 'NONE') {
        playerAnalysis.tier = soloQueue.tier;
        playerAnalysis.rank = `${soloQueue.tier} ${soloQueue.division}`;
        playerAnalysis.lp = soloQueue.leaguePoints || 0;
        playerAnalysis.wins = soloQueue.wins || 0;
        playerAnalysis.losses = soloQueue.losses || 0;
        const total = playerAnalysis.wins + playerAnalysis.losses;
        playerAnalysis.winrate = total > 0 ? Math.round((playerAnalysis.wins / total) * 100) : 50;
      }
    } catch (e) {
      // Ranked stats unavailable
    }

    // 2. Fetch Recent Match History from LCU for Porofessor-style Tags!
    try {
      const history = await this.lcuRequest(`/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=0&endIndex=10`);
      const games = history?.games?.games || [];
      if (games.length > 0) {
        let kills = 0, deaths = 0, assists = 0;
        let winsCount = 0;
        let sameChampCount = 0;
        let streak = 0;
        let firstOutcome = null;

        const slice = games.slice(0, 10);
        for (const g of slice) {
          const part = g.participants?.[0];
          const stats = part?.stats;
          if (stats) {
            kills += stats.kills || 0;
            deaths += stats.deaths || 0;
            assists += stats.assists || 0;
            if (stats.win) winsCount++;

            if (firstOutcome === null) {
              firstOutcome = stats.win;
              streak = 1;
            } else if (stats.win === firstOutcome && streak > 0) {
              streak++;
            } else {
              streak = -1; // broken streak
            }
          }
          if (part?.championId === championId && championId > 0) {
            sameChampCount++;
          }
        }

        const count = slice.length;
        const avgK = (kills / count).toFixed(1);
        const avgD = (deaths / count).toFixed(1);
        const avgA = (assists / count).toFixed(1);
        playerAnalysis.recentKda = `${avgK} / ${avgD} / ${avgA}`;
        playerAnalysis.kdaRatio = Number(((kills + assists) / Math.max(1, deaths)).toFixed(2));

        // Generate Porofessor-style smart tags
        if (firstOutcome === true && streak >= 3) {
          playerAnalysis.tags.push({ label: `Hot Streak (${streak}W)`, type: 'positive' });
        } else if (firstOutcome === false && streak >= 3) {
          playerAnalysis.tags.push({ label: `Cold Streak (${streak}L)`, type: 'negative' });
        }

        if (sameChampCount >= 6) {
          playerAnalysis.tags.push({ label: `${champInfo.name} OTP`, type: 'positive' });
        } else if (sameChampCount === 0 && championId > 0) {
          playerAnalysis.tags.push({ label: `First Time ${champInfo.name}`, type: 'warning' });
        }

        if (playerAnalysis.kdaRatio >= 3.8) {
          playerAnalysis.tags.push({ label: 'KDA Player', type: 'positive' });
        } else if (deaths / count >= 7.5) {
          playerAnalysis.tags.push({ label: 'Aggressive / Dies Often', type: 'negative' });
        }

        if (playerAnalysis.winrate >= 58 && (playerAnalysis.wins + playerAnalysis.losses) >= 20) {
          playerAnalysis.tags.push({ label: 'Smurf / High WR', type: 'positive' });
        }
      }
    } catch (e) {
      // Match history endpoint unavailable or private
    }

    if (playerAnalysis.tags.length === 0) {
      playerAnalysis.tags.push({ label: 'Consistent Laner', type: 'neutral' });
    }

    return playerAnalysis;
  }

  /**
   * Polls Champ Select session and builds team analysis
   */
  async getChampSelectData() {
    const session = await this.lcuRequest('/lol-champ-select/v1/session');
    const myTeam = session.myTeam || [];

    const teamAnalysis = await Promise.all(
      myTeam.map(async (member) => {
        let summonerName = member.gameName
          ? `${member.gameName}#${member.tagLine || ''}`
          : '';

        if (!summonerName && member.summonerId) {
          try {
            const sum = await this.lcuRequest(`/lol-summoner/v1/summoners/${member.summonerId}`);
            summonerName = sum.gameName ? `${sum.gameName}#${sum.tagLine || 'EUW'}` : sum.displayName;
          } catch (e) {
            summonerName = 'Teammate';
          }
        }

        const champId = member.championId || member.championPickIntent || 0;
        return this.analyzePlayerByPuuid(
          member.puuid,
          summonerName,
          member.assignedPosition,
          champId
        );
      })
    );

    return {
      phase: 'ChampSelect',
      timer: session.timer?.adjustedTimeLeftInPhase
        ? Math.ceil(session.timer.adjustedTimeLeftInPhase / 1000)
        : 0,
      myTeam: teamAnalysis
    };
  }

  /**
   * Polls Live Client Data API (Port 2999) during an active match
   */
  async getLiveGameData() {
    const allData = await this.fetchJson('https://127.0.0.1:2999/liveclientdata/allgamedata');
    const gameTime = allData?.gameData?.gameTime || 0;
    const activePlayer = allData?.activePlayer || {};
    const allPlayers = allData?.allPlayers || [];
    const events = allData?.events?.Events || [];

    // Find active player in allPlayers to get KDA, CS, Items
    const activeName = activePlayer.summonerName || activePlayer.riotId || '';
    const me =
      allPlayers.find(
        (p) =>
          p.summonerName === activeName ||
          p.riotId === activeName ||
          (activeName && p.summonerName?.includes(activeName.split('#')[0]))
      ) ||
      allPlayers[0] ||
      {};

    const scores = me.scores || { kills: 0, deaths: 0, assists: 0, creepScore: 0, wardScore: 0 };
    const minutes = Math.max(1, gameTime / 60);
    const csPerMin = Number((scores.creepScore / minutes).toFixed(1));
    const kdaRatio = Number(((scores.kills + scores.assists) / Math.max(1, scores.deaths)).toFixed(2));

    // Calculate Objective Timers from Live Events
    const objectives = this.calculateObjectiveTimers(events, gameTime);

    // Format both teams for Live Scoreboard / Scouting
    const orderTeam = allPlayers.filter((p) => p.team === 'ORDER').map((p) => this.formatLivePlayer(p, minutes));
    const chaosTeam = allPlayers.filter((p) => p.team === 'CHAOS').map((p) => this.formatLivePlayer(p, minutes));

    const myTeamKey = me.team === 'CHAOS' ? 'CHAOS' : 'ORDER';
    const enemyTeam = myTeamKey === 'ORDER' ? chaosTeam : orderTeam;
    const currentGold = Math.round(activePlayer.currentGold || 0);
    const ownedItems = Array.isArray(me.items) ? me.items : [];

    const buildAnalysis = this.buildAdvisor.generateRecommendations({
      championName: me.championName || 'Ahri',
      position: me.position || 'MIDDLE',
      currentGold,
      ownedItems,
      enemyTeam
    });

    return {
      phase: 'InProgress',
      gameTime,
      gameMode: allData?.gameData?.gameMode || 'CLASSIC',
      activePlayer: {
        name: me.riotId || me.summonerName || activeName || 'Summoner',
        championName: me.championName || 'Champion',
        position: me.position || 'MIDDLE',
        level: activePlayer.level || me.level || 1,
        currentGold,
        kills: scores.kills,
        deaths: scores.deaths,
        assists: scores.assists,
        kdaRatio,
        creepScore: scores.creepScore,
        csPerMin,
        wardScore: Number((scores.wardScore || 0).toFixed(1))
      },
      buildAnalysis,
      objectives,
      teams: {
        ORDER: orderTeam,
        CHAOS: chaosTeam
      }
    };
  }

  formatLivePlayer(p, minutes) {
    const s = p.scores || {};
    const inv = this.buildAdvisor.normalizePlayerInventory(Array.isArray(p.items) ? p.items : []);
    return {
      name: p.riotId || p.summonerName,
      championName: p.championName,
      position: p.position || 'NONE',
      level: p.level || 1,
      kills: s.kills || 0,
      deaths: s.deaths || 0,
      assists: s.assists || 0,
      cs: s.creepScore || 0,
      csPerMin: Number(((s.creepScore || 0) / minutes).toFixed(1)),
      isDead: Boolean(p.isDead),
      respawnTimer: Math.ceil(p.respawnTimer || 0),
      items: inv.ownedList,
      inventorySlots: inv.slots,
      trinket: inv.trinket
    };
  }

  /**
   * Fallback when LCU is in InProgress / GameStart (e.g. Loading Screen or Port 2999 not yet ready)
   */
  async getLcuInProgressFallback() {
    let myChampName = 'Ahri';
    let myPosition = 'MIDDLE';
    let orderTeam = [];
    let chaosTeam = [];

    try {
      const session = await this.lcuRequest('/lol-gameflow/v1/session');
      const teamOne = session?.gameData?.teamOne || [];
      const teamTwo = session?.gameData?.teamTwo || [];

      const mapSessionTeam = (arr) =>
        arr.map((p) => {
          const cInfo = this.getChampionInfo(p.championId);
          return {
            name: p.summonerName || p.riotId || 'Summoner',
            championName: cInfo.name !== 'Selecting...' ? cInfo.name : 'Champion',
            position: p.selectedPosition || 'NONE',
            level: 1,
            kills: 0,
            deaths: 0,
            assists: 0,
            cs: 0,
            csPerMin: 0.0,
            isDead: false,
            respawnTimer: 0,
            items: [],
            inventorySlots: [null, null, null, null, null, null],
            trinket: null
          };
        });

      orderTeam = mapSessionTeam(teamOne);
      chaosTeam = mapSessionTeam(teamTwo);
      if (orderTeam[0]) {
        myChampName = orderTeam[0].championName;
        myPosition = orderTeam[0].position;
      }
    } catch (e) {
      // Ignore if session details aren't available
    }

    const buildAnalysis = this.buildAdvisor.generateRecommendations({
      championName: myChampName,
      position: myPosition,
      currentGold: 500,
      ownedItems: [],
      enemyTeam: chaosTeam
    });

    return {
      phase: 'InProgress',
      gameTime: 0,
      gameMode: 'CLASSIC',
      activePlayer: {
        name: 'Im Match (Synchronisiere...)',
        championName: myChampName,
        position: myPosition,
        level: 1,
        currentGold: 500,
        kills: 0,
        deaths: 0,
        assists: 0,
        kdaRatio: 0,
        creepScore: 0,
        csPerMin: 0,
        wardScore: 0
      },
      buildAnalysis,
      objectives: this.calculateObjectiveTimers([], 0),
      teams: {
        ORDER: orderTeam,
        CHAOS: chaosTeam
      }
    };
  }

  calculateObjectiveTimers(events, gameTime) {
    // Dragon: spawns at 5:00 (300s), respawns 5:00 (300s) after kill
    // Voidgrubs (Horde): spawns at 6:00 (360s), respawns 4:00 (240s) once, despawns at 13:45 (825s)
    // Rift Herald: spawns at 14:00 (840s), despawns at 19:45 (1185s)
    // Baron: spawns at 20:00 (1200s), respawns 6:00 (360s) after kill
    let lastDragonKill = null;
    let dragonKillsOrder = 0;
    let dragonKillsChaos = 0;
    let lastBaronKill = null;
    let lastHeraldKill = null;
    let lastHordeKill = null;

    for (const ev of events) {
      if (ev.EventName === 'DragonKill') {
        lastDragonKill = ev.EventTime;
      } else if (ev.EventName === 'BaronKill') {
        lastBaronKill = ev.EventTime;
      } else if (ev.EventName === 'HeraldKill') {
        lastHeraldKill = ev.EventTime;
      } else if (ev.EventName === 'HordeKill') {
        lastHordeKill = ev.EventTime;
      }
    }

    // 1. Dragon
    const dragonNextSpawn = lastDragonKill !== null ? lastDragonKill + 300 : 300;
    const dragonRemaining = Math.max(0, Math.ceil(dragonNextSpawn - gameTime));

    // 2. Baron Nashor
    const baronNextSpawn = lastBaronKill !== null ? lastBaronKill + 360 : 1200;
    const baronRemaining = Math.max(0, Math.ceil(baronNextSpawn - gameTime));

    // 3. Voidgrubs / Rift Herald (Top Pit Objective)
    let pitObj = {
      name: 'Voidgrubs',
      icon: '🐛',
      status: 'RESPAWNING',
      remainingSec: Math.max(0, Math.ceil(360 - gameTime))
    };

    if (gameTime < 825) {
      const grubNext = lastHordeKill !== null ? lastHordeKill + 240 : 360;
      const grubRem = Math.max(0, Math.ceil(grubNext - gameTime));
      pitObj = {
        name: 'Voidgrubs',
        icon: '🐛',
        status: grubRem === 0 ? 'ALIVE' : 'RESPAWNING',
        remainingSec: grubRem
      };
    } else if (gameTime < 1200) {
      if (lastHeraldKill !== null) {
        pitObj = { name: 'Rift Herald', icon: '👁️', status: 'SLAIN', remainingSec: 0 };
      } else {
        const heraldRem = Math.max(0, Math.ceil(840 - gameTime));
        pitObj = {
          name: 'Rift Herald',
          icon: '👁️',
          status: heraldRem === 0 ? 'ALIVE' : 'RESPAWNING',
          remainingSec: heraldRem
        };
      }
    } else {
      pitObj = { name: 'Void / Herald', icon: '👁️', status: 'DESPAWNED', remainingSec: 0 };
    }

    return {
      dragon: {
        status: dragonRemaining === 0 ? 'ALIVE' : 'RESPAWNING',
        remainingSec: dragonRemaining
      },
      baron: {
        status: baronRemaining === 0 ? 'ALIVE' : 'RESPAWNING',
        remainingSec: baronRemaining
      },
      topPit: pitObj
    };
  }

  /**
   * Rich Demo State so the user can test & customize the Overlay even without League open
   */
  getDemoData(mode = 'champSelect', tick = 0) {
    if (mode === 'inGame') {
      const gameTime = 845 + (tick % 300);
      const mins = gameTime / 60;
      const cs = Math.round(mins * 7.8);
      const currentGold = 1250 + ((tick * 150) % 2200);

      // Exact Riot Live Client API format for Active Player (Ahri) inventory (Slots 0..5 + Trinket Slot 6)
      const demoOwnedItems = [
        { itemID: 1056, displayName: "Doran's Ring", count: 1, slot: 0 },
        { itemID: 3118, displayName: 'Malignance', count: 1, slot: 1 },
        { itemID: 3020, displayName: "Sorcerer's Shoes", count: 1, slot: 2 },
        { itemID: 3145, displayName: 'Hextech Alternator', count: 1, slot: 3 },
        { itemID: 1082, displayName: 'Dark Seal', count: 1, slot: 4 },
        { itemID: 2055, displayName: 'Control Ward', count: 1, slot: 5 },
        { itemID: 3364, displayName: 'Oracle Lens', count: 1, slot: 6 }
      ];

      const rawOrderTeam = [
        {
          riotId: 'TopKing#EUW',
          championName: 'Aatrox',
          position: 'TOP',
          level: 12,
          scores: { kills: 3, deaths: 2, assists: 4, creepScore: 118 },
          isDead: false,
          respawnTimer: 0,
          items: [
            { itemID: 1054, slot: 0 },
            { itemID: 6692, slot: 1 },
            { itemID: 3047, slot: 2 },
            { itemID: 3133, slot: 3 },
            { itemID: 1028, slot: 4 },
            { itemID: 3340, slot: 6 }
          ]
        },
        {
          riotId: 'JungleDiff#EUW',
          championName: 'Lee Sin',
          position: 'JUNGLE',
          level: 10,
          scores: { kills: 4, deaths: 3, assists: 9, creepScore: 88 },
          isDead: false,
          respawnTimer: 0,
          items: [
            { itemID: 6610, slot: 0 },
            { itemID: 3111, slot: 1 },
            { itemID: 3044, slot: 2 },
            { itemID: 1036, slot: 3 },
            { itemID: 3364, slot: 6 }
          ]
        },
        {
          riotId: 'Tobias#MAC',
          championName: 'Ahri',
          position: 'MIDDLE',
          level: 11,
          scores: { kills: 6, deaths: 1, assists: 8, creepScore: cs },
          isDead: false,
          respawnTimer: 0,
          items: demoOwnedItems
        },
        {
          riotId: 'KitingGod#EUW',
          championName: 'Jinx',
          position: 'BOTTOM',
          level: 10,
          scores: { kills: 5, deaths: 2, assists: 5, creepScore: 124 },
          isDead: false,
          respawnTimer: 0,
          items: [
            { itemID: 1055, slot: 0 },
            { itemID: 6672, slot: 1 },
            { itemID: 3006, slot: 2 },
            { itemID: 1038, slot: 3 },
            { itemID: 3363, slot: 6 }
          ]
        },
        {
          riotId: 'HookCity#EUW',
          championName: 'Thresh',
          position: 'UTILITY',
          level: 9,
          scores: { kills: 1, deaths: 2, assists: 14, creepScore: 21 },
          isDead: false,
          respawnTimer: 0,
          items: [
            { itemID: 3190, slot: 0 },
            { itemID: 3111, slot: 1 },
            { itemID: 1031, slot: 2 },
            { itemID: 2055, count: 2, slot: 3 },
            { itemID: 3364, slot: 6 }
          ]
        }
      ];

      const rawChaosTeam = [
        {
          riotId: 'SoloBolo#EUW',
          championName: 'Darius',
          position: 'TOP',
          level: 11,
          scores: { kills: 4, deaths: 2, assists: 2, creepScore: 112 },
          isDead: true,
          respawnTimer: 18,
          items: [
            { itemID: 1055, slot: 0 },
            { itemID: 3078, slot: 1 },
            { itemID: 3047, slot: 2 },
            { itemID: 3044, slot: 3 },
            { itemID: 1033, slot: 4 },
            { itemID: 3340, slot: 6 }
          ]
        },
        {
          riotId: 'ShadowKayn#EUW',
          championName: 'Kayn',
          position: 'JUNGLE',
          level: 11,
          scores: { kills: 5, deaths: 2, assists: 4, creepScore: 94 },
          isDead: false,
          respawnTimer: 0,
          items: [
            { itemID: 6692, slot: 0 },
            { itemID: 3158, slot: 1 },
            { itemID: 3071, slot: 2 },
            { itemID: 1036, slot: 3 },
            { itemID: 3364, slot: 6 }
          ]
        },
        {
          riotId: 'ZedOrBed#EUW',
          championName: 'Zed',
          position: 'MIDDLE',
          level: 11,
          scores: { kills: 4, deaths: 3, assists: 2, creepScore: 98 },
          isDead: false,
          respawnTimer: 0,
          items: [
            { itemID: 3142, slot: 0 },
            { itemID: 3158, slot: 1 },
            { itemID: 3155, slot: 2 },
            { itemID: 3134, slot: 3 },
            { itemID: 3364, slot: 6 }
          ]
        },
        {
          riotId: 'VayneSpot#EUW',
          championName: 'Vayne',
          position: 'BOTTOM',
          level: 9,
          scores: { kills: 2, deaths: 4, assists: 3, creepScore: 105 },
          isDead: false,
          respawnTimer: 0,
          items: [
            { itemID: 1055, slot: 0 },
            { itemID: 3153, slot: 1 },
            { itemID: 3006, slot: 2 },
            { itemID: 3363, slot: 6 }
          ]
        },
        {
          riotId: 'LuxSupport#EUW',
          championName: 'Lux',
          position: 'UTILITY',
          level: 8,
          scores: { kills: 1, deaths: 2, assists: 5, creepScore: 18 },
          isDead: false,
          respawnTimer: 0,
          items: [
            { itemID: 6655, slot: 0 },
            { itemID: 3020, slot: 1 },
            { itemID: 1052, slot: 2 },
            { itemID: 3364, slot: 6 }
          ]
        }
      ];

      const orderTeam = rawOrderTeam.map((p) => this.formatLivePlayer(p, mins));
      const chaosTeam = rawChaosTeam.map((p) => this.formatLivePlayer(p, mins));

      const buildAnalysis = this.buildAdvisor.generateRecommendations({
        championName: 'Ahri',
        position: 'MIDDLE',
        currentGold,
        ownedItems: demoOwnedItems,
        enemyTeam: chaosTeam
      });

      return {
        phase: 'InProgress',
        isDemo: true,
        gameTime,
        gameMode: 'CLASSIC',
        activePlayer: {
          name: 'Tobias#MAC',
          championName: 'Ahri',
          position: 'MIDDLE',
          level: 11,
          currentGold,
          kills: 6,
          deaths: 1,
          assists: 8,
          kdaRatio: 14.0,
          creepScore: cs,
          csPerMin: Number((cs / mins).toFixed(1)),
          wardScore: 22.4
        },
        buildAnalysis,
        objectives: {
          dragon: {
            status: 'RESPAWNING',
            remainingSec: Math.max(0, 142 - (tick % 142))
          },
          baron: {
            status: 'RESPAWNING',
            remainingSec: Math.max(0, 355 - (tick % 355))
          },
          topPit: {
            name: 'Rift Herald',
            icon: '👁️',
            status: 'ALIVE',
            remainingSec: 0
          }
        },
        teams: {
          ORDER: orderTeam,
          CHAOS: chaosTeam
        }
      };
    }

    // Default Demo: Champ Select Scouting (Porofessor Style)
    return {
      phase: 'ChampSelect',
      isDemo: true,
      timer: Math.max(5, 45 - (tick % 40)),
      myTeam: [
        {
          summonerName: 'TopKing#EUW',
          position: 'TOP',
          champion: { id: 'Aatrox', name: 'Aatrox', icon: `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/img/champion/Aatrox.png` },
          rank: 'EMERALD II',
          tier: 'EMERALD',
          lp: 64,
          wins: 84,
          losses: 66,
          winrate: 56,
          recentKda: '6.4 / 3.8 / 5.2',
          kdaRatio: 3.05,
          csPerMin: 7.6,
          tags: [
            { label: 'Aatrox OTP', type: 'positive' },
            { label: 'Hot Streak (4W)', type: 'positive' }
          ]
        },
        {
          summonerName: 'JungleDiff#EUW',
          position: 'JUNGLE',
          champion: { id: 'LeeSin', name: 'Lee Sin', icon: `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/img/champion/LeeSin.png` },
          rank: 'PLATINUM I',
          tier: 'PLATINUM',
          lp: 88,
          wins: 42,
          losses: 45,
          winrate: 48,
          recentKda: '5.1 / 6.2 / 8.4',
          kdaRatio: 2.18,
          csPerMin: 5.9,
          tags: [
            { label: 'Aggressive Early', type: 'neutral' },
            { label: 'Cold Streak (3L)', type: 'negative' }
          ]
        },
        {
          summonerName: 'Tobias#MAC',
          position: 'MIDDLE',
          champion: { id: 'Ahri', name: 'Ahri', icon: `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/img/champion/Ahri.png` },
          rank: 'DIAMOND IV',
          tier: 'DIAMOND',
          lp: 25,
          wins: 62,
          losses: 41,
          winrate: 60,
          recentKda: '8.2 / 2.4 / 9.1',
          kdaRatio: 7.21,
          csPerMin: 8.1,
          tags: [
            { label: 'Smurf / High WR', type: 'positive' },
            { label: 'KDA Player', type: 'positive' },
            { label: 'Great Roamer', type: 'positive' }
          ]
        },
        {
          summonerName: 'KitingGod#EUW',
          position: 'BOTTOM',
          champion: { id: 'Jinx', name: 'Jinx', icon: `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/img/champion/Jinx.png` },
          rank: 'EMERALD III',
          tier: 'EMERALD',
          lp: 41,
          wins: 110,
          losses: 102,
          winrate: 52,
          recentKda: '7.5 / 4.5 / 6.0',
          kdaRatio: 3.0,
          csPerMin: 8.4,
          tags: [
            { label: 'High CS/Min', type: 'positive' },
            { label: 'Consistent Laner', type: 'neutral' }
          ]
        },
        {
          summonerName: 'HookCity#EUW',
          position: 'UTILITY',
          champion: { id: 'Thresh', name: 'Thresh', icon: `https://ddragon.leagueoflegends.com/cdn/${this.latestDDragonVersion}/img/champion/Thresh.png` },
          rank: 'EMERALD IV',
          tier: 'EMERALD',
          lp: 12,
          wins: 29,
          losses: 31,
          winrate: 48,
          recentKda: '1.8 / 5.9 / 14.2',
          kdaRatio: 2.71,
          csPerMin: 1.3,
          tags: [
            { label: 'First Time Thresh', type: 'warning' },
            { label: 'High Vision Score', type: 'positive' }
          ]
        }
      ]
    };
  }
}

module.exports = { LcuConnector };
