export class ExponentialBackoff {
  private attempts = 0;
  private readonly maxDelay: number;
  private readonly baseDelay: number;
  private lastDelay: number = 0;

  constructor(baseDelay = 1000, maxDelay = 30000) {
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  nextDelay(): number {
    this.lastDelay = Math.min(
      this.baseDelay * Math.pow(2, this.attempts),
      this.maxDelay,
    );
    this.attempts++;
    return this.lastDelay;
  }

  getLastDelay(): number {
    return this.lastDelay;
  }

  getAttempts(): number {
    return this.attempts;
  }

  reset(): void {
    this.attempts = 0;
  }
}
