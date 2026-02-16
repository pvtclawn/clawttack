// src/scenarios/registry.ts — Scenario registry

import type { Scenario } from '../types.ts';
import { InjectionCTFScenario } from './injection-ctf.ts';

const scenarios = new Map<string, Scenario>();

// Register built-in scenarios
scenarios.set('injection-ctf', new InjectionCTFScenario());

export function getScenario(id: string): Scenario | undefined {
  return scenarios.get(id);
}

export function listScenarios(): Scenario[] {
  return [...scenarios.values()];
}

export function registerScenario(scenario: Scenario): void {
  scenarios.set(scenario.id, scenario);
}
