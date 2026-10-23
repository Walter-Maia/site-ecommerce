import "server-only";

/**
 * Rate limit em memória com janela deslizante (log de timestamps por chave)
 * e bloqueio progressivo: cada estouro dobra o bloqueio (até maxBlockMs).
 * As "strikes" esquecem depois de `strikeDecayMs` sem novos estouros.
 *
 * Em memória = por instância. Com várias instâncias, trocar por Redis/DB
 * mantendo a mesma interface.
 */
export interface RateLimitRule {
  windowMs: number;
  max: number;
  blockMs: number;
  maxBlockMs: number;
  strikeDecayMs?: number;
}

export interface RateLimitStatus {
  limited: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface Block {
  until: number;
  strikes: number;
  lastStrikeAt: number;
}

export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();
  private blocks = new Map<string, Block>();
  private ops = 0;

  constructor(
    readonly rule: RateLimitRule,
    private readonly now: () => number = Date.now,
  ) {}

  private recent(key: string, t: number): number[] {
    const list = this.hits.get(key);
    if (!list) return [];
    const from = t - this.rule.windowMs;
    let i = 0;
    while (i < list.length && list[i] <= from) i++;
    if (i > 0) list.splice(0, i);
    if (list.length === 0) this.hits.delete(key);
    return list;
  }

  /** Consulta sem registrar tentativa. */
  status(key: string): RateLimitStatus {
    const t = this.now();
    const block = this.blocks.get(key);
    if (block && block.until > t) return { limited: true, remaining: 0, retryAfterMs: block.until - t };
    const list = this.recent(key, t);
    if (list.length >= this.rule.max) {
      return { limited: true, remaining: 0, retryAfterMs: list[0] + this.rule.windowMs - t };
    }
    return { limited: false, remaining: this.rule.max - list.length, retryAfterMs: 0 };
  }

  /** Registra uma tentativa. Ao passar do limite, bloqueia de forma progressiva. */
  hit(key: string): RateLimitStatus {
    const t = this.now();
    this.maybeSweep(t);
    const block = this.blocks.get(key);
    if (block && block.until > t) return { limited: true, remaining: 0, retryAfterMs: block.until - t };

    const list = this.recent(key, t);
    list.push(t);
    this.hits.set(key, list);
    if (list.length <= this.rule.max) {
      return { limited: false, remaining: this.rule.max - list.length, retryAfterMs: 0 };
    }

    const decay = this.rule.strikeDecayMs ?? 24 * 60 * 60 * 1000;
    const strikes = block && t - block.lastStrikeAt < decay ? block.strikes + 1 : 1;
    const ms = Math.min(this.rule.blockMs * 2 ** (strikes - 1), this.rule.maxBlockMs);
    this.blocks.set(key, { until: t + ms, strikes, lastStrikeAt: t });
    this.hits.delete(key);
    return { limited: true, remaining: 0, retryAfterMs: ms };
  }

  /** Zera a janela (ex.: login bem-sucedido). Mantém o histórico de strikes. */
  reset(key: string) {
    this.hits.delete(key);
    const block = this.blocks.get(key);
    if (block) block.until = 0;
  }

  private maybeSweep(t: number) {
    if (++this.ops % 500 !== 0) return;
    const decay = this.rule.strikeDecayMs ?? 24 * 60 * 60 * 1000;
    for (const key of this.hits.keys()) this.recent(key, t);
    for (const [key, b] of this.blocks) if (b.until <= t && t - b.lastStrikeAt > decay) this.blocks.delete(key);
  }
}

const MIN = 60_000;

/** Regras por fluxo. IP limita volume; e-mail limita força bruta numa conta. */
export const RULES = {
  loginIp: { windowMs: 15 * MIN, max: 20, blockMs: 5 * MIN, maxBlockMs: 60 * MIN },
  loginEmail: { windowMs: 15 * MIN, max: 5, blockMs: 5 * MIN, maxBlockMs: 60 * MIN },
  loginGlobal: { windowMs: MIN, max: 300, blockMs: MIN, maxBlockMs: 5 * MIN },
  registerIp: { windowMs: 60 * MIN, max: 10, blockMs: 15 * MIN, maxBlockMs: 6 * 60 * MIN },
  checkoutIp: { windowMs: 10 * MIN, max: 10, blockMs: 5 * MIN, maxBlockMs: 60 * MIN },
  newsletterIp: { windowMs: 10 * MIN, max: 5, blockMs: 10 * MIN, maxBlockMs: 60 * MIN },
  newsletterEmail: { windowMs: 60 * MIN, max: 3, blockMs: 30 * MIN, maxBlockMs: 6 * 60 * MIN },
} satisfies Record<string, RateLimitRule>;

type LimiterName = keyof typeof RULES;

const g = globalThis as unknown as { __qdLimiters?: Map<LimiterName, SlidingWindowLimiter> };

/** Limitadores compartilhados pelo processo (sobrevivem ao HMR). */
export function limiter(name: LimiterName): SlidingWindowLimiter {
  g.__qdLimiters ??= new Map();
  let l = g.__qdLimiters.get(name);
  if (!l) {
    l = new SlidingWindowLimiter(RULES[name]);
    g.__qdLimiters.set(name, l);
  }
  return l;
}

export function retryMessage(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / MIN));
  return `Muitas tentativas. Tente novamente em ${min} minuto${min > 1 ? "s" : ""}.`;
}
