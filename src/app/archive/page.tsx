/**
 * Archive redirect - backwards compatibility
 * Redirects to /creative/archive
 */

import { redirect } from 'next/navigation';

export default function ArchiveRedirect() {
  redirect('/creative/archive');
}
