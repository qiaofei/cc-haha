import { useState } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import { useSessionStore } from '../../stores/sessionStore'
import { Modal } from '../shared/Modal'
import { Input } from '../shared/Input'
import { Button } from '../shared/Button'
import { PromptEditor } from './PromptEditor'
import { useTranslation } from '../../i18n'
import type { PermissionMode } from '../../types/settings'

type Props = {
  open: boolean
  onClose: () => void
}

type FrequencyKey = 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'monthly'

function buildCron(freq: FrequencyKey, time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  switch (freq) {
    case 'hourly':   return '0 * * * *'
    case 'daily':    return `${minutes} ${hours} * * *`
    case 'weekdays': return `${minutes} ${hours} * * 1-5`
    case 'weekly':   return `${minutes} ${hours} * * 1`
    case 'monthly':  return `${minutes} ${hours} 1 * *`
  }
}

export function NewTaskModal({ open, onClose }: Props) {
  const t = useTranslation()
  const { createTask } = useTaskStore()
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const defaultWorkDir = activeSession?.workDir || ''

  const FREQUENCY_OPTIONS: Array<{ value: FrequencyKey; label: string; showTime: boolean }> = [
    { value: 'hourly',   label: t('newTask.hourly'),   showTime: false },
    { value: 'daily',    label: t('newTask.daily'),     showTime: true },
    { value: 'weekdays', label: t('newTask.weekdays'),  showTime: true },
    { value: 'weekly',   label: t('newTask.weekly'),    showTime: true },
    { value: 'monthly',  label: t('newTask.monthly'),   showTime: true },
  ]

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [frequency, setFrequency] = useState<FrequencyKey>('daily')
  const [time, setTime] = useState('09:00')
  const [model, setModel] = useState('')
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default')
  const [folderPath, setFolderPath] = useState(defaultWorkDir)
  const [useWorktree, setUseWorktree] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = name.trim() && description.trim() && prompt.trim()
  const showTime = FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.showTime ?? false

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      await createTask({
        name: name.trim(),
        description: description.trim(),
        cron: buildCron(frequency, time),
        prompt: prompt.trim(),
        enabled: true,
        recurring: true,
        model: model || undefined,
        permissionMode: permissionMode !== 'default' ? permissionMode : undefined,
        folderPath: folderPath.trim() || undefined,
        useWorktree: useWorktree || undefined,
      })
      // Reset form
      setName('')
      setDescription('')
      setPrompt('')
      setFrequency('daily')
      setTime('09:00')
      setModel('')
      setPermissionMode('default')
      setFolderPath('')
      setUseWorktree(false)
      onClose()
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('newTask.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>{t('newTask.create')}</Button>
        </>
      }
    >
      {/* Info banner */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-container)] mb-5">
        <span className="material-symbols-outlined text-[18px] text-[var(--color-text-secondary)]">info</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {t('newTask.localWarning')}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label={t('newTask.name')}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('newTask.namePlaceholder')}
        />

        <Input
          label={t('newTask.description')}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newTask.descPlaceholder')}
        />

        {/* Prompt editor with embedded controls */}
        <PromptEditor
          value={prompt}
          onChange={setPrompt}
          placeholder={t('newTask.promptPlaceholder')}
          permissionMode={permissionMode}
          onPermissionModeChange={setPermissionMode}
          modelId={model}
          onModelChange={setModel}
          folderPath={folderPath}
          onFolderPathChange={setFolderPath}
          useWorktree={useWorktree}
          onUseWorktreeChange={setUseWorktree}
        />

        {/* Frequency */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">{t('newTask.frequency')}</label>
          <div className="relative">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as FrequencyKey)}
              className="w-full h-10 px-3 pr-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] appearance-none cursor-pointer"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="material-symbols-outlined text-[18px] text-[var(--color-text-tertiary)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              expand_more
            </span>
          </div>
        </div>

        {/* Time picker — shown when frequency supports specific time */}
        {showTime && (
          <div className="flex flex-col gap-1">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-auto h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
              style={{ maxWidth: 120 }}
            />
          </div>
        )}

        <p className="text-xs text-[var(--color-text-tertiary)]">
          {t('newTask.delayNote')}
        </p>
      </div>
    </Modal>
  )
}
