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
  const [thinking, setThinking] = useState(''); // 模型的思考
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
      setReply(''); // TODO: 流中断后重试时半截内容会先消失再重新加载，体验待优化

      const { fullReply, fullThinking } = await sendChat(
        msgs,
        (text) => startTransition(() => setReply(prev => prev + text)),
        (thinking) => setThinking(prev => prev + thinking),
        () => setReply('')
      );

      if (fullReply) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullReply, thinking: fullThinking }]);
      }

      setReply('');
      setThinking('');
      setLoading(false);
    } catch (error) {
      console.error('错误详情:', error);
      setLoading(false);
      setError(error);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, reply]);

  console.log('render:', { loading, thinking: thinking.length, reply: reply.length });

  return (
    <div className="app">
      <div className="chat-area">
        {messages.map((msg, index) => (
          <React.Fragment key={index}>
            {msg.thinking && <div className="loading">{msg.thinking}</div>}
            <div className={`message message-${msg.role}`}>
              <div className="role-label">{msg.role}</div>
              <MemoMarkdown>{msg.content}</MemoMarkdown>
            </div>
          </React.Fragment>
        ))}
        {loading && thinking && <div className="loading">{thinking}</div>}
        {loading && !reply && !thinking && <div className="loading">思考中...</div>}
        {reply && (
          <div className="message message-assistant">
            <div className="role-label">assistant</div>
            <MemoMarkdown>{reply}</MemoMarkdown>
          </div>
        )}
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