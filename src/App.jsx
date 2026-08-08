import { useState, useRef, useEffect, useTransition } from "react"

import InputBar from "./InputBar"
import MemoMarkdown from "./MemoMarkdown"

import './App.css'
import { sendChat } from './api'
import MessageList from "./MessageList"


function App() {
  const [reply, setReply] = useState(''); // 模型当前正在回复的流
  const [thinking, setThinking] = useState(''); // 模型的思考
  const [messages, setMessages] = useState([]); // 全部对话
  const [loading, setLoading] = useState(false); // 一次完整对话过程
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);
  const [, startTransition] = useTransition();

  const handleReply = async (text) => {
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
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

  // console.log('render:', { loading, thinking: thinking.length, reply: reply.length });

  return (
    <div className="app">
      <div className="chat-area">
        <MessageList messages={messages} />
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
      <InputBar loading={loading} onSubmit={(text) => handleReply(text)} />
    </div>
  )
}

export default App