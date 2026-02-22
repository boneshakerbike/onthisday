/**
 * F1 Data Adapter Factory
 * Change one line here to swap providers.
 */

import type { F1DataAdapter } from './types';
import { JolpicaAdapter } from './jolpica';

let active_adapter: F1DataAdapter | null = null;

export function get_f1_adapter(): F1DataAdapter {
  if (!active_adapter) {
    // Swap point: replace JolpicaAdapter with any F1DataAdapter implementation
    active_adapter = new JolpicaAdapter();
  }
  return active_adapter;
}
