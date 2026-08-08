import React from "react"

import MemoMarkdown from "./MemoMarkdown"

function MessageList({ messages }) {
  return (
    <React.Fragment>
      {messages.map((msg, index) => (
        <React.Fragment key={index}>
          {msg.thinking && <div className="loading">{msg.thinking}</div>}
          <div className={`message message-${msg.role}`}>
            <div className="role-label">{msg.role}</div>
            <MemoMarkdown>{msg.content}</MemoMarkdown>
          </div>
        </React.Fragment>
      ))}
    </React.Fragment>
  )
}

export default MessageList