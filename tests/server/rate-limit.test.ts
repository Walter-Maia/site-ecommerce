import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SlidingWindowLimiter } from "@/server/auth/rate-limit";

const MIN = 60_000;

function make(rule = { windowMs: 10 * MIN, max: 3, blockMs: MIN, maxBlockMs: 4 * MIN }) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  return { limiter: new SlidingWindowLimiter(rule, clock.now), clock };
}

describe("rate limiter (janela deslizante + bloqueio progressivo)", () => {
  it("permite até `max` tentativas na janela e bloqueia a seguinte", () => {
    const { limiter } = make();
    expect(limiter.hit("ip").limited).toBe(false);
    expect(limiter.hit("ip").limited).toBe(false);
    const third = limiter.hit("ip");
    expect(third.limited).toBe(false);
    expect(third.remaining).toBe(0);
    const fourth = limiter.hit("ip");
    expect(fourth.limited).toBe(true);
    expect(fourth.retryAfterMs).toBe(MIN);
  });

  it("chaves são independentes", () => {
    const { limiter } = make();
    for (let i = 0; i < 4; i++) limiter.hit("a");
    expect(limiter.status("a").limited).toBe(true);
    expect(limiter.status("b").limited).toBe(false);
  });

  it("janela desliza: tentativas antigas expiram", () => {
    const { limiter, clock } = make();
    limiter.hit("k");
    clock.advance(6 * MIN);
    limiter.hit("k");
    limiter.hit("k");
    expect(limiter.status("k").limited).toBe(true);
    clock.advance(4 * MIN + 1); // a primeira sai da janela de 10 min
    expect(limiter.status("k").limited).toBe(false);
    expect(limiter.hit("k").limited).toBe(false);
  });

  it("bloqueio dobra a cada reincidência e respeita o teto", () => {
    const { limiter, clock } = make();
    const strike = () => {
      let r = limiter.hit("x");
      while (!r.limited) r = limiter.hit("x");
      return r.retryAfterMs;
    };
    expect(strike()).toBe(MIN);
    clock.advance(MIN);
    expect(strike()).toBe(2 * MIN);
    clock.advance(2 * MIN);
    expect(strike()).toBe(4 * MIN);
    clock.advance(4 * MIN);
    expect(strike()).toBe(4 * MIN); // teto maxBlockMs
  });

  it("durante o bloqueio, novas tentativas não são contadas nem liberadas", () => {
    const { limiter, clock } = make();
    for (let i = 0; i < 4; i++) limiter.hit("y");
    clock.advance(30_000);
    const r = limiter.hit("y");
    expect(r.limited).toBe(true);
    expect(r.retryAfterMs).toBe(30_000);
    clock.advance(30_000);
    expect(limiter.hit("y").limited).toBe(false);
  });

  it("status() não registra tentativa; reset() libera (ex.: login ok)", () => {
    const { limiter } = make();
    for (let i = 0; i < 10; i++) limiter.status("z");
    expect(limiter.status("z").remaining).toBe(3);
    for (let i = 0; i < 4; i++) limiter.hit("z");
    expect(limiter.status("z").limited).toBe(true);
    limiter.reset("z");
    expect(limiter.status("z").limited).toBe(false);
  });
});
