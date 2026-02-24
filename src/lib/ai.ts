/**
 * Central Anthropic API wrapper
 * All AI calls go through call_anthropic() for unified logging and retry handling
 */

import Anthropic from '@anthropic-ai/sdk';
import { log_usage } from '@/lib/db';

export interface CallAnthropicOpts {
  route: string;
  agent_id: string | null;
  model: string;
  max_tokens: number;
  messages: Anthropic.MessageParam[];
  system?: Anthropic.TextBlockParam[] | string;
}

export interface CallAnthropicResult {
  message: Anthropic.Message;
  trace_id: string;
}

const RETRYABLE_STATUSES = [429, 500, 529];
const MAX_RETRIES = 3;

export async function call_anthropic(opts: CallAnthropicOpts): Promise<CallAnthropicResult> {
  const api_key = process.env.ANTHROPIC_API_KEY;
  if (!api_key) throw new Error('ANTHROPIC_API_KEY not configured');

  const trace_id = crypto.randomUUID();
  const client = new Anthropic({ apiKey: api_key });

  let last_error: unknown = null;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await client.messages.create({
        model: opts.model,
        max_tokens: opts.max_tokens,
        messages: opts.messages,
        ...(opts.system ? { system: opts.system } : {}),
      });

      // Log success
      try {
        await log_usage({
          id: trace_id,
          provider_id: message.id,
          agent_id: opts.agent_id,
          route: opts.route,
          model: opts.model,
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          cache_read_input_tokens: message.usage.cache_read_input_tokens ?? null,
          cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? null,
          status: 'success',
          retries,
          error_message: null,
        });
      } catch (log_err) {
        console.error(`[ai] log_usage failed: trace=${trace_id} route=${opts.route} model=${opts.model} in=${message.usage.input_tokens} out=${message.usage.output_tokens}`);
      }

      return { message, trace_id };

    } catch (err) {
      last_error = err;

      // Check if retryable
      const status = (err as { status?: number }).status;
      if (status && RETRYABLE_STATUSES.includes(status) && attempt < MAX_RETRIES) {
        retries++;
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Not retryable or retries exhausted — log failure
      const error_msg = err instanceof Error ? err.message : String(err);
      try {
        await log_usage({
          id: trace_id,
          provider_id: null,
          agent_id: opts.agent_id,
          route: opts.route,
          model: opts.model,
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: null,
          cache_creation_input_tokens: null,
          status: 'failure',
          retries,
          error_message: error_msg.slice(0, 500),
        });
      } catch (log_err) {
        console.error(`[ai] log_usage failed on error path: trace=${trace_id} route=${opts.route} error=${error_msg.slice(0, 200)}`);
      }

      throw last_error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw last_error;
}
