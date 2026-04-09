import { useEffect } from 'react'
import { useSkillStore } from '../../stores/skillStore'
import { useTranslation } from '../../i18n'
import type { SkillMeta, SkillSource } from '../../types/skill'

const SOURCE_ORDER: SkillSource[] = ['user', 'project', 'plugin', 'mcp', 'bundled']

const SOURCE_ICONS: Record<SkillSource, string> = {
  user: 'person',
  project: 'folder',
  plugin: 'extension',
  mcp: 'hub',
  bundled: 'inventory_2',
}

export function SkillList() {
  const { skills, isLoading, error, fetchSkills, fetchSkillDetail } =
    useSkillStore()
  const t = useTranslation()

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-[var(--color-error)] py-4">{error}</div>
  }

  if (skills.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-[40px] text-[var(--color-text-tertiary)] mb-2 block">
          auto_awesome
        </span>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {t('settings.skills.empty')}
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          {t('settings.skills.emptyHint')}
        </p>
      </div>
    )
  }

  // Group by source
  const grouped: Partial<Record<SkillSource, SkillMeta[]>> = {}
  for (const skill of skills) {
    const src = skill.source as SkillSource
    ;(grouped[src] ??= []).push(skill)
  }

  return (
    <div className="flex flex-col gap-4">
      {SOURCE_ORDER.map((source) => {
        const group = grouped[source]
        if (!group?.length) return null

        return (
          <div key={source}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[16px] text-[var(--color-text-tertiary)]">
                {SOURCE_ICONS[source]}
              </span>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                {t(`settings.skills.source.${source}`)}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                ({group.length})
              </span>
            </div>

            {/* Skill items */}
            <div className="flex flex-col gap-1">
              {group.map((skill) => (
                <button
                  key={`${skill.source}-${skill.name}`}
                  onClick={() =>
                    skill.hasDirectory &&
                    fetchSkillDetail(skill.source, skill.name)
                  }
                  disabled={!skill.hasDirectory}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] transition-all text-left group disabled:opacity-60 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:border-[var(--color-border)]"
                >
                  <span className="material-symbols-outlined text-[18px] text-[var(--color-text-tertiary)]">
                    auto_awesome
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {skill.displayName || skill.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                      {skill.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                      ~{Math.ceil(skill.contentLength / 4)} tokens
                    </span>
                    {skill.hasDirectory && (
                      <span className="material-symbols-outlined text-[14px] text-[var(--color-text-tertiary)]">
                        chevron_right
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
