/**
 * Claude Code Virtual Tools
 *
 * These are virtual tool definitions for 302.AI Claude Code.
 * The actual execution happens in the remote sandbox, not locally.
 * We define these tools so the SDK recognizes them and doesn't error.
 */

import { tool } from "ai";
import { z } from "zod";

/**
 * Creates virtual tools for Claude Code that return a placeholder response.
 * The actual tool execution happens remotely in 302.AI's sandbox.
 */
export function createClaudeCodeTools() {
	return {
		// Task tool - launches agents for complex tasks
		Task: tool({
			description: "Launch a new agent to handle complex, multi-step tasks autonomously",
			inputSchema: z.object({
				description: z.string().describe("A short description of the task"),
				prompt: z.string().describe("The task for the agent to perform"),
				subagent_type: z.string().describe("The type of specialized agent to use"),
				model: z.string().optional().describe("Optional model to use"),
				resume: z.string().optional().describe("Optional agent ID to resume from"),
			}),
		}),

		// Bash tool - executes shell commands
		Bash: tool({
			description: "Executes a bash command in a persistent shell session",
			inputSchema: z.object({
				command: z.string().describe("The command to execute"),
				description: z.string().optional().describe("Description of what this command does"),
				timeout: z.number().optional().describe("Optional timeout in milliseconds"),
				run_in_background: z.boolean().optional().describe("Run command in background"),
			}),
		}),

		// Glob tool - file pattern matching
		Glob: tool({
			description: "Fast file pattern matching tool",
			inputSchema: z.object({
				pattern: z.string().describe("The glob pattern to match files against"),
				path: z.string().optional().describe("The directory to search in"),
			}),
		}),

		// Grep tool - content search
		Grep: tool({
			description: "Search tool built on ripgrep",
			inputSchema: z.object({
				pattern: z.string().describe("The regex pattern to search for"),
				path: z.string().optional().describe("File or directory to search in"),
				glob: z.string().optional().describe("Glob pattern to filter files"),
				type: z.string().optional().describe("File type to search"),
				output_mode: z.enum(["content", "files_with_matches", "count"]).optional(),
			}),
		}),

		// Read tool - reads files
		Read: tool({
			description: "Reads a file from the filesystem",
			inputSchema: z.object({
				file_path: z.string().describe("The absolute path to the file to read"),
				offset: z.number().optional().describe("Line number to start reading from"),
				limit: z.number().optional().describe("Number of lines to read"),
			}),
		}),

		// Edit tool - edits files
		Edit: tool({
			description: "Performs exact string replacements in files",
			inputSchema: z.object({
				file_path: z.string().describe("The absolute path to the file to modify"),
				old_string: z.string().describe("The text to replace"),
				new_string: z.string().describe("The text to replace it with"),
				replace_all: z.boolean().optional().describe("Replace all occurrences"),
			}),
		}),

		// Write tool - writes files
		Write: tool({
			description: "Writes a file to the filesystem",
			inputSchema: z.object({
				file_path: z.string().describe("The absolute path to the file to write"),
				content: z.string().describe("The content to write to the file"),
			}),
		}),

		// NotebookEdit tool - edits Jupyter notebooks
		NotebookEdit: tool({
			description: "Replaces contents of a cell in a Jupyter notebook",
			inputSchema: z.object({
				notebook_path: z.string().describe("The absolute path to the notebook file"),
				new_source: z.string().describe("The new source for the cell"),
				cell_id: z.string().optional().describe("The ID of the cell to edit"),
				cell_type: z.enum(["code", "markdown"]).optional().describe("The type of the cell"),
				edit_mode: z.enum(["replace", "insert", "delete"]).optional(),
			}),
		}),

		// WebFetch tool - fetches web content
		WebFetch: tool({
			description: "Fetches content from a URL and processes it",
			inputSchema: z.object({
				url: z.string().describe("The URL to fetch content from"),
				prompt: z.string().describe("The prompt to run on the fetched content"),
			}),
		}),

		// TodoWrite tool - manages task lists
		TodoWrite: tool({
			description: "Creates and manages a structured task list",
			inputSchema: z.object({
				todos: z.array(
					z.object({
						content: z.string().describe("The task content"),
						status: z.enum(["pending", "in_progress", "completed"]),
						activeForm: z.string().describe("The active form of the task"),
					}),
				),
			}),
		}),

		// WebSearch tool - searches the web
		WebSearch: tool({
			description: "Searches the web for information",
			inputSchema: z.object({
				query: z.string().describe("The search query to use"),
				allowed_domains: z.array(z.string()).optional(),
				blocked_domains: z.array(z.string()).optional(),
			}),
		}),

		// BashOutput tool - retrieves background shell output
		BashOutput: tool({
			description: "Retrieves output from a background bash shell",
			inputSchema: z.object({
				bash_id: z.string().describe("The ID of the background shell"),
				filter: z.string().optional().describe("Regex to filter output"),
			}),
		}),

		// KillShell tool - kills a background shell
		KillShell: tool({
			description: "Kills a running background bash shell",
			inputSchema: z.object({
				shell_id: z.string().describe("The ID of the shell to kill"),
			}),
		}),

		// Skill tool - executes skills
		Skill: tool({
			description: "Execute a skill within the conversation",
			inputSchema: z.object({
				skill: z.string().describe("The skill name to execute"),
			}),
		}),

		// SlashCommand tool - executes slash commands
		SlashCommand: tool({
			description: "Execute a slash command within the conversation",
			inputSchema: z.object({
				command: z.string().describe("The slash command to execute"),
			}),
		}),

		// ExitPlanMode tool - exits planning mode
		ExitPlanMode: tool({
			description: "Exit plan mode after finishing writing a plan",
			inputSchema: z.object({}),
		}),

		// EnterPlanMode tool - enters planning mode
		EnterPlanMode: tool({
			description: "Enter plan mode for complex tasks requiring planning",
			inputSchema: z.object({}),
		}),

		// AskUserQuestion tool - asks user questions
		AskUserQuestion: tool({
			description: "Ask the user questions during execution",
			inputSchema: z.object({
				questions: z.array(
					z.object({
						question: z.string().describe("The question to ask"),
						header: z.string().describe("Short label for the question"),
						options: z.array(
							z.object({
								label: z.string().describe("The option label"),
								description: z.string().describe("The option description"),
							}),
						),
						multiSelect: z.boolean().describe("Allow multiple selections"),
					}),
				),
			}),
		}),

		// ListMcpResourcesTool - lists MCP resources
		ListMcpResourcesTool: tool({
			description: "List available resources from configured MCP servers",
			inputSchema: z.object({
				server: z.string().optional().describe("Specific server to get resources from"),
			}),
		}),

		// ReadMcpResourceTool - reads MCP resources
		ReadMcpResourceTool: tool({
			description: "Reads a specific resource from an MCP server",
			inputSchema: z.object({
				server: z.string().describe("The MCP server name"),
				uri: z.string().describe("The resource URI to read"),
			}),
		}),
	};
}
