import type { ScaffoldJobPayload } from '@omnistack/types';

export const WEB_APP_TITLE = 'OmniStack Forge Web Studio';

export function formatJobHeader(job: ScaffoldJobPayload): string {
  return `${job.projectName} (${job.stackType})`;
}
