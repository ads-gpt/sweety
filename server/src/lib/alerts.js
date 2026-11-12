import { rangeFor, statusOf } from './targets.js';

/** Below this the reading is treated as urgent (clinical "level 2" hypoglycaemia). */
export const CRITICAL_LOW = 54;

/**
 * Safety alert for a just-saved reading, or null if it is not low.
 *  - critical: under 54 mg/dl
 *  - low: under the user's own low target for that slot
 * Steps follow the widely used "rule of 15" for treating low glucose.
 */
export function glucoseAlert(value, slot, targets) {
  const { low } = rangeFor(slot, targets);
  if (value < CRITICAL_LOW) {
    return {
      level: 'critical',
      title: 'Very low glucose',
      message: `${value} mg/dl is very low.`,
      steps: [
        'Have 15 g of fast-acting carbohydrate right now: 3-4 glucose tablets, or half a cup (120 ml) of juice or regular soda.',
        `Recheck in 15 minutes. If you are still below ${low} mg/dl, repeat.`,
        'If you feel confused, faint or cannot swallow safely, ask someone to call emergency services straight away.',
      ],
    };
  }
  if (statusOf(value, slot, targets) === 'low') {
    return {
      level: 'low',
      title: 'Low glucose',
      message: `${value} mg/dl is below your target of ${low} mg/dl.`,
      steps: [
        'Have 15 g of fast-acting carbohydrate: glucose tablets, or half a cup (120 ml) of juice.',
        'Recheck in 15 minutes and repeat if you are still low.',
      ],
    };
  }
  return null;
}
