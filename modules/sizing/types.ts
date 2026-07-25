export type BlockSaveResult = { ok: true } | { ok: false; error: string };

export type BlockMutationResult = BlockSaveResult & {
  blockId?: string;
  forked?: boolean;
};
