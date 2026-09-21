import { redirect } from 'next/navigation';

// Project details now open as a pop-up on the projects list. This keeps old links
// (dashboard, bookmarks) working by redirecting to the list with the pop-up open.
export default async function ProjectDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/projects?view=${encodeURIComponent(id)}`);
}
