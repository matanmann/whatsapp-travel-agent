import { useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Tell me your trip idea and I will build tasks, itinerary, and decisions with memory.',
      ts: new Date().toISOString(),
    },
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    const userCount = messages.filter((m) => m.role === 'user').length;
    return { turns: messages.length, userCount };
  }, [messages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextUser = { role: 'user', text: trimmed, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, nextUser]);
    setText('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/dev/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed, from: 'whatsapp:+15550000001', profileName: 'Simulator User' }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed request');
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: data.response, ts: new Date().toISOString() }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${error.message}`, ts: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">WhatsApp Travel Planning Assistant</p>
        <h1>Plan trips as a couple with AI memory, tasks, and itineraries.</h1>
        <div className="chips">
          <span>{stats.turns} messages</span>
          <span>{stats.userCount} user turns</span>
          <span>Railway backend compatible</span>
        </div>
      </section>

      <section className="chat">
        <div className="stream">
          {messages.map((m, idx) => (
            <article key={`${m.ts}-${idx}`} className={`bubble ${m.role}`}>
              <header>{m.role === 'assistant' ? 'Agent' : 'You'}</header>
              <p>{m.text}</p>
            </article>
          ))}
        </div>
        <div className="composer">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Example: Plan a 2-week trip to Thailand in November with $5000 budget"
            rows={3}
          />
          <button type="button" onClick={send} disabled={loading}>
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </section>
    </main>
  );
}
