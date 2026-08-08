import React from 'react'
import ReactMarkdown from 'react-markdown'
// React.memo:
// 场景1 - 只打字时，messages 和 reply 都不变，SlowMarkdown 全部跳过
// 场景2 - 流式输出时，messages 不变也跳过，只有 reply 每次变化会重渲染
// 剩余问题：场景2 中 setReply 频繁触发 reply 的 SlowMarkdown 重渲染 → 用 useTransition 解决
const MemoMarkdown = React.memo(function MemoMarkdown({ children }) {
  return <ReactMarkdown>{children}</ReactMarkdown>;
});

export default MemoMarkdown