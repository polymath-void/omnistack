/**
 * @omnistack/templates - Niche Catalog Aggregator
 * 10 Distinct E-Commerce / Web Niches x 10 High-Visual-Reasoning Templates = 100 Master Templates
 */

import { CYBERMECH_TEMPLATES } from './cybermech.js';
import { AURAROAST_TEMPLATES } from './auraroast.js';
import { HYPERDEV_TEMPLATES } from './hyperdev.js';
import { KICKSVAULT_TEMPLATES } from './kicksvault.js';
import { BOTANICA_TEMPLATES } from './botanica.js';
import { SONICCRAFT_TEMPLATES } from './soniccraft.js';
import { ORBITWEAR_TEMPLATES } from './orbitwear.js';
import { VINOHERITAGE_TEMPLATES } from './vinoheritage.js';
import { VELOCITY_TEMPLATES } from './velocity.js';
import { CERAMICS_TEMPLATES } from './ceramics.js';
import type { StoreTemplateItem } from '../types.js';

export {
  CYBERMECH_TEMPLATES,
  AURAROAST_TEMPLATES,
  HYPERDEV_TEMPLATES,
  KICKSVAULT_TEMPLATES,
  BOTANICA_TEMPLATES,
  SONICCRAFT_TEMPLATES,
  ORBITWEAR_TEMPLATES,
  VINOHERITAGE_TEMPLATES,
  VELOCITY_TEMPLATES,
  CERAMICS_TEMPLATES,
};

export const ALL_NICHE_TEMPLATES: StoreTemplateItem[] = [
  ...CYBERMECH_TEMPLATES,
  ...AURAROAST_TEMPLATES,
  ...HYPERDEV_TEMPLATES,
  ...KICKSVAULT_TEMPLATES,
  ...BOTANICA_TEMPLATES,
  ...SONICCRAFT_TEMPLATES,
  ...ORBITWEAR_TEMPLATES,
  ...VINOHERITAGE_TEMPLATES,
  ...VELOCITY_TEMPLATES,
  ...CERAMICS_TEMPLATES,
];
