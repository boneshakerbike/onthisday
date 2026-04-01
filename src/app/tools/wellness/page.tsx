/**
 * Wellness redirect - backwards compatibility
 * Redirects to /health/oura
 */

import { redirect } from 'next/navigation';

export default function WellnessRedirect() {
  redirect('/health/oura');
}
