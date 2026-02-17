import { redirect } from 'next/navigation'

export default async function CommitteePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // Committee is managed as a tab on the scheme detail page
  redirect(`/schemes/${id}`)
}
