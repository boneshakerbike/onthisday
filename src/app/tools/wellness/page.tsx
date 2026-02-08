/**
 * Wellness redirect - backwards compatibility
 * Redirects to /health/wellness
 */

import { redirect } from 'next/navigation';

export default function WellnessRedirect() {
  redirect('/health/wellness');
}
