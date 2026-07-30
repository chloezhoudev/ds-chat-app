import { useState } from "react"

const endpoint = 'https://api.deepseek.com/chat/completions';

function App() {
  const [reply, setReply] = useState(''); // current reply from AI
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInput = (event) => {
    setText(event.target.value);
  }

  const handleReply = async () => {
    const newMessages = [...messages, { role: 'user', content: text }];
    setLoading(true);
    setMessages(newMessages);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`, // api key
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages,
          model: 'deepseek-v4-flash',
          stream: true
        })
      });

      // 一段一段地读取数据
      const reader = response.body.getReader();
      // 将数据转成字符串
      const decoder = new TextDecoder();
      let buffer = '';
      // flag
      let firstToken = true;
      // remove last reply
      setReply('');
      // 
      let fullReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // console.log('a piece of data: ', value); // unit8array
        const str = decoder.decode(value, { stream: true });
        buffer += str;
        if (buffer.includes('\n\n')) {
          const messages = buffer.split('\n\n');
          buffer = messages[messages.length - 1];

          for (let i = 0; i < messages.length - 1; i++) {
            const message = messages[i];
            const json = message.slice(6);
            if (json === '[DONE]') {
              break;
            }
            const content = JSON.parse(json);
            if (content.choices[0].delta.content === null) continue;
            if (firstToken) {
              setLoading(false);
              firstToken = false;
            }
            fullReply += content.choices[0].delta.content;
            setReply(prev => prev + content.choices[0].delta.content);
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fullReply }]);
      setReply('');
  }

  return (
    <>
    <input value={text} onChange={handleInput}/>
    <button onClick={handleReply}>submit</button>
    {loading &&(<div>loading...</div>)}
    <div>{messages.map((msg, index) => (
      <div key={index}>{msg.role}: {msg.content}</div>
    ))}</div>
    {reply && <div>assistant: {reply}</div>}
    </>
  )
}

export default App
