import { notFound } from 'next/navigation'
import StoryWorkshop from './workshop'

const stories = {
  'harry-potter': { title: 'Harry Potter', subtitle: 'The Wizarding World', theme: 'magic', mark: 'ϟ', characters: ['Harry Potter', 'Hermione Granger', 'Ron Weasley', 'Albus Dumbledore', 'Draco Malfoy'], personalities: ['Brave and loyal', 'Curious and clever', 'Witty and resourceful', 'Calm and wise'] },
  'game-of-thrones': { title: 'Game of Thrones', subtitle: 'A Song of Ice & Fire', theme: 'thrones', mark: '♛', characters: ['Daenerys Targaryen', 'Jon Snow', 'Tyrion Lannister', 'Arya Stark', 'Sansa Stark'], personalities: ['Honourable and steadfast', 'Clever and strategic', 'Bold and ambitious', 'Quietly determined'] },
  'fight-club': { title: 'Fight Club', subtitle: 'Rules are made to break', theme: 'fight', mark: '◒', characters: ['The Narrator', 'Tyler Durden', 'Marla Singer', 'Robert Paulson'], personalities: ['Restless and observant', 'Rebellious and fearless', 'Direct and defiant', 'Empathetic and grounded'] },
  'shawshank-redemption': { title: 'The Shawshank Redemption', subtitle: 'Hope is a good thing', theme: 'shawshank', mark: '↗', characters: ['Andy Dufresne', 'Ellis “Red” Redding', 'Brooks Hatlen', 'Warden Norton'], personalities: ['Hopeful and patient', 'Pragmatic and perceptive', 'Gentle and principled', 'Quietly resilient'] },
} as const

export default async function StoryPage({ params }: PageProps<'/story/[slug]'>) {
  const { slug } = await params
  const story = stories[slug as keyof typeof stories]
  if (!story) notFound()
  return <StoryWorkshop story={story} />
}
