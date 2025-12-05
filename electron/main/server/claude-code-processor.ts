/**
 * 302.AI Claude Code SSE Response Processor
 *
 * This processor transforms 302.AI Claude Code's SSE format to OpenAI-compatible format.
 *
 * Input format (302.AI Claude Code):
 * - {"type":"alias_info","session_alias":"..."} - Skip
 * - {"type":"system","subtype":"init",...} - Skip
 * - {"type":"stream_event","event":{"type":"message_start",...}} - Extract inner event
 * - {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}} - Convert to OpenAI delta
 * - {"type":"stream_event","event":{"type":"content_block_start","content_block":{"type":"tool_use",...}}} - Convert to tool_calls
 *
 * Output format (OpenAI-compatible):
 * - {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"content":"..."}}]}
 * - {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"tool_calls":[...]}}]}
 */

interface ClaudeCodeEvent {
	type: string;
	subtype?: string;
	session_alias?: string;
	event?: AnthropicEvent;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
}

interface AnthropicEvent {
	type: string;
	index?: number;
	message?: {
		id: string;
		role: string;
		model: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};
	content_block?: {
		type: string;
		text?: string;
		id?: string;
		name?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		input?: any;
	};
	delta?: {
		type: string;
		text?: string;
		partial_json?: string;
		stop_reason?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
}

interface OpenAIStreamChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: {
			role?: string;
			content?: string;
			tool_calls?: Array<{
				index: number;
				id?: string;
				type?: string;
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
		finish_reason?: string | null;
	}>;
}

class ClaudeCodeProcessor {
	private messageId: string = "";
	private model: string = "";
	private buffer: string = "";
	private toolCallIndexMap: Map<number, number> = new Map(); // Maps content_block index to tool_call index
	private currentToolCallIndex: number = 0;

	constructor() {
		this.messageId = `chatcmpl-${Date.now()}`;
	}

	processSSEChunk(chunk: string): string {
		this.buffer += chunk;

		// SSE events are separated by double newlines
		const events = this.buffer.split("\n\n");
		const processedEvents: string[] = [];

		// Keep the last potentially incomplete event in the buffer
		this.buffer = events.pop() ?? "";

		for (const event of events) {
			const lines = event.split("\n");
			for (const line of lines) {
				const processed = this.processLine(line);
				if (processed) {
					// Each processed event needs to be followed by double newline for SSE
					processedEvents.push(processed);
				}
			}
		}

		// SSE format: each event ends with \n\n
		return processedEvents.length > 0 ? processedEvents.join("\n\n") + "\n\n" : "";
	}

	private processLine(line: string): string | null {
		// Skip empty lines
		if (!line.trim()) {
			return line;
		}

		// Skip event: lines (SSE event type markers)
		if (line.startsWith("event:")) {
			return null;
		}

		// Handle data: lines
		if (!line.startsWith("data: ")) {
			return line;
		}

		const jsonStr = line.substring(6).trim();

		// Handle [DONE] marker
		if (jsonStr === "[DONE]") {
			return "data: [DONE]";
		}

		try {
			const data = JSON.parse(jsonStr) as ClaudeCodeEvent;
			return this.transformEvent(data);
		} catch {
			// If JSON parsing fails, pass through as-is
			return line;
		}
	}

	private transformEvent(data: ClaudeCodeEvent): string | null {
		// Skip 302.AI Claude Code specific metadata events
		if (data.type === "alias_info" || data.type === "system") {
			return null;
		}

		// Handle stream_event wrapper
		if (data.type === "stream_event" && data.event) {
			return this.transformAnthropicEvent(data.event);
		}

		// Pass through unknown events as comments (for debugging)
		return null;
	}

	private transformAnthropicEvent(event: AnthropicEvent): string | null {
		switch (event.type) {
			case "message_start":
				return this.handleMessageStart(event);
			case "content_block_start":
				return this.handleContentBlockStart(event);
			case "content_block_delta":
				return this.handleContentBlockDelta(event);
			case "content_block_stop":
				// No direct equivalent in OpenAI format, skip
				return null;
			case "message_delta":
				return this.handleMessageDelta(event);
			case "message_stop":
				return "data: [DONE]";
			case "ping":
				// Skip ping events
				return null;
			default:
				// Skip unknown events
				return null;
		}
	}

	private handleMessageStart(event: AnthropicEvent): string | null {
		if (event.message) {
			this.messageId = event.message.id || this.messageId;
			this.model = event.message.model || this.model;

			// Send initial role delta
			const chunk = this.createOpenAIChunk({
				role: "assistant",
			});
			return `data: ${JSON.stringify(chunk)}`;
		}
		return null;
	}

	private handleContentBlockStart(event: AnthropicEvent): string | null {
		const contentBlock = event.content_block;
		if (!contentBlock) return null;

		if (contentBlock.type === "text") {
			// Text block start - no content yet
			if (contentBlock.text) {
				const chunk = this.createOpenAIChunk({
					content: contentBlock.text,
				});
				return `data: ${JSON.stringify(chunk)}`;
			}
			return null;
		}

		if (contentBlock.type === "tool_use") {
			// Tool use block start
			const toolCallIndex = this.currentToolCallIndex++;
			if (event.index !== undefined) {
				this.toolCallIndexMap.set(event.index, toolCallIndex);
			}

			const chunk = this.createOpenAIChunk({
				tool_calls: [
					{
						index: toolCallIndex,
						id: contentBlock.id || `call_${Date.now()}`,
						type: "function",
						function: {
							name: contentBlock.name || "",
							arguments: "",
						},
					},
				],
			});
			return `data: ${JSON.stringify(chunk)}`;
		}

		return null;
	}

	private handleContentBlockDelta(event: AnthropicEvent): string | null {
		const delta = event.delta;
		if (!delta) return null;

		if (delta.type === "text_delta" && delta.text) {
			const chunk = this.createOpenAIChunk({
				content: delta.text,
			});
			return `data: ${JSON.stringify(chunk)}`;
		}

		if (delta.type === "input_json_delta" && delta.partial_json) {
			const toolCallIndex = this.toolCallIndexMap.get(event.index ?? 0) ?? 0;
			const chunk = this.createOpenAIChunk({
				tool_calls: [
					{
						index: toolCallIndex,
						function: {
							arguments: delta.partial_json,
						},
					},
				],
			});
			return `data: ${JSON.stringify(chunk)}`;
		}

		return null;
	}

	private handleMessageDelta(event: AnthropicEvent): string | null {
		const delta = event.delta;
		if (!delta) return null;

		let finishReason: string | null = null;
		if (delta.stop_reason) {
			// Map Anthropic stop_reason to OpenAI finish_reason
			switch (delta.stop_reason) {
				case "end_turn":
					finishReason = "stop";
					break;
				case "tool_use":
					finishReason = "tool_calls";
					break;
				case "max_tokens":
					finishReason = "length";
					break;
				case "stop_sequence":
					finishReason = "stop";
					break;
				default:
					finishReason = delta.stop_reason;
			}
		}

		if (finishReason) {
			const chunk = this.createOpenAIChunk({}, finishReason);
			return `data: ${JSON.stringify(chunk)}`;
		}

		return null;
	}

	private createOpenAIChunk(
		delta: OpenAIStreamChunk["choices"][0]["delta"],
		finishReason: string | null = null,
	): OpenAIStreamChunk {
		return {
			id: this.messageId,
			object: "chat.completion.chunk",
			created: Math.floor(Date.now() / 1000),
			model: this.model,
			choices: [
				{
					index: 0,
					delta,
					finish_reason: finishReason,
				},
			],
		};
	}

	flushBuffer(): string {
		if (this.buffer.trim() === "") return "";

		const finalLine = this.processLine(this.buffer);
		this.buffer = "";
		return finalLine ? `${finalLine}\n\n` : "";
	}
}

/**
 * Creates a custom fetch function that transforms 302.AI Claude Code SSE responses
 * to OpenAI-compatible format.
 */
export function createClaudeCodeFetch(): typeof fetch {
	return async (url, options) => {
		const response = await fetch(url, options);
		const processor = new ClaudeCodeProcessor();
		return interceptSSEResponse(response, processor);
	};
}

function interceptSSEResponse(response: Response, processor: ClaudeCodeProcessor): Response {
	const contentType = response.headers.get("content-type");

	console.log("[ClaudeCodeProcessor] Content-Type:", contentType);
	console.log("[ClaudeCodeProcessor] Response status:", response.status);

	if (!contentType?.includes("text/event-stream")) {
		console.log("[ClaudeCodeProcessor] Not an SSE response, passing through");
		return response;
	}

	const originalStream = response.body;
	if (!originalStream) {
		console.log("[ClaudeCodeProcessor] No response body");
		return response;
	}

	const reader = originalStream.getReader();
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();

	const transformedStream = new ReadableStream({
		async start(controller) {
			console.log("[ClaudeCodeProcessor] Stream started");
			try {
				while (true) {
					const { done, value } = await reader.read();

					if (done) {
						console.log("[ClaudeCodeProcessor] Stream done");
						const finalChunk = processor.flushBuffer();
						if (finalChunk) {
							controller.enqueue(encoder.encode(finalChunk));
						}
						controller.close();
						break;
					}

					const chunk = decoder.decode(value, { stream: true });
					console.log("[ClaudeCodeProcessor] Raw chunk:", chunk.substring(0, 300));

					const processedChunk = processor.processSSEChunk(chunk);

					if (processedChunk) {
						console.log("[ClaudeCodeProcessor] Processed:", processedChunk.substring(0, 300));
						controller.enqueue(encoder.encode(processedChunk));
					}
				}
			} catch (error) {
				console.error("[ClaudeCodeProcessor] Error processing chunk:", error);
				controller.error(error);
			}
		},
	});

	return new Response(transformedStream, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}

export { ClaudeCodeProcessor };
