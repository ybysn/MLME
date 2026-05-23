/**
 * 模块职责：写作模式 ProseMirror Decoration 查找高亮插件。
 * 输入：通过 transaction meta 接收 query / caseSensitive / activeIndex。
 * 输出：在 ProseMirror state 中注入 inline Decoration，渲染查找高亮。
 * 风险点：doc 内容变化后必须重新计算 ranges，不得使用过期 from/to。
 */
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Node } from '@milkdown/kit/prose/model';
import { $prose } from '@milkdown/kit/utils';
import type { Editor } from '@milkdown/kit/core';

// ── 类型 ────────────────────────────────────

export interface FindState {
  query: string;
  caseSensitive: boolean;
  ranges: Array<{ from: number; to: number }>;
  activeIndex: number;
  decorations: DecorationSet;
}

export interface FindDispatchMeta {
  query: string;
  caseSensitive: boolean;
  activeIndex: number;
}

// ── PluginKey ──────────────────────────────

export const writingFindPluginKey = new PluginKey<FindState>('WRITING_FIND');

// ── 纯计算 ─────────────────────────────────

function computeRanges(
  doc: Node,
  query: string,
  caseSensitive: boolean,
): Array<{ from: number; to: number }> {
  if (!query) return [];
  const ranges: Array<{ from: number; to: number }> = [];
  const target = caseSensitive ? query : query.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text ?? '';
    const source = caseSensitive ? text : text.toLowerCase();
    let start = 0;
    while (start < source.length) {
      const idx = source.indexOf(target, start);
      if (idx === -1) break;
      ranges.push({ from: pos + idx, to: pos + idx + target.length });
      start = idx + target.length;
    }
  });

  return ranges;
}

function createDecorations(
  doc: Node,
  ranges: Array<{ from: number; to: number }>,
  activeIndex: number,
): DecorationSet {
  const decos: Decoration[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const className =
      i === activeIndex
        ? 'writing-find-match writing-find-match-current'
        : 'writing-find-match';
    decos.push(Decoration.inline(r.from, r.to, { class: className }));
  }
  return DecorationSet.create(doc, decos);
}

function buildEmptyState(): FindState {
  return {
    query: '',
    caseSensitive: false,
    ranges: [],
    activeIndex: 0,
    decorations: DecorationSet.empty,
  };
}

// ── Plugin（$prose 包装） ──────────────────

export const writingFindPlugin = $prose((_ctx) => {
  return new Plugin<FindState>({
    key: writingFindPluginKey,

    state: {
      init(): FindState {
        return buildEmptyState();
      },

      apply(tr, state, _oldState, newState): FindState {
        const meta: FindDispatchMeta | undefined =
          tr.getMeta(writingFindPluginKey) as FindDispatchMeta | undefined;

        let needsRecompute = false;
        let nextQuery = state.query;
        let nextCaseSensitive = state.caseSensitive;
        let nextActiveIndex = state.activeIndex;

        if (meta) {
          nextQuery = meta.query;
          nextCaseSensitive = meta.caseSensitive;
          nextActiveIndex = meta.activeIndex;
          needsRecompute = true;
        } else if (tr.docChanged && state.query) {
          needsRecompute = true;
        }

        if (needsRecompute) {
          if (!nextQuery) {
            return buildEmptyState();
          }
          const ranges = computeRanges(newState.doc, nextQuery, nextCaseSensitive);
          const clampedIndex = Math.max(
            0,
            Math.min(nextActiveIndex, ranges.length - 1),
          );
          const decorations = createDecorations(
            newState.doc,
            ranges,
            clampedIndex,
          );
          return {
            query: nextQuery,
            caseSensitive: nextCaseSensitive,
            ranges,
            activeIndex: clampedIndex,
            decorations,
          };
        }

        return state;
      },
    },

    props: {
      decorations(state) {
        const s = writingFindPluginKey.getState(state);
        return s?.decorations ?? DecorationSet.empty;
      },
    },
  });
});

// ── 外部 dispatch / 读取 ───────────────────

export function updateWritingFind(
  view: EditorView | null,
  query: string,
  caseSensitive: boolean,
  activeIndex: number,
): void {
  if (!view) return;
  if (!view.state) return;
  if (typeof view.dispatch !== 'function') return;
  const tr = view.state.tr.setMeta(writingFindPluginKey, {
    query,
    caseSensitive,
    activeIndex,
  } satisfies FindDispatchMeta);
  view.dispatch(tr);
}

export function getWritingFindState(
  view: EditorView | null,
): FindState | undefined {
  if (!view?.state) return undefined;
  return writingFindPluginKey.getState(view.state);
}

// ── Milkdown Feature 注册 ──────────────────

export function writingFindFeature(editor: Editor): void {
  editor.use(writingFindPlugin);
}
