// Produce tool calls for the Computer Use MCP session owned by the skill host.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const usage = 'node desktop.mjs observe | fill --task ID --job ID | finish --task ID [--cancel]';
try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { task: { type: 'string' }, job: { type: 'string' }, cancel: { type: 'boolean' } },
  });
  if (positionals.length !== 1) throw Error(usage);
  const [step] = positionals;
  let call;
  if (step === 'observe' && !values.task && !values.job && !values.cancel) {
    call = { tool: 'start_task', args: { goal: 'Read the visible job and preview its application' } };
  } else if (step === 'observe' && values.task && !values.job && !values.cancel) {
    call = { tool: 'screenshot', args: { task_id: values.task, include_image: true } };
  } else if (step === 'fill' && values.task && values.job && !values.cancel) {
    const preview = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
    const rows = preview.jobs.filter(row => row.id === values.job && row.status === 'draft');
    if (preview.mode !== 'dry-run' || rows.length !== 1 || !rows[0].greeting?.trim()) {
      throw Error('需要该岗位唯一的 draft 草稿');
    }
    const greeting = rows[0].greeting;
    const directory = join(tmpdir(), 'boss-job-assistant-drafts');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const digest = createHash('sha256').update(greeting).digest('hex');
    const path = join(directory, digest + '.txt');
    writeFileSync(path, '\uFEFF' + greeting, { encoding: 'utf8', mode: 0o600 });
    call = { tool: 'batch', args: { task_id: values.task, stop_on_error: true, actions: [
      { tool: 'key_combo', args: { keys: ['ctrl', 't'] } },
      { tool: 'sleep', args: { seconds: 1 } },
      { tool: 'key_combo', args: { keys: ['ctrl', 'l'] } },
      { tool: 'type', args: { text: pathToFileURL(path).href } },
      { tool: 'press_key', args: { key: 'enter' } },
    ] } };
  } else if (step === 'finish' && values.task && !values.job) {
    call = { tool: 'finish_task', args: { task_id: values.task, cancel: Boolean(values.cancel) } };
  } else {
    throw Error(usage);
  }
  console.log(JSON.stringify(call));
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
