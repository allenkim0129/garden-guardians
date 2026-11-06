export class GardenAudio {
  constructor(onError) {
    this.enabled = false;
    this.context = null;
    this.onError = onError;
  }
  async unlock() {
    if (!this.enabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("이 브라우저는 효과음을 지원하지 않아요.");
      this.context ??= new AudioContext();
      if (this.context.state !== "running") await this.context.resume();
    } catch (error) {
      this.onError(`소리를 켜지 못했어요. 소리 버튼을 다시 눌러 주세요. (${error.message})`);
    }
  }
  play(kind) {
    if (!this.enabled || this.context?.state !== "running") return;
    const tunes = { plant: [392, 523], sun: [659, 880], hit: [180], burst: [130, 80], win: [523, 659, 784, 1047], lose: [330, 294, 220] };
    const notes = tunes[kind] ?? [440];
    notes.forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const time = this.context.currentTime + index * .09;
      oscillator.type = kind === "burst" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(.055, time + .008);
      gain.gain.exponentialRampToValueAtTime(.001, time + .14);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(time);
      oscillator.stop(time + .15);
    });
  }
  suspend() {
    if (this.context?.state === "running") {
      this.context.suspend().catch(error => this.onError(`소리 일시 정지 실패: ${error.message}`));
    }
  }
}
