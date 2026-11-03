import { prisma, StageName, StageStatus, EventLevel } from '@social-engine/db';
import { RunContext, StageLogger } from '../types/index.js';
import { sendTelegramAlert } from '../utils/alert.js';
import { redactSensitive, redactObject } from '../utils/redact.js';

export interface StageExecutionOptions<TInput, TOutput> {
  runId: string;
  stageName: StageName;
  attempt?: number;
  itemsIn?: number;
  payloadInput?: unknown;
  execute: (context: RunContext, input: TInput) => Promise<TOutput>;
}

export interface StageExecutionResult<TOutput> {
  success: boolean;
  stageId: string;
  data?: TOutput;
  itemsOut: number;
  error?: Error;
}

export function createStageLogger(runId: string, stageId?: string): StageLogger {
  const logEvent = async (level: EventLevel, message: string, metadata?: Record<string, unknown>) => {
    const cleanMsg = redactSensitive(message);
    const cleanMeta = metadata ? redactObject(metadata) : undefined;
    console.log(`[${level}] [Run: ${runId}] ${cleanMsg}`);

    try {
      await prisma.event.create({
        data: {
          runId,
          stageId: stageId || null,
          level,
          message: cleanMsg,
          metadata: cleanMeta as any,
        },
      });
    } catch (err) {
      console.error('[StageLogger] Failed to write event to DB:', err);
    }
  };

  return {
    info: (msg, meta) => logEvent(EventLevel.INFO, msg, meta),
    warn: (msg, meta) => logEvent(EventLevel.WARN, msg, meta),
    error: (msg, meta) => logEvent(EventLevel.ERROR, msg, meta),
    debug: (msg, meta) => logEvent(EventLevel.DEBUG, msg, meta),
  };
}

export class StageRunner {
  static async execute<TInput, TOutput>(
    options: StageExecutionOptions<TInput, TOutput>,
    input: TInput,
    baseContext: { slot: string; niche: string; triggerSource: string }
  ): Promise<StageExecutionResult<TOutput>> {
    const { runId, stageName, attempt = 1, itemsIn = 0, payloadInput, execute } = options;

    // 1. Initialize Stage row in Database
    const stage = await prisma.stage.create({
      data: {
        runId,
        name: stageName,
        status: StageStatus.RUNNING,
        attempt,
        itemsIn,
        payload: payloadInput ? (redactObject(payloadInput) as any) : undefined,
        startedAt: new Date(),
      },
    });

    const logger = createStageLogger(runId, stage.id);
    const context: RunContext = {
      runId,
      slot: baseContext.slot,
      niche: baseContext.niche,
      triggerSource: baseContext.triggerSource,
      logger,
    };

    await logger.info(`Starting stage ${stageName} (Attempt: ${attempt}, Items in: ${itemsIn})`);

    try {
      const output = await execute(context, input);

      let itemsOut = 0;
      if (Array.isArray(output)) {
        itemsOut = output.length;
      } else if (output && typeof output === 'object' && 'items' in output && Array.isArray((output as any).items)) {
        itemsOut = (output as any).items.length;
      } else if (output !== null && output !== undefined) {
        itemsOut = 1;
      }

      await prisma.stage.update({
        where: { id: stage.id },
        data: {
          status: StageStatus.COMPLETED,
          itemsOut,
          completedAt: new Date(),
        },
      });

      await logger.info(`Successfully completed stage ${stageName} (Items out: ${itemsOut})`);

      return {
        success: true,
        stageId: stage.id,
        data: output,
        itemsOut,
      };
    } catch (err: any) {
      const errorMsg = redactSensitive(err?.message || `Stage ${stageName} failed`);
      await logger.error(`Stage ${stageName} failed: ${errorMsg}`, { stack: err?.stack });

      await prisma.stage.update({
        where: { id: stage.id },
        data: {
          status: StageStatus.FAILED,
          errorMessage: errorMsg,
          completedAt: new Date(),
        },
      });

      // Dispatch alert to private Telegram chat
      await sendTelegramAlert(
        `Stage *${stageName}* failed in run \`${runId}\` (Slot: ${baseContext.slot}, Niche: ${baseContext.niche}):\n${errorMsg}`,
        true
      );

      return {
        success: false,
        stageId: stage.id,
        itemsOut: 0,
        error: err instanceof Error ? err : new Error(errorMsg),
      };
    }
  }
}
