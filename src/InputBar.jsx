import { useState } from "react"

function InputBar({ loading, onSubmit }) {
  const [text, setText] = useState(''); // user input

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text);
    setText('');
  }

  return (
    <div className="input-area">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="输入你的问题..."
      />
      <button onClick={handleSubmit} disabled={loading}>发送</button>
    </div>
  )
}

export default InputBar