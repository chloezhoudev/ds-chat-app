const endpoint = 'https://api.deepseek.com/chat/completions';

const tools = [
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
];

function get_current_time() {
  return new Date().toLocaleString();
}

async function readStream(response, onToken) {
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullReply = '';
  let toolId = '';
  let toolName = '';
  let toolArgs = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const str = decoder.decode(value, { stream: true });
    buffer += str;

    if (buffer.includes('\n\n')) {
      const messages = buffer.split('\n\n');
      buffer = messages[messages.length - 1];

      for (let i = 0; i < messages.length - 1; i++) {
        const message = messages[i];
        const json = message.slice(6);

        if (json === '[DONE]') break;

        const parsed = JSON.parse(json);
        const delta = parsed.choices[0].delta;
        const text = delta.content;

        if (text === null) continue;

        if (!text && delta.tool_calls) {
          const toolCall = delta.tool_calls[0];
          if (toolCall.id) toolId = toolCall.id;
          if (toolCall.function?.name) toolName = toolCall.function.name;
          if (toolCall.function?.arguments) toolArgs += toolCall.function.arguments;
          continue;
        }
        // 模型回复的内容在这里
        fullReply += text;
        onToken(text); // 如果这里只有一条完整的 SSE 消息，就只调用一次 setReply，但如果有多条，就会累积多个 setReply，然后
        // 在 for 循环结束后，再次 await read() 的时候，进行 batch 更新，所以每次 await 的间歇，都会调用一次 setReply 更新页面，
        // 效果就是一个字一个字蹦出来
      }
    }
  }

  return { toolId, toolName, toolArgs, fullReply };
}

async function sendChat(messages, onToken, onClear) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`,
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      model: 'deepseek-v4-flash',
      stream: true,
      tools
    })
  });

  const result = await readStream(response, onToken);

  if (result.toolName) {
    const toolResult = get_current_time();

    const toolMessages = [...messages, {
      role: "assistant",
      content: null,
      tool_calls: [{
        id: result.toolId,
        type: "function",
        function: {
          name: result.toolName,
          arguments: result.toolArgs
        }
      }]
    }, {
      role: "tool",
      tool_call_id: result.toolId,
      content: toolResult
    }];

    const toolResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`,
        'Content-type': 'application/json'
      },
      body: JSON.stringify({
        messages: toolMessages,
        model: 'deepseek-v4-flash',
        stream: true
      })
    });
    // TODO: 工具调用可视化 - 显示"🔧 正在获取当前时间..."提示
    onClear();

    const finalResult = await readStream(toolResponse, onToken);
    return finalResult.fullReply;
  }

  return result.fullReply;
}

export { sendChat };