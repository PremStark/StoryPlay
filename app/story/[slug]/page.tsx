import StoryWorkshop from './workshop'

export default async function StoryPage({ params }: PageProps<'/story/[slug]'>) {
  const { slug } = await params
  return <StoryWorkshop bookInitId={slug} />
}
