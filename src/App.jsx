import { useState, useRef, useEffect } from "react"
import ReactMarkdown from 'react-markdown'
import { sendChat } from './api'

import './App.css'

function App() {
  const [reply, setReply] = useState(''); // 模型当前正在回复的流
  const [messages, setMessages] = useState([]); // 全部对话
  const [text, setText] = useState(''); // user input
  const [loading, setLoading] = useState(false); // 一次完整对话过程
  const chatEndRef = useRef(null);

  const handleReply = async () => {
    if (!text.trim()) return; // 如果只输入空格或者没有任何输入，退出

    try { // try catch 放在最外层
      const newMessages = [...messages, { role: 'user', content: text }];
      setLoading(true);
      setMessages(newMessages);
      setText(''); // 清空 input 框
      setReply(''); // 第二次进来，上一轮对话已经清空了，所以还是空字符串

      const fullReply = await sendChat(
        newMessages,
        (text) => setReply(prev => prev + text),
        () => setReply('')
      );

      if (fullReply) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullReply }]);
      }

      setReply(''); // 内容已经转移到 messages 里了
      setLoading(false); // 一次完整对话结束的 flag
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