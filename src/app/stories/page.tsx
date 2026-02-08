/**
 * Stories redirect - backwards compatibility
 * Redirects to /creative/archive
 */

import { redirect } from 'next/navigation';

export default function StoriesRedirect() {
  redirect('/creative/archive');
}
