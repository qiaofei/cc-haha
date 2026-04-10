import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { act } from 'react'

vi.mock('../components/chat/MessageList', () => ({
  MessageList: () => <div data-testid="message-list" />,
}))

vi.mock('../components/chat/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}))

vi.mock('../components/teams/TeamStatusBar', () => ({
  TeamStatusBar: () => <div data-testid="team-status-bar" />,
}))

vi.mock('../components/chat/SessionTaskBar', () => ({
  SessionTaskBar: () => <div data-testid="session-task-bar" />,
}))

import { ActiveSession } from './ActiveSession'
import { useChatStore } from '../stores/chatStore'
import { useCLITaskStore } from '../stores/cliTaskStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTabStore } from '../stores/tabStore'

afterEach(() => {
  vi.useRealTimers()
  useTabStore.setState({ tabs: [], activeTabId: null })
  useSessionStore.setState({ sessions: [], activeSessionId: null, isLoading: false, error: null })
  useChatStore.setState({ sessions: {} })
})

describe('ActiveSession task polling', () => {
  it('refreshes CLI tasks repeatedly while a turn is active', async () => {
    vi.useFakeTimers()

    const sessionId = 'polling-session'
    const originalCliTaskState = useCLITaskStore.getState()
    const fetchSessionTasks = vi.fn().mockResolvedValue(undefined)

    useCLITaskStore.setState({
      sessionId,
      tasks: [],
      fetchSessionTasks,
    })

    useSessionStore.setState({
      sessions: [{
        id: sessionId,
        title: 'Polling Session',
        createdAt: '2026-04-10T00:00:00.000Z',
        modifiedAt: '2026-04-10T00:00:00.000Z',
        messageCount: 1,
        projectPath: '',
        workDir: null,
        workDirExists: true,
      }],
      activeSessionId: sessionId,
      isLoading: false,
      error: null,
    })
    useTabStore.setState({
      tabs: [{ sessionId, title: 'Polling Session', type: 'session', status: 'idle' }],
      activeTabId: sessionId,
    })
    useChatStore.setState({
      sessions: {
        [sessionId]: {
          messages: [],
          chatState: 'thinking',
          connectionState: 'connected',
          streamingText: '',
          streamingToolInput: '',
          activeToolUseId: null,
          activeToolName: null,
          activeThinkingId: null,
          pendingPermission: null,
          tokenUsage: { input_tokens: 0, output_tokens: 0 },
          elapsedSeconds: 0,
          statusVerb: '',
          slashCommands: [],
          agentTaskNotifications: {},
          elapsedTimer: null,
        },
      },
    })

    const { unmount } = render(<ActiveSession />)

    expect(fetchSessionTasks).toHaveBeenCalledWith(sessionId)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200)
    })

    expect(
      fetchSessionTasks.mock.calls.filter(([currentSessionId]) => currentSessionId === sessionId),
    ).toHaveLength(3)

    unmount()
    useCLITaskStore.setState(originalCliTaskState)
  })
})
