import { describe, it, expect } from 'vitest';
import {
  canTransitionJobStatus,
  assertJobStatusTransition,
  TransitionError,
} from '../src/transitions';

describe('job status transitions', () => {
  it('allows planned -> mobilized', () => {
    expect(canTransitionJobStatus('planned', 'mobilized')).toBe(true);
  });

  it('rejects planned -> executing (must mobilize first)', () => {
    expect(canTransitionJobStatus('planned', 'executing')).toBe(false);
  });

  it('allows executing -> complete', () => {
    expect(canTransitionJobStatus('executing', 'complete')).toBe(true);
  });

  it('treats closed as terminal', () => {
    expect(canTransitionJobStatus('closed', 'planned')).toBe(false);
  });

  it('assert throws TransitionError on illegal transition', () => {
    expect(() => assertJobStatusTransition('planned', 'executing')).toThrow(TransitionError);
  });

  it('assert is silent on legal transition', () => {
    expect(() => assertJobStatusTransition('planned', 'mobilized')).not.toThrow();
  });
});
