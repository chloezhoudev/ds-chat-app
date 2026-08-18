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
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "计算数学表达式，比如加减乘除",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "数学表达式，比如 2+3*4"
          }
        },
        required: ["expression"]
      }
    }
  }
];

const toolFunctions = { get_current_time, calculate };

function calculate(args) {
  try {
    return String(eval(args.expression));
  } catch {
    return '计算错误';
  }
}

function get_current_time() {
  return new Date().toLocaleString();
}

async function readStream(response, onToken, onThinking) {
  // === 边界情况汇总 ===
  // 1. delta.content 的三种值：
  //    - null: 思考阶段（reasoning_content 有值）→ 跳过，不拼进 fullReply
  //    - undefined: 工具调用阶段（delta.tool_calls 有值）→ 累积工具信息
  //    - 有值（字符串）: 正常回复 → 拼进 fullReply
  //
  // 2. reasoning_content 第一条是空字符串 ""（falsy），后续才有内容
  //    所以判断思考阶段靠 text === null，不靠 thinking 是否有值
  //
  // 3. data: [DONE] 不是 JSON，不能直接 JSON.parse，要单独判断
  //
  // 4. 一次 read() 可能拿到半条/一条/多条 SSE 消息（TCP 不管 SSE 边界）
  //    用 buffer + split('\n\n') 处理
  //
  // 5. 中文字节可能被切断，TextDecoder 加 { stream: true } 解决
  //
  // 6. fetch 对 401/500 不抛错（正常 resolve），需要手动检查 response.ok
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullReply = '';
  let fullThinking = '';
  const toolCalls = [];

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
        const thinking = delta.reasoning_content;
        // 1. 思考阶段
        if (text === null) {
          if (thinking) {
            fullThinking += thinking;
            onThinking(thinking);
          }
          continue;
        };
        // 2. 工具调用
        if (!text && delta.tool_calls) {
          const toolCall = delta.tool_calls[0];
          const idx = toolCall.index;
          if (toolCalls[idx] === undefined) {
            toolCalls[idx] = {};
            toolCalls[idx].args = '';
          }
          if (toolCall.id) toolCalls[idx].id = toolCall.id;
          if (toolCall.function?.name) toolCalls[idx].name = toolCall.function.name;
          if (toolCall.function?.arguments) toolCalls[idx].args += toolCall.function.arguments;
          continue;
        }
        // 3. 正常回复
        fullReply += text;
        onToken(text); // 如果这里只有一条完整的 SSE 消息，就只调用一次 setReply，但如果有多条，就会累积多个 setReply，然后
        // 在 for 循环结束后，再次 await read() 的时候，进行 batch 更新，所以每次 await 的间歇，都会调用一次 setReply 更新页面，
        // 效果就是一个字一个字蹦出来
      }
    }
  }

  return { toolCalls, fullReply, fullThinking };
}

function fetchChat(messages, includeTools = true) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`,
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      model: 'deepseek-v4-flash',
      stream: true,
      ...(includeTools && { tools })
    })
  });
}

async function sendChat(messages, onToken, onThinking, onClear, onToolCall) {
  // 1. 发请求
  const response = await fetchChat(messages);

  // 2. 读流
  let { toolCalls, fullReply, fullThinking } = await readStream(response, onToken, onThinking);

  // 3. 判断是否需要调用工具
  while (toolCalls.length > 0) {
    onToolCall(toolCalls);

    const toolMessages = [...messages, {
      role: "assistant",
      content: null,
      tool_calls: toolCalls.map(tool => ({
        id: tool.id,
        type: "function",
        function: {
          name: tool.name,
          arguments: tool.args
        }
      }))
    }];

    toolCalls.forEach(tool => {
      const fn = toolFunctions[tool.name];
      const args = JSON.parse(tool.args);
      const toolResult = fn(args);

      const toolMessage = {
        role: "tool",
        tool_call_id: tool.id,
        content: toolResult
      }

      toolMessages.push(toolMessage);
    });

    const toolResponse = await fetchChat(toolMessages);

    await new Promise(resolve => setTimeout(resolve, 3000));
    onClear();

    const result = await readStream(toolResponse, onToken, onThinking);
    fullReply = result.fullReply;
    fullThinking += result.fullThinking;
    toolCalls = result.toolCalls;
    messages = toolMessages;
  }

  return { fullReply, fullThinking };
}

export { sendChat };