import type { AIWorldView } from '../AIWorldView.js';
import type { AIPersonality } from '../AIPersonality.js';
import type { AIRandom } from '../AIRandom.js';
import type { Task } from '../tasks/Task.js';

export interface Proposal {
  readonly domain: string;
  readonly action: string;
  readonly utility: number;
  createTask(): Task;
}

export interface Advisor {
  readonly domain: string;
  evaluate(view: AIWorldView, personality: AIPersonality, rng: AIRandom): Proposal[];
}
