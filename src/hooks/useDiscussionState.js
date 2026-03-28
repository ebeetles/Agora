import { RoomEvent } from 'livekit-client'
import { useCallback, useEffect, useReducer, useRef } from 'react'

const MAX_DRIFT = 45

function clampDrift(x, y) {
  const nx = Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, x))
  const ny = Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, y))
  return { x: nx, y: ny }
}

function initAgentRecord() {
  return {
    offset: { x: 0, y: 0 },
    isThinking: false,
    isSpeaking: false,
    captionWords: [],
    lastCaptionFull: '',
    captionEndTick: 0,
    reactTick: 0,
  }
}

function discussionReducer(state, action) {
  switch (action.type) {
    case 'topicUpdate':
      return { ...state, topic: action.newTopic, topicPulseKey: state.topicPulseKey + 1 }

    case 'speaking': {
      const { agentName, isThinking } = action
      const per = { ...state.perAgent }
      for (const k of Object.keys(per)) {
        per[k] = { ...per[k], isSpeaking: false, isThinking: false }
      }
      const cur = { ...(per[agentName] || initAgentRecord()) }
      cur.isThinking = Boolean(isThinking)
      cur.isSpeaking = !cur.isThinking
      per[agentName] = cur
      return { ...state, perAgent: per }
    }

    case 'caption': {
      const { agentName, word } = action
      const per = { ...state.perAgent }
      const cur = { ...(per[agentName] || initAgentRecord()) }
      cur.captionWords = [...cur.captionWords, word]
      per[agentName] = cur
      return { ...state, perAgent: per }
    }

    case 'captionEnd': {
      const { agentName } = action
      const per = { ...state.perAgent }
      const cur = { ...(per[agentName] || initAgentRecord()) }
      const full = cur.captionWords.join('').trim()
      let { transcript } = state
      if (full) {
        const color = state.agentColors[agentName] || '#888'
        transcript = [
          ...transcript,
          {
            id: `${Date.now()}-${agentName}`,
            name: agentName,
            text: full,
            color,
          },
        ]
        // no slice — keep full history for the conversation panel
      }
      per[agentName] = {
        ...cur,
        captionWords: [],
        lastCaptionFull: full,
        captionEndTick: (cur.captionEndTick || 0) + 1,
        isThinking: false,
        isSpeaking: false,
      }
      return { ...state, perAgent: per, transcript }
    }

    case 'agentMove': {
      const { agentName, dx, dy } = action
      const per = { ...state.perAgent }
      const cur = { ...(per[agentName] || initAgentRecord()) }
      if (dx === 0 && dy === 0) {
        cur.offset = { x: 0, y: 0 }
      } else {
        cur.offset = clampDrift(cur.offset.x + dx, cur.offset.y + dy)
      }
      per[agentName] = cur
      return { ...state, perAgent: per }
    }

    case 'agentReact': {
      const { agentName } = action
      const per = { ...state.perAgent }
      const cur = { ...(per[agentName] || initAgentRecord()) }
      cur.reactTick = (cur.reactTick || 0) + 1
      per[agentName] = cur
      return { ...state, perAgent: per }
    }

    case 'userCaption': {
      // Add user entry to the full conversation transcript
      const entry = {
        id: `${Date.now()}-you`,
        name: 'You',
        text: action.text,
        color: '#888',
      }
      return { ...state, transcript: [...state.transcript, entry] }
    }

    default:
      return state
  }
}

function buildInitialState(topic, agents) {
  const agentColors = {}
  agents.forEach((a) => {
    agentColors[a.name] = a.color
  })
  return {
    topic,
    topicPulseKey: 0,
    perAgent: {},
    transcript: [],
    agentColors,
  }
}

/**
 * Subscribes to LiveKit data messages and exposes discussion UI state.
 */
export function useDiscussionState(room, topic, agents) {
  const [state, dispatch] = useReducer(
    discussionReducer,
    { topic, agents },
    ({ topic: t, agents: ag }) => buildInitialState(t, ag),
  )

  const resetDriftTimer = useRef(null)

  const scheduleDriftDecay = useCallback(() => {
    if (resetDriftTimer.current) clearTimeout(resetDriftTimer.current)
    resetDriftTimer.current = window.setTimeout(() => {
      agents.forEach((a) => {
        dispatch({ type: 'agentMove', agentName: a.name, dx: 0, dy: 0 })
      })
    }, 3000)
  }, [agents])

  useEffect(() => {
    if (!room) return

    const onData = (payload) => {
      let msg
      try {
        msg = JSON.parse(new TextDecoder().decode(payload))
      } catch {
        return
      }
      const t = msg.type
      if (t === 'topicUpdate' && typeof msg.newTopic === 'string') {
        dispatch({ type: 'topicUpdate', newTopic: msg.newTopic })
        return
      }
      if (t === 'speaking' && msg.agentName != null) {
        dispatch({ type: 'speaking', agentName: msg.agentName, isThinking: Boolean(msg.isThinking) })
        return
      }
      if (t === 'caption' && msg.agentName != null && typeof msg.word === 'string') {
        dispatch({ type: 'caption', agentName: msg.agentName, word: msg.word })
        return
      }
      if (t === 'captionEnd' && msg.agentName != null) {
        dispatch({ type: 'captionEnd', agentName: msg.agentName })
        return
      }
      if (t === 'agentMove' && msg.agentName != null && typeof msg.dx === 'number' && typeof msg.dy === 'number') {
        dispatch({ type: 'agentMove', agentName: msg.agentName, dx: msg.dx, dy: msg.dy })
        if (msg.dx !== 0 || msg.dy !== 0) scheduleDriftDecay()
        return
      }
      if (t === 'agentReact' && msg.agentName != null) {
        dispatch({ type: 'agentReact', agentName: msg.agentName })
        return
      }
      if (t === 'userCaption' && typeof msg.text === 'string') {
        // Adds to transcript (for history panel); Room.jsx also reads this for the avatar caption
        dispatch({ type: 'userCaption', text: msg.text })
      }
    }

    const handler = (payload, participant) => {
      if (participant?.sid === room.localParticipant.sid) return
      onData(payload)
    }

    room.on(RoomEvent.DataReceived, handler)
    return () => {
      room.off(RoomEvent.DataReceived, handler)
      if (resetDriftTimer.current) clearTimeout(resetDriftTimer.current)
    }
  }, [room, scheduleDriftDecay])

  const getAgentSlice = useCallback(
    (name) => state.perAgent[name] || initAgentRecord(),
    [state.perAgent],
  )

  // Lets Room.jsx add typed user messages to the transcript immediately
  const addUserEntry = useCallback((text) => {
    if (text) dispatch({ type: 'userCaption', text })
  }, [])

  return {
    topic: state.topic,
    topicPulseKey: state.topicPulseKey,
    transcript: state.transcript,
    getAgentSlice,
    addUserEntry,
  }
}
