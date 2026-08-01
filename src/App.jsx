import { useState, useRef, useEffect } from "react"
import ReactMarkdown from 'react-markdown'
import { sendChat } from './api'

import './App.css'

function App() {
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const handleReply = async () => {
    if (!text.trim()) return;

    try {
      const newMessages = [...messages, { role: 'user', content: text }];
      setLoading(true);
      setMessages(newMessages);
      setText('');
      setReply('');

      const fullReply = await sendChat(newMessages, (text) => {
        setReply(prev => prev + text);
      });

      if (fullReply) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullReply }]);
      }

      setReply('');
      setLoading(false);
    } catch {
      setLoading(false);
      alert('请求失败，请重试');
    }
  }

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, reply])

  return (
    <div className="app">
      <div className="chat-area">
        {messages.map((msg, index) => (
          <div key={index} className={`message message-${msg.role}`}>
            <div className="role-label">{msg.role}</div>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {reply && (
          <div className="message message-assistant">
            <div className="role-label">assistant</div>
            <ReactMarkdown>{reply}</ReactMarkdown>
          </div>
        )}
        {loading && !reply && <div className="loading">思考中...</div>}
        <div ref={chatEndRef}></div>
      </div>
      <div className="input-area">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleReply()} placeholder="输入你的问题..." />
        <button onClick={handleReply} disabled={loading}>发送</button>
      </div>
    </div>
  )
}

export default App