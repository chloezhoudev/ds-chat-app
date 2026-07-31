import { useState, useRef, useEffect } from "react"
import ReactMarkdown from 'react-markdown'

import './App.css'

const endpoint = 'https://api.deepseek.com/chat/completions';

const get_current_time = () => {
  return new Date().toLocaleString();
}

function App() {
  const [reply, setReply] = useState(''); // current reply from AI
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const handleInput = (event) => {
    setText(event.target.value);
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleReply();
    }
  }

  const handleReply = async () => {
    if (!text.trim()) return;

    try {
      const newMessages = [...messages, { role: 'user', content: text }];
      setLoading(true);
      setMessages(newMessages);
      setText('');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`, // api key
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages,
          model: 'deepseek-v4-flash',
          stream: true,
          tools: [
          {
            type: "function",
            function: {
              name: "get_current_time",
              description: "获取当前的日期和时间",
              parameters: {
                type: "object",
                properties: {},
                required: []
              }
            }
          }
        ]
        })
      });

      const { toolId, toolName, toolArgs, fullReply } = await readStream(response, (text) => {
        setReply(prev => prev + text);
      });

      //判断工具调用
      if (toolName) {
        const result = get_current_time();
        const toolMessages = [...newMessages, {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: toolId,
                type: "function",
                function: {
                  name: toolName,
                  arguments: toolArgs
                }
              }
            ]
          },
          {
            role: "tool",
            tool_call_id: toolId,
            content: result  // 工具执行的结果
          }
        ];

        const toolResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`, // api key
            'Content-type': 'application/json'
          },
          body: JSON.stringify({
            messages: toolMessages,
            model: 'deepseek-v4-flash',
            stream: true
          })
        });

        const { fullReply } = await readStream(toolResponse, (text) => {
          setReply(prev => prev + text);
        });

        if (fullReply) {
          setMessages(prev => [...prev, { role: 'assistant', content: fullReply }]);
        }

        
      } else { // no tool use
        if (fullReply) {
          setMessages(prev => [...prev, { role: 'assistant', content: fullReply }]);
        }
      }


      setReply('');
      setLoading(false);
    } catch { // error
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
      <input value={text} onChange={handleInput} onKeyDown={handleKeyDown} placeholder="输入你的问题..." />
      <button onClick={handleReply} disabled={loading}>发送</button>
    </div>
  </div>
)
}

export default App

async function readStream(response, onToken) {
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  // 读流的工具
  const reader = response.body.getReader();
  // 将数据转成字符串的工具
  const decoder = new TextDecoder();
  // 变量
  let buffer = '';
  // 拼接模型的回复
  let fullReply = '';
  // 拼接工具参数
  let toolId = '';
  let toolName = '';
  let toolArgs = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const str = decoder.decode(value, { stream: true }); // value is unit8array
    buffer += str;

    if (buffer.includes('\n\n')) {
      const messages = buffer.split('\n\n');
      buffer = messages[messages.length - 1];
      // delta.content 是 null → 思考阶段 → 跳过
      // delta.tool_calls 存在 → 工具调用 → 需要处理
      // delta.content 有值 → 正常回复 → 拼进 fullReply
      for (let i = 0; i < messages.length - 1; i++) {
        const message = messages[i]; // 完整的 message
        const json = message.slice(6); // 把 data: 去掉取中间的json

        if (json === '[DONE]') {
          break;
        }

        const parsed = JSON.parse(json);
        const delta = parsed.choices[0].delta;
        const text = delta.content; // 模型回复
        // 1. 思考阶段 → 跳过
        if (text === null) continue; // 思考过程是 null，tool calls 是 undefined
        // 2. 工具调用 → 需要处理
        if (!text && delta.tool_calls) {
          const toolCall = delta.tool_calls[0];
          if (toolCall.id) toolId = toolCall.id;
          if (toolCall.function?.name) toolName = toolCall.function.name;
          if (toolCall.function?.arguments) toolArgs += toolCall.function.arguments;
          continue; // 这里先写 continue，累积所有tool_calls消息
        }
        // 3. 正常回复 → 拼进 fullReply
        fullReply += text;
        onToken(text); // 函数：我拿到了一段新文字，所以调用 onToken(text) 就行。
      }
    }
  }

  return { toolId, toolName, toolArgs, fullReply };
}
