import { appendFileSync } from "node:fs"

// Solo registra errores, para diagnosticar si el plugin cae al resumen de fábrica.
const log = (m: string) => appendFileSync("/tmp/claude-compaction.log", `${new Date().toISOString()} ${m}\n`)

// Reemplaza el resumen de compactación de OpenCode por uno al estilo Claude Code.
// Si algo falla, no toca el evento y OpenCode usa su resumen de fábrica.

const PROMPT = `Your task is to create a detailed summary of this conversation so far. It will REPLACE the older part of the conversation: the agent that continues will see only your summary plus the most recent messages, and must be able to keep working as if nothing was lost — same task, same decisions, same next step — without asking the user to repeat anything.

Do NOT call any tools. Reply with the summary as plain text only.

Before writing, review the whole conversation chronologically. If an earlier summary of this conversation appears in it, merge it into yours: keep every fact from it that is still true, and update what changed.

Write the summary with EXACTLY these sections, in this order. Be specific and dense; prefer concrete facts over prose. Never invent anything that is not in the conversation.

## 1. Primary request and intent
Every explicit request the user made, in order, including later corrections and changes of mind. Quote the most recent request VERBATIM in the user's original language.

## 2. Key technical context
Projects, folders (absolute paths), stack, frameworks, services, ports, environments, commands and conventions involved.

## 3. Decisions
Each decision with its reason ("X — because Y"), including options the user rejected. Mark the ones the user decided explicitly.

## 4. Files and code
Every file read, created or modified, with its full path, what changed and why. Include short snippets for the important changes (signatures, config blocks, key lines), not whole files.

## 5. Errors and fixes
Each error or problem found, how it was fixed, and any user feedback about it. Include exact error messages when short.

## 6. Verified state
What was actually run and checked (tests, builds, commands) and the real result. Separate what is verified from what is assumed or not yet tested.

## 7. All user messages
Every user message that is not a tool result, in order, VERBATIM or nearly verbatim (shorten only very long ones, keeping their key sentences). This preserves the user's exact wording and feedback.

## 8. Pending tasks
Everything the user asked for that is not finished, and anything promised but not done.

## 9. Current work
What was being done right before this summary, in detail: the file, the command, the step inside the task. Quote the last assistant message's key sentences VERBATIM.

## 10. Next step
The single next action that follows directly from the current work and the user's latest request. If the task was finished or the next step is unclear, say so and do NOT invent new work. Include a verbatim quote that shows where the work stopped.

Rules:
- Keep user quotes in their original language; write everything else in English.
- Keep identifiers, paths, commands, IDs and error messages exactly as written.
- Never include secrets, tokens or passwords, even if they appeared in the conversation.
- Do not mention this summary process. No greeting and no closing line.`

export default {
  id: "claude-compaction",
  setup: async (ctx: any) => {
    await ctx.session.hook("compaction", async (event: any) => {
      try {
        const { text } = await ctx.session.generate({ sessionID: event.sessionID, prompt: PROMPT })
        const summary = text?.trim()
        // Solo se acepta un resumen con las secciones esperadas; si no, sigue el de fábrica.
        if (summary && summary.includes("## 1. Primary request") && summary.includes("## 10. Next step")) {
          event.result = { summary }
        }
      } catch (e) {
        log(`error ${e instanceof Error ? e.message : String(e)}`)
        // Sin resultado: OpenCode genera su resumen de fábrica.
      }
    })
  },
}
