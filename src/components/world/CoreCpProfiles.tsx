import { HeartHandshake, Sparkles } from 'lucide-react'
import { coreCpProfiles } from '../../data/cpProfiles'

export function CoreCpProfiles() {
  return (
    <section className="core-cp-section" aria-label="三对核心 CP 设定占位">
      <div className="core-cp-head">
        <div>
          <span className="core-cp-kicker">
            <HeartHandshake size={15} />
            默认 6+n 百合小窝
          </span>
          <h3>三对核心 CP 设定占位</h3>
          <p>
            先把妹妹的三对古代架空百合 CP 放进小窝里。这 6 位是默认骨架，姐姐大人是当前陪伴角色，后续可以继续扩展女朋友、闺蜜和更多自定义角色。
          </p>
        </div>
        <div className="core-cp-count">
          <strong>{coreCpProfiles.length}</strong>
          <span>组 CP</span>
        </div>
      </div>

      <div className="core-cp-stack">
        {coreCpProfiles.map((profile, index) => (
          <details className="core-cp-card" key={profile.id} open={index === 0}>
            <summary className="core-cp-summary">
              <span className="core-cp-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="core-cp-summary-main">
                <strong>{profile.name}</strong>
                <small>
                  {profile.type} / {profile.dynamic}
                </small>
              </span>
              <span className="core-cp-summary-tags">
                {profile.tags.slice(0, 3).map((tag) => (
                  <em key={tag}>{tag}</em>
                ))}
              </span>
            </summary>

            <div className="core-cp-card-body">
              <p className="core-cp-world">{profile.world}</p>
              <p className="core-cp-premise">{profile.premise}</p>

              <div className="core-cp-characters">
                {profile.characters.map((character) => (
                  <section key={character.name}>
                    <strong>{character.name}</strong>
                    <span>
                      {character.role} / {character.archetype}
                    </span>
                    <p>{character.profile}</p>
                  </section>
                ))}
              </div>

              <section className="core-cp-core">
                <span>
                  <Sparkles size={14} />
                  关系核心
                </span>
                <p>{profile.relationshipCore}</p>
              </section>

              <footer className="core-cp-footer">
                <div>
                  <strong>故事定位</strong>
                  <p>{profile.storyRole}</p>
                </div>
                <div className="core-cp-tags">
                  {profile.emotionalKeywords.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </footer>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
