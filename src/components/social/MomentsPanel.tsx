import { Heart, Images } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { AgentMoment, CharacterCard } from '../../domain/types'
import { EmptyState, WorkspaceTitle } from '../memory/atoms'

interface MomentsPanelProps {
  characters: CharacterCard[]
  moments: AgentMoment[]
}

export function MomentsPanel({ characters, moments }: MomentsPanelProps) {
  const characterById = useMemo(() => new Map(characters.map((character) => [character.id, character])), [characters])
  const orderedMoments = useMemo(
    () =>
      [...moments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [moments],
  )

  return (
    <main className="workspace detail-workspace social-workspace">
      <WorkspaceTitle
        description="角色动态和朋友圈式展示单独放在这里。"
        icon={<Images size={20} />}
        title="动态"
      />

      <section className="moments-feed">
        {orderedMoments.length === 0 && <EmptyState text="今天还没有角色动态。" />}
        {orderedMoments.map((moment) => {
          const author = characterById.get(moment.authorCharacterId)
          return (
            <article className="moment-card" key={moment.id}>
              <header className="moment-card-head">
                <span
                  className="moment-avatar"
                  style={{ '--avatar-accent': author?.accent ?? 'var(--rose)' } as CSSProperties}
                >
                  {author?.avatar ?? '？'}
                </span>
                <span>
                  <strong>{author?.name ?? '角色'}</strong>
                  <small>{author?.title ?? '百合小窝'} / {formatSocialTime(moment.createdAt)}</small>
                </span>
              </header>
              <p>{moment.content}</p>
              <footer>
                <span className="moment-mood">{moment.mood || '一点小心情'}</span>
                <span className="moment-heart">
                  <Heart size={14} />
                  百合小窝
                </span>
              </footer>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function formatSocialTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
