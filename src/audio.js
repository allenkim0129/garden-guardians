export const AUDIO_LIMITS = Object.freeze({ voices: 6, master: 1, impactGap: .12, ambientGap: 1.4 });
const tunes = { plant: [392, 523], sun: [659, 880], win: [523, 659, 784, 1047], lose: [330, 294, 220] };
const voices = {
  sleepy: { frequency: 105, end: 68, duration: .85, filter: 480, wave: "sawtooth", flutter: true },
  jelly: { frequency: 78, end: 115, duration: .7, filter: 320, wave: "triangle", pulses: true },
  roller: { noise: true, duration: .65, filter: 1900, filterEnd: 600, pulses: true },
  umbrella: { frequency: 145, end: 92, duration: .75, filter: 730, wave: "sawtooth", flutter: true },
};
const impacts = {
  sleepy: { frequency: 180, end: 75, filter: 700 },
  jelly: { frequency: 230, end: 55, filter: 420, wave: "triangle" },
  roller: { frequency: 460, end: 170, filter: 1700, wave: "triangle" },
  umbrella: { frequency: 330, end: 110, filter: 1100, wave: "triangle" },
};

export class GardenAudio {
  constructor(onError) {
    this.enabled = false;
    this.volume = .45;
    this.active = false;
    this.context = null;
    this.master = null;
    this.onError = onError;
    this.voices = new Set();
    this.lastPlayed = new Map();
    this.generation = 0;
    this.reset(null);
  }
  async unlock() {
    if (!this.enabled) return;
    this.active = true;
    const generation = ++this.generation;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("이 브라우저는 효과음을 지원하지 않아요.");
      this.context ??= new AudioContext();
      if (!this.master) {
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -18; limiter.knee.value = 12; limiter.ratio.value = 8;
        limiter.attack.value = .003; limiter.release.value = .15;
        this.master.connect(limiter).connect(this.context.destination);
      }
      if (this.context.state !== "running") await this.context.resume();
      if (generation === this.generation && this.enabled && this.active) {
        this.master.gain.value = AUDIO_LIMITS.master * this.volume;
      } else if (!this.active || !this.enabled) {
        this.master.gain.value = 0;
        if (this.context.state === "running") await this.context.suspend();
      }
    } catch (error) {
      this.active = false;
      this.onError(`소리를 켜지 못했어요. 소리 버튼을 다시 눌러 주세요. (${error.message})`);
    }
  }
  setVolume(volume) {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new RangeError("Invalid sound volume");
    this.volume = volume;
    if (volume === 0) this.stopVoices();
    if (this.master) this.master.gain.value = this.enabled && this.active ? AUDIO_LIMITS.master * volume : 0;
  }
  reset(game) {
    this.stopVoices();
    this.game = game;
    this.lastEffectId = (game?.nextId ?? 1) - 1;
    this.hurtTimes = new Map((game?.plants ?? []).map(plant => [plant.id, plant.hurtAt]));
    this.ambientDue = new Map();
    this.nextAmbientAt = (game?.time ?? 0) + 1;
    this.lastPlayed.clear();
  }
  update(game) {
    if (this.game !== game) this.reset(game);
    for (const effect of game.effects) {
      if (effect.id <= this.lastEffectId) continue;
      if (["hit", "ice", "burst", "splash", "flame", "gear"].includes(effect.kind)) this.play(effect.kind, effect.type);
    }
    this.lastEffectId = game.nextId - 1;
    for (const plant of game.plants) {
      if (plant.hurtAt !== undefined && plant.hurtAt !== this.hurtTimes.get(plant.id)) this.play("bite");
    }
    this.hurtTimes = new Map(game.plants.map(plant => [plant.id, plant.hurtAt]));
    if (!this.enabled || !this.active || game.status !== "playing") return;
    const walking = new Set(game.enemies.filter(enemy => !enemy.eating && enemy.x > 0 && enemy.x < 920).map(enemy => enemy.type));
    for (const type of this.ambientDue.keys()) if (!walking.has(type)) this.ambientDue.delete(type);
    for (const type of walking) if (!this.ambientDue.has(type)) this.ambientDue.set(type, game.time + .8);
    if (game.time < this.nextAmbientAt) return;
    const due = [...this.ambientDue].filter(([, at]) => at <= game.time).sort((a, b) => a[1] - b[1])[0];
    if (!due) return;
    this.play("ambient", due[0]);
    this.ambientDue.set(due[0], game.time + (due[0] === "roller" ? 3.4 : 6));
    this.nextAmbientAt = game.time + AUDIO_LIMITS.ambientGap;
  }
  play(kind, type = "sleepy") {
    if (!this.enabled || this.volume === 0 || !this.active || !this.master || this.context?.state !== "running") return false;
    const now = this.context.currentTime;
    const impact = kind === "hit" || kind === "ice" || kind === "bite";
    const category = impact ? "impact" : kind;
    const gap = impact ? AUDIO_LIMITS.impactGap : kind === "ambient" ? AUDIO_LIMITS.ambientGap : .08;
    if (now - (this.lastPlayed.get(category) ?? -Infinity) < gap) return false;
    if (this.voices.size >= AUDIO_LIMITS.voices) return false;
    this.lastPlayed.set(category, now);
    if (tunes[kind]) {
      tunes[kind].forEach((frequency, index) => this.emit({ frequency, end: frequency, duration: .15, volume: .055 }, index * .09));
    } else if (kind === "ambient") {
      if (!voices[type]) throw new RangeError(`Unknown zombie sound: ${type}`);
      this.emit({ ...voices[type], volume: .04 });
    } else if (kind === "hit") {
      if (!impacts[type]) throw new RangeError(`Unknown zombie impact: ${type}`);
      this.emit({ ...impacts[type], duration: .16, volume: .05 });
    } else if (kind === "ice") {
      this.emit({ frequency: 1000, end: 470, wave: "triangle", duration: .16, volume: .035 });
    } else if (kind === "bite") {
      this.emit({ noise: true, filter: 500, duration: .11, volume: .035 });
    } else if (kind === "flame") {
      this.emit({ noise: true, filter: 1600, filterEnd: 400, duration: .28, volume: .035 });
    } else if (kind === "burst" || kind === "splash") {
      this.emit({ noise: true, filter: 350, filterEnd: 80, duration: .32, volume: .055 });
    } else if (kind === "gear") {
      this.emit({ noise: true, filter: type === "umbrella" ? 1300 : 800, duration: .23, volume: .03 });
    } else {
      throw new RangeError(`Unknown sound: ${kind}`);
    }
    return true;
  }
  emit(sound, delay = 0) {
    if (this.voices.size >= AUDIO_LIMITS.voices) return;
    const c = this.context;
    const at = c.currentTime + delay;
    const end = at + sound.duration;
    let source;
    if (sound.noise) {
      if (!this.noise) {
        this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      source = c.createBufferSource();
      source.buffer = this.noise;
    } else {
      source = c.createOscillator();
      source.type = sound.wave ?? "sine";
      source.frequency.setValueAtTime(sound.frequency, at);
      if (sound.flutter) {
        for (let i = 1; i < 10; i++) source.frequency.linearRampToValueAtTime(
          sound.frequency + (sound.end - sound.frequency) * i / 10 + (i % 2 ? 5 : -5), at + sound.duration * i / 10);
      }
      source.frequency.linearRampToValueAtTime(sound.end, end);
    }
    const filter = c.createBiquadFilter();
    filter.type = sound.noise || sound.flutter ? "bandpass" : "lowpass";
    filter.Q.value = .7;
    filter.frequency.setValueAtTime(sound.filter ?? 2400, at);
    filter.frequency.linearRampToValueAtTime(sound.filterEnd ?? sound.filter ?? 2400, end);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(sound.volume, at + Math.min(.06, sound.duration * .15));
    if (sound.pulses) {
      gain.gain.linearRampToValueAtTime(.001, at + sound.duration * .43);
      gain.gain.linearRampToValueAtTime(sound.volume * .85, at + sound.duration * .65);
    }
    gain.gain.linearRampToValueAtTime(0, end);
    source.connect(filter).connect(gain).connect(this.master);
    const voice = { source, filter, gain, end };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect(); filter.disconnect(); gain.disconnect();
      this.voices.delete(voice);
    };
    source.start(at);
    source.stop(end);
  }
  stopVoices() {
    for (const voice of this.voices) {
      voice.gain.gain.cancelScheduledValues(this.context.currentTime);
      voice.gain.gain.setValueAtTime(0, this.context.currentTime);
      voice.source.stop(this.context.currentTime);
      voice.source.disconnect(); voice.filter.disconnect(); voice.gain.disconnect();
    }
    this.voices.clear();
  }
  suspend() {
    this.active = false;
    this.generation++;
    this.stopVoices();
    if (this.master) this.master.gain.value = 0;
    if (this.context?.state === "running") {
      this.context.suspend().catch(error => this.onError(`소리 일시 정지 실패: ${error.message}`));
    }
  }
}
