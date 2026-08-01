import React, { useState, useRef, useEffect, useTransition } from "react"
import ReactMarkdown from 'react-markdown'
import { sendChat } from './api'

import './App.css'

// React.memo: 
// 场景1 - 只打字时，messages 和 reply 都不变，SlowMarkdown 全部跳过
// 场景2 - 流式输出时，messages 不变也跳过，只有 reply 每次变化会重渲染
// 剩余问题：场景2 中 setReply 频繁触发 reply 的 SlowMarkdown 重渲染 → 用 useTransition 解决
const MemoMarkdown = React.memo(function MemoMarkdown({ children }) {
  return <ReactMarkdown>{children}</ReactMarkdown>;
});

function App() {
  const [reply, setReply] = useState(''); // 模型当前正在回复的流
  const [messages, setMessages] = useState([]); // 全部对话
  const [text, setText] = useState(''); // user input
  const [loading, setLoading] = useState(false); // 一次完整对话过程
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);
  const [, startTransition] = useTransition();

  const handleReply = async () => {
    if (!text.trim()) return;
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setText('');
    await sendAndProcess(newMessages);
  };

  const sendAndProcess = async (msgs) => {
    try {
      setLoading(true);
      setError(null);
      setReply('');

      const fullReply = await sendChat(
        msgs,
        (text) => startTransition(() => setReply(prev => prev + text)),
        () => setReply('')
      );

      if (fullReply) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullReply }]);
      }

      setReply('');
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setError(error);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, reply])

  return (
    <div className="app">
      <div className="chat-area">
        {messages.map((msg, index) => (
          <div key={index} className={`message message-${msg.role}`}>
            <div className="role-label">{msg.role}</div>
            <MemoMarkdown>{msg.content}</MemoMarkdown>
          </div>
        ))}
        {reply && (
          <div className="message message-assistant">
            <div className="role-label">assistant</div>
            <MemoMarkdown>{reply}</MemoMarkdown>
          </div>
        )}
        {loading && !reply && <div className="loading">思考中...</div>}
        {error && (
          <div className="message message-error">
            <div className="role-label">错误</div>
            <div>请求失败，请重试</div>
            <button onClick={() => sendAndProcess(messages)}>重试</button>
          </div>
        )}
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