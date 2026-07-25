type SimulationRequest = {
  worldName?: string
  leadCharacter?: string
  characters?: string[]
  outcome?: string
  personalityPrompt?: string
}

export async function POST(request: Request) {
  const input = (await request.json()) as SimulationRequest
  const lead = input.leadCharacter || 'The lead character'
  const companion = input.characters?.find((character) => character !== lead) || 'an old ally'
  const observer = input.characters?.find((character) => character !== lead && character !== companion) || 'a rival'
  const worldName = input.worldName || 'The story'
  const directive = input.outcome?.trim() || `Explore what changes when ${lead} chooses a different path.`

  await new Promise((resolve) => setTimeout(resolve, 650))

  return Response.json({
    episode: {
      id: 'episode-001',
      tick: 1,
      title: 'The first ripple',
      directive,
      personalityApplied: Boolean(input.personalityPrompt?.trim()),
      events: [
        {
          kind: 'world',
          actor: 'World Engine',
          title: 'Timeline fork established',
          text: `${worldName} accepts the altered premise and begins simulating consequences.`,
          affected: [lead, companion, observer],
        },
        {
          kind: 'thought',
          actor: lead,
          title: `${lead} detects an impossible detail`,
          text: `${lead} notices a clue that should not exist in the original timeline.`,
          line: 'This was not supposed to happen. That means I still have a choice.',
          affected: [lead],
        },
        {
          kind: 'decision',
          actor: lead,
          title: `${lead} breaks from canon`,
          text: input.personalityPrompt?.trim() || `${lead} decides to act before the old story can pull events back into place.`,
          line: input.personalityPrompt?.trim() || 'I am not going to follow the path written for me.',
          affected: [lead, companion],
        },
        {
          kind: 'relationship',
          actor: companion,
          target: lead,
          title: `${companion} reassesses trust`,
          text: `${companion} senses the shift and updates their belief about ${lead}.`,
          line: `Tell me the truth, ${lead}. What did you change?`,
          affected: [lead, companion, observer],
        },
      ],
      nextChoices: [`Follow the clue with ${companion}.`, `Watch how ${observer} reacts.`, 'Let the world continue without intervention.'],
    },
  })
}
