import {
  prisma,
  RunStatus,
  StageName,
  ItemStatus,
  AssetType,
  PlatformChannel,
  PostStatus,
} from '@social-engine/db';
import {
  StageRunner,
  PublisherFactory,
  RawItem,
  RankedItemOutput,
  PostContent,
  MediaAsset,
  sendTelegramAlert,
  ChannelType,
} from '@social-engine/core';
import { getNiche } from './registry.js';

export interface PipelineJobData {
  runId: string;
  slot: string;
  niche: string;
  triggerSource: string;
}

export async function executePipeline(jobData: PipelineJobData): Promise<void> {
  const { runId, slot, niche: nicheName, triggerSource } = jobData;

  // 1. Check Kill Switch
  const killSwitch = process.env.ENGINE_KILL_SWITCH === 'true';
  if (killSwitch) {
    console.warn(`[Pipeline] ENGINE_KILL_SWITCH is enabled. Aborting run ${runId}`);
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: RunStatus.SKIPPED,
        errorMessage: 'Run aborted by ENGINE_KILL_SWITCH',
      },
    });
    return;
  }

  // 2. Mark Run as RUNNING
  await prisma.run.update({
    where: { id: runId },
    data: {
      status: RunStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  const baseContext = { slot, niche: nicheName, triggerSource };
  const niche = getNiche(nicheName);

  try {
    // -------------------------------------------------------------
    // STAGE 1: COLLECT
    // -------------------------------------------------------------
    const collectResult = await StageRunner.execute<void, RawItem[]>(
      {
        runId,
        stageName: StageName.COLLECT,
        itemsIn: 0,
        execute: async (context) => {
          const rawItems: RawItem[] = [];
          for (const collector of niche.collectors) {
            try {
              const collected = await collector.collect(context);
              rawItems.push(...collected);
            } catch (err: any) {
              await context.logger.warn(`Collector ${collector.name} failed: ${err.message}`);
            }
          }

          // Process & Store Items with Drop Reasons
          const qualifiedItems: RawItem[] = [];
          for (const item of rawItems) {
            let isEligible = true;
            let dropReason: string | undefined;

            if (niche.isEligible) {
              const check = niche.isEligible(item);
              isEligible = check.eligible;
              dropReason = check.reason;
            }

            try {
              await prisma.item.upsert({
                where: {
                  niche_dedupeHash: {
                    niche: nicheName,
                    dedupeHash: item.dedupeHash,
                  },
                },
                update: {
                  runId,
                  status: isEligible ? ItemStatus.PASSED_TO_RANK : ItemStatus.DROPPED,
                  dropReason,
                  isLive: isEligible,
                  livenessCheckedAt: new Date(),
                },
                create: {
                  runId,
                  niche: nicheName,
                  source: item.source,
                  dedupeHash: item.dedupeHash,
                  rawData: item.rawData as any,
                  externalId: item.externalId,
                  externalUrl: item.externalUrl,
                  publishedAt: item.publishedAt,
                  status: isEligible ? ItemStatus.PASSED_TO_RANK : ItemStatus.DROPPED,
                  dropReason,
                  isLive: isEligible,
                  livenessCheckedAt: new Date(),
                },
              });
            } catch (dbErr) {
              // Ignore duplicate key race condition
            }

            if (isEligible) {
              qualifiedItems.push(item);
            }
          }

          return qualifiedItems;
        },
      },
      undefined,
      baseContext
    );

    if (!collectResult.success || !collectResult.data) {
      throw new Error(`Collect stage failed: ${collectResult.error?.message}`);
    }

    const collectedItems = collectResult.data;

    // -------------------------------------------------------------
    // STAGE 2: RANK
    // -------------------------------------------------------------
    const rankResult = await StageRunner.execute<RawItem[], RankedItemOutput[]>(
      {
        runId,
        stageName: StageName.RANK,
        itemsIn: collectedItems.length,
        execute: async (context, items) => {
          const ranked = await niche.ranker.rank(items, context);

          // Save ranked records
          for (const r of ranked) {
            try {
              const itemRecord = await prisma.item.findUnique({
                where: { niche_dedupeHash: { niche: nicheName, dedupeHash: r.itemId } },
              });

              if (itemRecord) {
                await prisma.rankedItem.upsert({
                  where: { itemId: itemRecord.id },
                  update: {
                    runId,
                    score: r.score,
                    reasoning: r.reasoning,
                    extractedData: r.extractedData as any,
                    isSelected: r.isSelected,
                  },
                  create: {
                    runId,
                    itemId: itemRecord.id,
                    score: r.score,
                    reasoning: r.reasoning,
                    extractedData: r.extractedData as any,
                    isSelected: r.isSelected,
                  },
                });
              }
            } catch (err) {
              // Ignore upsert errors
            }
          }

          return ranked.filter((r) => r.isSelected);
        },
      },
      collectedItems,
      baseContext
    );

    if (!rankResult.success || !rankResult.data) {
      throw new Error(`Rank stage failed: ${rankResult.error?.message}`);
    }

    const selectedRankedItems = rankResult.data;

    // Guardrail: Skip post if too few good items
    if (selectedRankedItems.length < niche.thresholds.minItemsToPost) {
      const skipMsg = `Run ${runId} skipped: Found ${selectedRankedItems.length} good items, minimum required is ${niche.thresholds.minItemsToPost}`;
      console.warn(`[Pipeline] ${skipMsg}`);

      await prisma.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.SKIPPED,
          errorMessage: skipMsg,
          completedAt: new Date(),
        },
      });

      await sendTelegramAlert(`⚠️ *[RUN SKIPPED]*\nSlot: \`${slot}\`\nNiche: \`${nicheName}\`\nReason: ${skipMsg}`);
      return;
    }

    // -------------------------------------------------------------
    // STAGE 3: WRITE
    // -------------------------------------------------------------
    // Fetch active style pack or fallback
    const activeStyleRecord = await prisma.style.findFirst({
      where: { niche: nicheName, isActive: true },
    });
    const styleConfig = (activeStyleRecord?.config as any) || niche.defaultStyle;

    const writeResult = await StageRunner.execute<RankedItemOutput[], PostContent>(
      {
        runId,
        stageName: StageName.WRITE,
        itemsIn: selectedRankedItems.length,
        execute: async (context, items) => {
          return await niche.writer.writeCaptions(items, styleConfig, context);
        },
      },
      selectedRankedItems,
      baseContext
    );

    if (!writeResult.success || !writeResult.data) {
      throw new Error(`Write stage failed: ${writeResult.error?.message}`);
    }

    const postContent = writeResult.data;

    // -------------------------------------------------------------
    // STAGE 4: RENDER
    // -------------------------------------------------------------
    const renderResult = await StageRunner.execute<
      { items: RankedItemOutput[]; content: PostContent },
      MediaAsset[]
    >(
      {
        runId,
        stageName: StageName.RENDER,
        itemsIn: selectedRankedItems.length,
        execute: async (context, input) => {
          const assets = await niche.renderer.renderCarousel(input.items, input.content, styleConfig, context);

          // Save assets in DB
          for (const asset of assets) {
            await prisma.asset.create({
              data: {
                runId,
                type: asset.type as AssetType,
                path: asset.path,
                mimeType: asset.mimeType,
                sequenceOrder: asset.sequenceOrder,
                metadata: asset.metadata as any,
              },
            });
          }

          return assets;
        },
      },
      { items: selectedRankedItems, content: postContent },
      baseContext
    );

    if (!renderResult.success || !renderResult.data) {
      throw new Error(`Render stage failed: ${renderResult.error?.message}`);
    }

    const mediaAssets = renderResult.data;

    // -------------------------------------------------------------
    // STAGE 5: PUBLISH
    // -------------------------------------------------------------
    const targetChannels: ChannelType[] = ['telegram', 'instagram'];

    await StageRunner.execute<MediaAsset[], void>(
      {
        runId,
        stageName: StageName.PUBLISH,
        itemsIn: mediaAssets.length,
        execute: async (context, assets) => {
          for (const channel of targetChannels) {
            const publisher = PublisherFactory.getPublisher(channel);
            const caption =
              channel === 'telegram'
                ? postContent.telegramCaption
                : channel === 'instagram'
                ? postContent.instagramCaption
                : postContent.xPostText;

            await context.logger.info(`Publishing to channel [${channel}] via publisher [${publisher.name}]`);

            const result = await publisher.publish({
              runId,
              channel,
              caption,
              title: postContent.headline,
              tags: postContent.tags,
              media: assets.map((a) => ({
                path: a.path,
                type: a.type === 'VIDEO' ? 'video' : 'image',
              })),
            });

            // Record in posts table
            await prisma.post.create({
              data: {
                runId,
                channel: channel.toUpperCase() as PlatformChannel,
                publisherUsed: result.publisherName,
                externalPostId: result.externalPostId,
                externalPostUrl: result.externalPostUrl,
                caption,
                status: result.success ? PostStatus.PUBLISHED : PostStatus.FAILED,
                errorMessage: result.error,
                publishedAt: result.success ? new Date() : null,
              },
            });

            if (!result.success) {
              await context.logger.error(`Publishing to ${channel} failed: ${result.error}`);
            } else {
              await context.logger.info(`Successfully posted to ${channel}: ${result.externalPostUrl || result.externalPostId}`);
            }
          }
        },
      },
      mediaAssets,
      baseContext
    );

    // -------------------------------------------------------------
    // STAGE 6: TRACK
    // -------------------------------------------------------------
    await StageRunner.execute<void, void>(
      {
        runId,
        stageName: StageName.TRACK,
        itemsIn: 1,
        execute: async (context) => {
          await context.logger.info(`Run ${runId} tracking initialized. Webhooks will update analytics.`);
        },
      },
      undefined,
      baseContext
    );

    // Complete Run
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: RunStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    console.log(`[Pipeline] Run ${runId} completed successfully!`);
  } catch (pipelineErr: any) {
    console.error(`[Pipeline] Run ${runId} failed:`, pipelineErr);
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: RunStatus.FAILED,
        errorMessage: pipelineErr?.message || 'Unknown pipeline failure',
        completedAt: new Date(),
      },
    });

    await sendTelegramAlert(
      `❌ *[RUN FAILED]*\nRun ID: \`${runId}\`\nSlot: \`${slot}\`\nError: ${pipelineErr?.message}`,
      true
    );
  }
}

