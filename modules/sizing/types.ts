export type BlockSaveResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export type BlockMutationResult = BlockSaveResult & {
  blockId?: string;
  forked?: boolean;
};
