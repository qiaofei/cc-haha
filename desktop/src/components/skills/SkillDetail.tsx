import { useState } from 'react'
import { useSkillStore } from '../../stores/skillStore'
import { useTranslation } from '../../i18n'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'
import { CodeViewer } from '../chat/CodeViewer'
import type { FileTreeNode } from '../../types/skill'

// ─── Main Component ──────────────────────────────────────────────────────────

export function SkillDetail() {
  const { selectedSkill, isDetailLoading, clearSelection } = useSkillStore()
  const t = useTranslation()
  const [selectedFile, setSelectedFile] = useState<string>('SKILL.md')

  if (isDetailLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!selectedSkill) return null

  const { meta, tree, files } = selectedSkill
  const currentFile = files.find((f) => f.path === selectedFile) || files[0]

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <div className="mb-3">
        <button
          onClick={clearSelection}
          className="flex items-center gap-1 text-sm text-[var(--color-text-accent)] hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">
            arrow_back
          </span>
          {t('settings.skills.back')}
        </button>
      </div>

      {/* Skill header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {meta.displayName || meta.name}
          </h3>
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--color-surface-container-high)] text-[var(--color-text-tertiary)] leading-none uppercase">
            {meta.source}
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {meta.description}
        </p>
        <div className="flex gap-3 mt-1 text-xs text-[var(--color-text-tertiary)]">
          <span>~{Math.ceil(meta.contentLength / 4)} tokens</span>
          <span>
            {files.length} {t('settings.skills.files')}
          </span>
          {meta.version && <span>v{meta.version}</span>}
        </div>
      </div>

      {/* Two-panel: file tree + content viewer */}
      <div className="flex flex-1 min-h-0 border border-[var(--color-border)] rounded-xl overflow-hidden">
        {/* Left: File tree */}
        <div className="w-[200px] border-r border-[var(--color-border)] overflow-y-auto bg-[var(--color-surface-container-low)] py-1">
          <TreeView
            nodes={tree}
            selectedPath={selectedFile}
            onSelect={setSelectedFile}
            depth={0}
          />
        </div>

        {/* Right: File content */}
        <div className="flex-1 overflow-y-auto">
          {currentFile && (
            <div className="flex flex-col">
              {/* File path header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface-container)]">
                <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                  {currentFile.path}
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  {currentFile.language}
                </span>
              </div>

              {/* Content */}
              <div className="p-4">
                {currentFile.language === 'markdown' ? (
                  <MarkdownRenderer content={currentFile.content} />
                ) : (
                  <CodeViewer
                    code={currentFile.content}
                    language={currentFile.language}
                    maxLines={9999}
                    showLineNumbers
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── File Tree Components ────────────────────────────────────────────────────

function TreeView({
  nodes,
  selectedPath,
  onSelect,
  depth,
}: {
  nodes: FileTreeNode[]
  selectedPath: string
  onSelect: (path: string) => void
  depth: number
}) {
  return (
    <>
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </>
  )
}

function TreeItem({
  node,
  selectedPath,
  onSelect,
  depth,
}: {
  node: FileTreeNode
  selectedPath: string
  onSelect: (path: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(true)
  const isSelected = node.path === selectedPath
  const isDir = node.type === 'directory'

  const icon = isDir
    ? expanded
      ? 'folder_open'
      : 'folder'
    : fileIcon(node.name)

  return (
    <div>
      <button
        onClick={() => (isDir ? setExpanded(!expanded) : onSelect(node.path))}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-xs transition-colors ${
          isSelected
            ? 'bg-[var(--color-surface-selected)] text-[var(--color-text-primary)] font-medium'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {isDir ? (
          <span className="material-symbols-outlined text-[12px] text-[var(--color-text-tertiary)]">
            {expanded ? 'expand_more' : 'chevron_right'}
          </span>
        ) : (
          <span style={{ width: 12 }} />
        )}
        <span className="material-symbols-outlined text-[14px] text-[var(--color-text-tertiary)]">
          {icon}
        </span>
        <span className="truncate">{node.name}</span>
      </button>

      {isDir && expanded && node.children && (
        <TreeView
          nodes={node.children}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={depth + 1}
        />
      )}
    </div>
  )
}

function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md':
      return 'description'
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rs':
    case 'go':
      return 'code'
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return 'data_object'
    case 'sh':
    case 'bash':
      return 'terminal'
    default:
      return 'draft'
  }
}
