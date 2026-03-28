import { useCallback, useRef, useState } from 'react'

const MUTED_COLORS = ['#7A9E87', '#6B7FA3', '#C4A882', '#9E7A8A', '#8A9E7A']

function randomMutedColor() {
  return MUTED_COLORS[Math.floor(Math.random() * MUTED_COLORS.length)]
}

function AgentCard({ agent, onEdit, onDelete, canDelete, isNew }) {
  const [editing, setEditing] = useState(isNew)
  const [name, setName] = useState(agent.name)
  const [disposition, setDisposition] = useState(agent.disposition)
  const nameRef = useRef(null)
  const dispositionRef = useRef(null)
  const cardRef = useRef(null)

  function startEdit() {
    setEditing(true)
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  function commitEdit() {
    setEditing(false)
    onEdit({ ...agent, name, disposition })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit()
  }

  function handleBlur(e) {
    if (
      cardRef.current &&
      !cardRef.current.contains(e.relatedTarget)
    ) {
      commitEdit()
    }
  }

  return (
    <div
      ref={cardRef}
      style={{
        background: '#141414',
        border: '0.5px solid #222',
        borderRadius: 16,
        padding: '24px 20px',
        width: 160,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
      onBlur={handleBlur}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: agent.color,
          flexShrink: 0,
        }}
      />

      {editing ? (
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            marginTop: 12,
            color: '#fff',
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 15,
            fontWeight: 400,
            background: 'transparent',
            border: 'none',
            borderBottom: '0.5px solid #444',
            outline: 'none',
            textAlign: 'center',
            width: '100%',
            padding: '0 0 2px',
          }}
        />
      ) : (
        <p
          style={{
            marginTop: 12,
            color: '#fff',
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 15,
            fontWeight: 400,
            textAlign: 'center',
            margin: '12px 0 0',
          }}
        >
          {name}
        </p>
      )}

      {editing ? (
        <input
          ref={dispositionRef}
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            marginTop: 4,
            color: '#666',
            fontFamily: 'var(--font-sans), system-ui, sans-serif',
            fontSize: 10,
            fontStyle: 'italic',
            background: 'transparent',
            border: 'none',
            borderBottom: '0.5px solid #444',
            outline: 'none',
            textAlign: 'center',
            width: '100%',
            maxWidth: 140,
            padding: '0 0 2px',
          }}
        />
      ) : (
        <p
          style={{
            marginTop: 4,
            color: '#666',
            fontFamily: 'var(--font-sans), system-ui, sans-serif',
            fontSize: 10,
            fontStyle: 'italic',
            textAlign: 'center',
            maxWidth: 140,
            margin: '4px 0 0',
          }}
        >
          {disposition}
        </p>
      )}

      <div
        style={{
          width: '100%',
          height: 0.5,
          background: '#1e1e1e',
          marginTop: 16,
        }}
      />

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={startEdit}
          title="Edit"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#555',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(agent.id)}
            title="Remove"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e05555')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function AddAgentCard({ onAdd }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{
        width: 160,
        minHeight: 180,
        flexShrink: 0,
        background: 'transparent',
        border: '1px dashed #2a2a2a',
        borderRadius: 16,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#444')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  )
}

let _idCounter = 1000

export function PreviewScreen({ topic, config, onRegenerate, onLaunch, launching }) {
  const [agents, setAgents] = useState(() =>
    config.agents.map((a) => ({ ...a, id: _idCounter++ }))
  )
  const [deletingIds, setDeletingIds] = useState(new Set())

  const handleEdit = useCallback((updated) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    )
  }, [])

  const handleDelete = useCallback((id) => {
    setDeletingIds((prev) => new Set([...prev, id]))
    setTimeout(() => {
      setAgents((prev) => prev.filter((a) => a.id !== id))
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 260)
  }, [])

  const handleAdd = useCallback(() => {
    const newAgent = {
      id: _idCounter++,
      name: 'New Agent',
      disposition: '',
      color: randomMutedColor(),
      systemPrompt: '',
      isNew: true,
    }
    setAgents((prev) => [...prev, newAgent])
  }, [])

  const handleLaunch = useCallback(() => {
    const agentsPayload = agents.map(({ id, isNew, ...rest }) => rest)
    onLaunch(topic, agentsPayload)
  }, [agents, topic, onLaunch])

  const canDelete = agents.length > 2

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        backgroundColor: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 800,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <p
          style={{
            color: '#fff',
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 24,
            lineHeight: 1.3,
            maxWidth: 600,
            textAlign: 'center',
            margin: 0,
          }}
        >
          {config.topicFraming}
        </p>

        <p
          style={{
            marginTop: 12,
            color: '#555',
            fontFamily: 'var(--font-sans), system-ui, sans-serif',
            fontSize: 11,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {config.roomMood}
        </p>

        <div style={{ height: 48 }} />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'center',
          }}
        >
          {agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                overflow: 'hidden',
                maxWidth: deletingIds.has(agent.id) ? 0 : 200,
                opacity: deletingIds.has(agent.id) ? 0 : 1,
                transition: 'max-width 0.25s ease, opacity 0.2s ease',
              }}
            >
              <AgentCard
                agent={agent}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canDelete={canDelete}
                isNew={agent.isNew}
              />
            </div>
          ))}
          <AddAgentCard onAdd={handleAdd} />
        </div>

        <div style={{ height: 40 }} />

        <div
          style={{
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={onRegenerate}
            style={{
              background: 'transparent',
              border: '0.5px solid #2a2a2a',
              color: '#fff',
              fontSize: 12,
              padding: '10px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#555')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
          >
            Regenerate
          </button>

          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching}
            style={{
              background: launching ? '#aaa' : '#fff',
              color: '#111',
              fontSize: 12,
              fontWeight: 500,
              padding: '10px 32px',
              borderRadius: 8,
              cursor: launching ? 'not-allowed' : 'pointer',
              border: 'none',
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              transition: 'background 0.15s',
              opacity: launching ? 0.7 : 1,
            }}
          >
            {launching ? 'Launching...' : 'Launch Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
