/**
 * Stories page - redirects to Archive
 * Kept for backwards compatibility
 */

import { redirect } from 'next/navigation';

export default function StoriesPage() {
  redirect('/archive');
}
