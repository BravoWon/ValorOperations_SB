import { describe, it, expect } from 'vitest';
import {
  computeSurvey,
  interpolateAtMd,
  DEFAULT_SURVEY,
  SURVEY_INPUT_COLUMNS,
  SURVEY_OUTPUT_COLUMNS,
} from '../src/compute/directional-survey';

describe('computeSurvey — minimum curvature', () => {
  it('a vertical well drops straight down (no displacement, no dogleg)', () => {
    const { stations, summary } = computeSurvey([
      { md: 0, inc: 0, azi: 0 },
      { md: 1000, inc: 0, azi: 0 },
    ]);
    const last = stations[1]!;
    expect(last.tvd).toBeCloseTo(1000, 6);
    expect(last.north).toBeCloseTo(0, 6);
    expect(last.east).toBeCloseTo(0, 6);
    expect(last.closure).toBeCloseTo(0, 6);
    expect(last.dls).toBeCloseTo(0, 6);
    expect(summary.totalTvd).toBeCloseTo(1000, 6);
  });

  it('a 30° build matches hand-computed minimum-curvature values', () => {
    // Segment 100→200: inc 0→30°, azi 0. β=30°, RF≈1.023327.
    const { stations } = computeSurvey([
      { md: 0, inc: 0, azi: 0 },
      { md: 100, inc: 0, azi: 0 },
      { md: 200, inc: 30, azi: 0 },
    ]);
    const s = stations[2]!;
    expect(s.tvd).toBeCloseTo(195.49, 1); // 100 + 95.49
    expect(s.north).toBeCloseTo(25.58, 1);
    expect(s.east).toBeCloseTo(0, 4);
    expect(s.dls).toBeCloseTo(30, 1); // 30° over 100 → 30°/100
    expect(s.buildRate).toBeCloseTo(30, 1);
    expect(s.turnRate).toBeCloseTo(0, 6);
    expect(s.closureAzimuth).toBeCloseTo(0, 4);
  });

  it('a 90° turn to the east lands due-east with a 90°/100 dogleg', () => {
    const { stations } = computeSurvey([
      { md: 0, inc: 0, azi: 0 },
      { md: 100, inc: 90, azi: 90 },
    ]);
    const s = stations[1]!;
    expect(s.tvd).toBeCloseTo(63.66, 1); // 50*(1+0)*RF, RF=4/π
    expect(s.east).toBeCloseTo(63.66, 1);
    expect(s.north).toBeCloseTo(0, 4);
    expect(s.closureAzimuth).toBeCloseTo(90, 1);
    expect(s.dls).toBeCloseTo(90, 1);
  });

  it('respects an explicit VS azimuth and reports it in the summary', () => {
    // Due-east well; VS along 90° equals closure, VS along 0° is ~0.
    const east = computeSurvey([{ md: 0, inc: 0, azi: 0 }, { md: 100, inc: 90, azi: 90 }], { vsAzimuth: 90 });
    expect(east.summary.vsAzimuth).toBe(90);
    expect(east.stations[1]!.vs).toBeCloseTo(east.stations[1]!.closure, 4);
    const north = computeSurvey([{ md: 0, inc: 0, azi: 0 }, { md: 100, inc: 90, azi: 90 }], { vsAzimuth: 0 });
    expect(north.stations[1]!.vs).toBeCloseTo(0, 4);
  });

  it('supports a metric course length for dls normalization', () => {
    const { stations } = computeSurvey(
      [{ md: 0, inc: 0, azi: 0 }, { md: 30, inc: 9, azi: 0 }],
      { courseLength: 30 },
    );
    expect(stations[1]!.dls).toBeCloseTo(9, 4); // 9° over 30 m → 9°/30m
  });

  it('reorders out-of-order stations and warns', () => {
    const { stations, warnings } = computeSurvey([
      { md: 0, inc: 0, azi: 0 },
      { md: 200, inc: 30, azi: 0 },
      { md: 100, inc: 0, azi: 0 },
    ]);
    expect(stations.map((s) => s.md)).toEqual([0, 100, 200]);
    expect(warnings.some((w) => /reordered/i.test(w))).toBe(true);
  });

  it('warns on a high dogleg', () => {
    const { warnings } = computeSurvey([
      { md: 0, inc: 0, azi: 0 },
      { md: 100, inc: 90, azi: 90 }, // 90°/100 ≫ 10
    ]);
    expect(warnings.some((w) => /dogleg/i.test(w))).toBe(true);
  });

  it('the demo survey lands near-horizontal with eastward closure', () => {
    const { summary } = computeSurvey(DEFAULT_SURVEY);
    expect(summary.totalMd).toBe(5000);
    expect(summary.totalTvd).toBeGreaterThan(0);
    expect(summary.totalTvd).toBeLessThan(5000); // deviated, so TVD < MD
    expect(summary.closure).toBeGreaterThan(0);
    expect(summary.closureAzimuth).toBeGreaterThan(80);
    expect(summary.closureAzimuth).toBeLessThan(100); // built roughly east
  });
});

describe('interpolateAtMd', () => {
  it('returns the exact station when md matches', () => {
    const r = interpolateAtMd(DEFAULT_SURVEY, 2000)!;
    expect(r.md).toBe(2000);
    expect(r.inc).toBe(0);
  });

  it('interpolates monotonically between stations', () => {
    const at = interpolateAtMd(DEFAULT_SURVEY, 2250)!;
    const lo = computeSurvey(DEFAULT_SURVEY).stations.find((s) => s.md === 2000)!;
    const hi = computeSurvey(DEFAULT_SURVEY).stations.find((s) => s.md === 2500)!;
    expect(at.inc).toBeCloseTo(7.5, 4); // halfway between 0 and 15
    expect(at.tvd).toBeGreaterThan(lo.tvd);
    expect(at.tvd).toBeLessThan(hi.tvd);
  });

  it('returns null beyond the surveyed range', () => {
    expect(interpolateAtMd(DEFAULT_SURVEY, 99999)).toBeNull();
  });
});

describe('registry specs', () => {
  it('expose input + output columns for the panel', () => {
    expect(SURVEY_INPUT_COLUMNS.map((c) => c.key)).toEqual(['md', 'inc', 'azi']);
    expect(SURVEY_OUTPUT_COLUMNS.length).toBeGreaterThan(4);
    expect(SURVEY_OUTPUT_COLUMNS.find((c) => c.key === 'tvd')).toBeDefined();
  });
});
