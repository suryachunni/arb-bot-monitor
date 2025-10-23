import { TelegramNotifier } from './TelegramBot';

/**
 * Simple Telegram Bot wrapper for elite bot
 */
export class SimpleTelegramBot {
  private notifier: TelegramNotifier;
  private callbacks = {
    start: undefined as (() => void) | undefined,
    stop: undefined as (() => void) | undefined,
    pause: undefined as (() => void) | undefined,
    resume: undefined as (() => void) | undefined,
  };
  
  constructor() {
    this.notifier = new TelegramNotifier();
  }
  
  onStart(callback: () => void) {
    this.callbacks.start = callback;
    this.updateCallbacks();
  }
  
  onStop(callback: () => void) {
    this.callbacks.stop = callback;
    this.updateCallbacks();
  }
  
  onPause(callback: () => void) {
    this.callbacks.pause = callback;
    this.updateCallbacks();
  }
  
  onResume(callback: () => void) {
    this.callbacks.resume = callback;
    this.updateCallbacks();
  }
  
  private updateCallbacks() {
    this.notifier.onBotControls(this.callbacks);
  }
  
  async sendAlert(message: string) {
    await this.notifier.sendMessage(message);
  }
}
