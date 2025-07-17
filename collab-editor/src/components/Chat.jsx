import React, { useEffect, useState } from 'react';

export default function Chat({ socket, roomId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    // Load existing chat history when joining the room
    socket.on('loadChatHistory', (history) => {
      setMessages(history);
    });

    socket.on('newChatMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off('loadChatHistory');
      socket.off('newChatMessage');
    };
  }, [socket]);

  const sendMessage = () => {
    if (input.trim() === '') return;
    socket.emit('chatMessage', { roomId, message: input });
    setInput('');
  };

  return (
    <div style={{
      width: '100%',
      height: '90vh',
      borderLeft: '2px solid #ccc',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem',
        background: '#222',
        color: '#eee',
        fontFamily: 'monospace',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: '0.5rem' }}>
            <strong>{m.username}</strong> <small style={{ color: '#888' }}>{new Date(m.timestamp).toLocaleTimeString()}</small><br />
            <span>{m.message}</span>
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex',
        borderTop: '1px solid #555',
      }}>
        <input
          style={{ flex: 1, padding: '0.5rem', border: 'none' }}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
        />
        <button
          onClick={sendMessage}
          style={{ padding: '0.5rem 1rem', background: '#555', color: '#fff', border: 'none' }}
        >Send</button>
      </div>
    </div>
  );
}
