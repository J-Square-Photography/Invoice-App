import { redirect } from 'next/navigation';

// Client details now open as a pop-up on the clients list. This keeps old links
// (dashboard, bookmarks) working by redirecting to the list with the pop-up open.
export default async function ClientDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/clients?view=${encodeURIComponent(id)}`);
}
