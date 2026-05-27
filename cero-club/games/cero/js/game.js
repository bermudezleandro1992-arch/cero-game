'use strict';

var G_PHASE = {
  DEALING:      'DEALING',
  PLAYER_TURN:  'PLAYER_TURN',
  CPU_TURN:     'CPU_TURN',
  COLOR_PICK:   'COLOR_PICK',
  SWAP_PICK:    'SWAP_PICK',
  MIRROR_WAIT:  'MIRROR_WAIT',
  CERO_CHANCE:  'CERO_CHANCE',
  GAME_OVER:    'GAME_OVER',
};
window.G_PHASE = G_PHASE;

const NO_VOICE = {
  enabled: false,
  say() {},
  sfx() {},
  mute()   { this.enabled = false; },
  unmute() { this.enabled = true;  },
};

// ── URL options reader ─────────────────────────────────────────────────────────
function getUrlOpts() {
  const p = new URLSearchParams(location.search);
  const formatRaw = p.get('format') || p.get('players') || '1v1';
  const countMap = { '1v1': 2, '2v2': 4, '3v3': 6, '2': 2, '3': 3, '4': 4, '6': 6, '8': 8 };
  const players = countMap[formatRaw] || parseInt(formatRaw, 10) || 2;
  let format = formatRaw;
  if (!['1v1', '2v2', '3v3'].includes(format)) {
    format = players === 4 ? '2v2' : players === 6 ? '3v3' : '1v1';
  }
  return {
    mode:    p.get('mode')    || 'classic',
    format,
    players,
    voice:   p.get('voice')   || 'fem',
  };
}

/** URL completa para mesa online (modo/formato de la sala Firestore). */
function buildCeroOnlineUrl(roomId, uid, room = {}) {
  const format = room.format || '1v1';
  const countMap = { '1v1': 2, '2v2': 4, '3v3': 6 };
  const players = room.maxPlayers || countMap[format] || 2;
  const q = new URLSearchParams({
    roomId,
    uid,
    mode: room.mode || 'classic',
    format,
    players: String(players),
    voice: room.voice || 'fem',
  });
  return `/games/cero/index.html?${q}`;
}
window.buildCeroOnlineUrl = buildCeroOnlineUrl;

function _teamsForFormat(format, playerCount) {
  if (format === '2v2' && playerCount === 4) return [0, 1, 0, 1];
  if (format === '3v3' && playerCount === 6) return [0, 1, 0, 1, 0, 1];
  return null;
}

function _defaultPlayerNames(count, teams) {
  const names = ['Vos'];
  for (let i = 1; i < count; i++) {
    const teamLbl = teams ? (teams[i] === 0 ? 'A' : 'B') : '';
    names.push(teamLbl ? `CPU ${i} · Eq.${teamLbl}` : `CPU ${i}`);
  }
  return names;
}

// ── Audio / Voice system ───────────────────────────────────────────────────────
class VoiceSystem {
  constructor(voiceType) {
    this.enabled  = voiceType !== 'off';
    this.gender   = voiceType;
    this._voice   = null;
    this._sfxCtx  = null;
    if (this.enabled && typeof speechSynthesis !== 'undefined') {
      speechSynthesis.onvoiceschanged = () => this._pickVoice();
      this._pickVoice();
    }
    // SFX via Web Audio API
    try { this._sfxCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }

  _pickVoice() {
    if (typeof speechSynthesis === 'undefined') return;
    const voices = speechSynthesis.getVoices();
    const esVoices = voices.filter(v => v.lang && v.lang.startsWith('es'));
    if (this.gender === 'masc') {
      this._voice = esVoices.find(v => /male|hombre|masc/i.test(v.name)) || esVoices[0] || null;
    } else {
      this._voice = esVoices.find(v => /female|mujer|fem/i.test(v.name)) || esVoices[1] || esVoices[0] || null;
    }
  }

  say(text) {
    if (!this.enabled) return;
    const utt = new SpeechSynthesisUtterance(text);
    if (this._voice) utt.voice = this._voice;
    utt.lang = 'es-AR';
    utt.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(utt);
  }

  sfx(type) {
    if (!this._sfxCtx) return;
    const ctx  = this._sfxCtx;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.connect(gain);

    const configs = {
      play:    { freq: 440, dur: 0.08, vol: 0.15, type: 'sine'   },
      draw:    { freq: 220, dur: 0.12, vol: 0.12, type: 'sine'   },
      skip:    { freq: 330, dur: 0.15, vol: 0.15, type: 'square' },
      reverse: { freq: 550, dur: 0.18, vol: 0.13, type: 'sine'   },
      wild:    { freq: 660, dur: 0.25, vol: 0.18, type: 'sine'   },
      cero:    { freq: 880, dur: 0.35, vol: 0.22, type: 'sine'   },
      win:     { freq: 660, dur: 0.6,  vol: 0.25, type: 'sine'   },
    };
    const c = configs[type] || configs.play;
    osc.type            = c.type;
    osc.frequency.value = c.freq;
    gain.gain.setValueAtTime(c.vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + c.dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + c.dur);
  }

  mute()   { this.enabled = false; }
  unmute() { this.enabled = true;  }
}

// ── CeroGame ───────────────────────────────────────────────────────────────────
class CeroGame {
  constructor(opts, onChange) {
    this.opts      = opts;
    this.onChange  = onChange;
    try {
      this.voice = new VoiceSystem(opts.voice || 'fem');
    } catch (_) {
      this.voice = NO_VOICE;
    }
    const pc = parseInt(String(opts.players ?? 2), 10);
    this.format      = opts.format || '1v1';
    this.playerCount = Math.min(6, Math.max(2, Number.isFinite(pc) ? pc : 2));
    this.teams       = _teamsForFormat(this.format, this.playerCount);
    this.mode        = opts.mode;
    this.turnSeconds = 20;
    this.turnDeadline = null;
    this.matchScore  = this.teams
      ? { team0: 0, team1: 0 }
      : Object.fromEntries(Array.from({ length: this.playerCount }, (_, i) => [`p${i}`, 0]));
    this.playerNames = _defaultPlayerNames(this.playerCount, this.teams);
    this._init();
  }

  _init() {
    this.deck        = createCeroDeck(this.mode);
    this.discard     = [];
    this.hands       = Array.from({ length: this.playerCount }, () => []);
    this.direction   = 1;       // 1=clockwise
    this.current     = 0;       // player index
    this.color       = null;    // active color
    this.drawStack   = 0;       // stacked +2/+4 pending
    this.mirror      = false;   // Modo Cero: espejo active
    this.ceroSaid    = new Set();
    this.phase       = G_PHASE.DEALING;
    this.winner      = null;
    this.pendingCard = null;    // card played that needs color choice
    this.swapSource  = -1;     // Modo Cero: who played swap

    this._emit();

    for (let i = 0; i < 7; i++) {
      for (let p = 0; p < this.playerCount; p++) {
        const c = this._drawOne();
        if (c) this.hands[p].push(c);
      }
    }

    let first = this._drawOne();
    let safety = 0;
    while (first && (isWild(first) || first.type === 'cero_special') && safety++ < 50) {
      this.deck.unshift(first);
      first = this._drawOne();
    }
    if (!first) {
      first = this._drawOne() || { id: -1, color: 'blue', value: '0', type: 'number' };
    }
    this.discard.push(first);
    this.color = first.color || 'blue';

    this.phase = G_PHASE.PLAYER_TURN;
    this._emit();

    // Start CPU turn if CPU goes first (won't happen at game start since current=0=player)
  }

  // ── Core card mechanics ──────────────────────────────────────────
  _drawOne() {
    if (this.deck.length === 0) this._reshuffleDiscard();
    if (this.deck.length === 0) return null;
    return this.deck.pop();
  }

  _drawN(playerIdx, n) {
    for (let i = 0; i < n; i++) {
      this.hands[playerIdx].push(this._drawOne());
    }
    this.voice.sfx('draw');
  }

  _reshuffleDiscard() {
    if (this.discard.length <= 1) return;
    const top = this.discard.pop();
    this.deck  = _shuffle([...this.discard]);
    this.discard = top ? [top] : [];
  }

  _topCard() { return this.discard[this.discard.length - 1]; }

  _playableCards(playerIdx) {
    return this.hands[playerIdx].filter(c =>
      canPlayOn(c, this._topCard(), this.color, this.drawStack)
    );
  }

  _nextPlayer(from = this.current) {
    return (from + this.direction + this.playerCount) % this.playerCount;
  }

  _advanceTurn(skip = false) {
    let next = this._nextPlayer();
    if (skip) next = this._nextPlayer(next);
    this.current = next;
    this.ceroSaid.delete(next); // reset CERO flag for new active player
  }

  _emit() { this.onChange(this._snapshot()); }

  _snapshot() {
    return {
      phase:       this.phase,
      hands:       this.hands.map((h, i) =>
        i === 0 ? h : h.map(() => null) // hide CPU cards
      ),
      realHands:   this.hands,          // full hands (for UI decisions)
      discard:     this.discard,
      deck:        this.deck,
      color:       this.color,
      current:     this.current,
      direction:   this.direction,
      drawStack:   this.drawStack,
      ceroSaid:    [...this.ceroSaid],
      winner:      this.winner,
      playerCount: this.playerCount,
      mode:        this.mode,
      mirror:      this.mirror,
      format:      this.format,
      teams:       this.teams,
      matchScore:  { ...this.matchScore },
      playerNames: [...this.playerNames],
      turnDeadline: this.turnDeadline,
      turnSeconds: this.turnSeconds,
      myTeam:      this.teams ? this.teams[0] : null,
    };
  }

  // ── Player actions ───────────────────────────────────────────────
  tryPlayerPlay(cardId) {
    if (this.phase !== G_PHASE.PLAYER_TURN || this.current !== 0) return false;
    const idx = this.hands[0].findIndex(c => String(c.id) === String(cardId));
    if (idx === -1) return false;
    const card = this.hands[0][idx];
    if (!canPlayOn(card, this._topCard(), this.color, this.drawStack, this.hands[0])) return false;
    this.playerPlay(cardId);
    return true;
  }

  playerPlay(cardId) {
    if (this.phase !== G_PHASE.PLAYER_TURN || this.current !== 0) return;
    const idx = this.hands[0].findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = this.hands[0][idx];
    if (!canPlayOn(card, this._topCard(), this.color, this.drawStack, this.hands[0])) return;

    this.hands[0].splice(idx, 1);
    this._applyCard(card, 0);
  }

  playerDraw() {
    if (this.phase !== G_PHASE.PLAYER_TURN || this.current !== 0) return;

    if (this.drawStack > 0) {
      // Must draw stacked amount
      const n = this.drawStack;
      this.drawStack = 0;
      this._drawN(0, n);
      this.voice.say(`Robás ${n} cartas`);
      this._advanceTurn();
      this._nextTurn();
      return;
    }

    const drawn = this._drawOne();
    this.hands[0].push(drawn);
    this.voice.sfx('draw');
    // Can play drawn card?
    if (canPlayOn(drawn, this._topCard(), this.color, this.drawStack, this.hands[0])) {
      this._emit(); // show the drawn card as playable
      // Player may choose to play it; if they click it next, it goes through playerPlay
    } else {
      this._advanceTurn();
      this._nextTurn();
    }
    this._emit();
  }

  sayCero() {
    if (this.phase !== G_PHASE.PLAYER_TURN) return;
    if (this.hands[0].length !== 1) return;
    this.ceroSaid.add(0);
    this.voice.say('¡CERO!');
    this.voice.sfx('cero');
    this._emit();
  }

  pickColor(color) {
    if (this.phase !== G_PHASE.COLOR_PICK) return;
    this.color = color;
    this.voice.say(`Color ${COLOR_CSS[color]?.label || color}`);
    this._finishCardEffect(this.pendingCard, 0);
    this.pendingCard = null;
  }

  pickSwapTarget(targetIdx) {
    if (this.phase !== G_PHASE.SWAP_PICK) return;
    [this.hands[0], this.hands[targetIdx]] = [this.hands[targetIdx], this.hands[0]];
    this.voice.say('¡Intercambio de manos!');
    this._advanceTurn();
    this._nextTurn();
  }

  // ── Card effect engine ───────────────────────────────────────────
  _applyCard(card, playerIdx) {
    this.discard.push(card);
    this.voice.sfx(card.type === 'wild' || card.type === 'cero_special' ? 'wild' : 'play');

    // Check win
    if (this.hands[playerIdx].length === 0) {
      this._win(playerIdx);
      return;
    }

    // Check CERO (1 card left, not said)
    if (this.hands[playerIdx].length === 1 && !this.ceroSaid.has(playerIdx)) {
      if (playerIdx !== 0) {
        // CPU auto-says CERO
        this.ceroSaid.add(playerIdx);
        this.voice.say(`Jugador ${playerIdx + 1}: ¡CERO!`);
        this.voice.sfx('cero');
      }
    }

    // Wilds need color pick
    if ((card.type === 'wild' || card.value === 'cero_star') && card.value !== 'cero_mirror') {
      if (playerIdx === 0) {
        this.pendingCard = card;
        this.phase = G_PHASE.COLOR_PICK;
        this._emit();
        return;
      } else {
        // CPU picks color
        this.color = this._cpuPickColor(playerIdx);
        this.voice.say(`CPU elige ${COLOR_CSS[this.color]?.label}`);
      }
    }

    this._finishCardEffect(card, playerIdx);
  }

  _finishCardEffect(card, playerIdx) {
    const next = this._nextPlayer();

    switch (card.value) {
      case 'skip':
        this.voice.sfx('skip');
        if (this.playerCount === 2) {
          // Skip acts like an extra turn in 2p
          this._advanceTurn(); // advance past self, skip opponent
          break;
        }
        this._advanceTurn(true); // skip next
        this._nextTurn();
        return;

      case 'reverse':
        this.voice.sfx('reverse');
        this.direction *= -1;
        if (this.playerCount === 2) {
          // Reverse in 2p acts like skip
          this._advanceTurn();
          break;
        }
        this._advanceTurn();
        this._nextTurn();
        return;

      case 'draw2':
        this.drawStack += 2;
        break;

      case 'wild4':
        this.drawStack += 4;
        break;

      // ── Modo Cero specials ──────────────────────────────────────
      case 'cero_total':
        // Everyone else draws 3
        for (let p = 0; p < this.playerCount; p++) {
          if (p !== playerIdx) this._drawN(p, 3);
        }
        this.voice.say('¡TOTAL! Todos roban 3');
        this._advanceTurn();
        this._nextTurn();
        return;

      case 'cero_mirror':
        this.mirror = true;
        this.voice.say('¡Espejo activado!');
        break;

      case 'cero_swap':
        if (playerIdx === 0) {
          this.phase = G_PHASE.SWAP_PICK;
          this._emit();
          return;
        } else {
          // CPU swaps with player 0 (most aggressive strategy)
          [this.hands[0], this.hands[playerIdx]] = [this.hands[playerIdx], this.hands[0]];
          this.voice.say('¡CPU hace un intercambio!');
        }
        break;

      case 'cero_star':
        // Already chose color above; everyone else draws 1
        for (let p = 0; p < this.playerCount; p++) {
          if (p !== playerIdx) this._drawN(p, 1);
        }
        this.voice.say('¡CERO★! Todos roban 1');
        break;
    }

    // Handle mirror reflection of draw stacks
    if (this.mirror && this.drawStack > 0 && card.value !== 'cero_mirror') {
      const reflected = this.drawStack;
      this.drawStack   = 0;
      this.mirror      = false;
      this._drawN(playerIdx, reflected); // bounces back to the sender
      this.voice.say(`¡Espejo! ${reflected} cartas rebotan a ${playerIdx === 0 ? 'vos' : 'CPU ' + playerIdx}`);
      this._advanceTurn();
      this._nextTurn();
      return;
    }

    this._advanceTurn();
    this._nextTurn();
  }

  _win(playerIdx) {
    if (this.teams) {
      const team = this.teams[playerIdx];
      this.matchScore[`team${team}`] = (this.matchScore[`team${team}`] || 0) + 1;
      this.winner = team;
    } else {
      this.matchScore[`p${playerIdx}`] = (this.matchScore[`p${playerIdx}`] || 0) + 1;
      this.winner = playerIdx;
    }
    this.phase  = G_PHASE.GAME_OVER;
    this.turnDeadline = null;
    if (this.voice) {
      if (playerIdx === 0) {
        this.voice.say('¡Ganaste! ¡CERO!');
        this.voice.sfx('win');
      } else {
        this.voice.say(`${this.playerNames[playerIdx] || 'CPU'} gana. ¡CERO!`);
      }
    }
    if (window.CeroChat) {
      const wn = this.playerNames[playerIdx] || `Jugador ${playerIdx}`;
      CeroChat.system(`🏆 ${wn} se quedó sin cartas.`);
    }
    this._emit();
  }

  onTurnTimeout() {
    if (this.phase !== G_PHASE.PLAYER_TURN || this.current !== 0) return;
    if (window.CeroChat) CeroChat.system('⏱ Tiempo agotado — robás automáticamente.');
    this.playerDraw();
  }

  _setTurnDeadline() {
    if (this.current === 0 && this.phase === G_PHASE.PLAYER_TURN) {
      this.turnDeadline = Date.now() + this.turnSeconds * 1000;
    } else {
      this.turnDeadline = null;
    }
  }

  // ── Turn routing ─────────────────────────────────────────────────
  _nextTurn() {
    this._emit();
    if (this.phase === G_PHASE.GAME_OVER) return;
    if (this.phase === G_PHASE.COLOR_PICK || this.phase === G_PHASE.SWAP_PICK) return;

    if (this.current === 0) {
      this.phase = G_PHASE.PLAYER_TURN;
      this._setTurnDeadline();
      this._emit();
    } else {
      this.turnDeadline = null;
      this.phase = G_PHASE.CPU_TURN;
      this._emit();
      setTimeout(() => this._cpuTurn(), 900 + Math.random() * 600);
    }
  }

  // ── CPU AI ───────────────────────────────────────────────────────
  _cpuTurn() {
    if (this.phase !== G_PHASE.CPU_TURN) return;
    const p       = this.current;
    const hand    = this.hands[p];
    const top     = this._topCard();
    const playable = hand.filter(c => canPlayOn(c, top, this.color, this.drawStack));

    if (playable.length === 0) {
      // Must draw
      if (this.drawStack > 0) {
        const n = this.drawStack;
        this.drawStack = 0;
        this._drawN(p, n);
      } else {
        this._drawN(p, 1);
      }
      this._advanceTurn();
      this._nextTurn();
      return;
    }

    // Priority: number > special > wild (save wilds)
    const nums     = playable.filter(c => c.type === 'number');
    const specs    = playable.filter(c => c.type === 'special');
    const wilds    = playable.filter(c => c.type === 'wild' || c.type === 'cero_special');

    let chosen = nums.length  > 0 ? nums[Math.floor(Math.random() * nums.length)]
               : specs.length > 0 ? specs[Math.floor(Math.random() * specs.length)]
               : wilds[Math.floor(Math.random() * wilds.length)];

    hand.splice(hand.indexOf(chosen), 1);
    this._applyCard(chosen, p);
  }

  _cpuPickColor(playerIdx) {
    // Pick most frequent color in hand
    const hand = this.hands[playerIdx];
    const counts = {};
    for (const c of COLORS) counts[c] = 0;
    for (const card of hand) if (counts[card.color] !== undefined) counts[card.color]++;
    return COLORS.reduce((a, b) => counts[a] >= counts[b] ? a : b);
  }

  // ── Public controls ──────────────────────────────────────────────
  restart() {
    this.winner = null;
    this._init();
    if (window.CeroChat) CeroChat.system('Nueva mano — ¡a jugar!');
  }

  toggleMute() {
    if (!this.voice) return false;
    if (this.voice.enabled) this.voice.mute();
    else                    this.voice.unmute();
    return this.voice.enabled;
  }
}
