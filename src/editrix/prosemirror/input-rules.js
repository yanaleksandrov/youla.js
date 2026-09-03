import { InputRule, inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';

// Requires a whitespace (or the start of the line) right before the opening delimiter — the
// simplest rule that both reads naturally and can never mistake "**bold**" for a nested italic,
// since "[^*_]+" can't include the run's own closing delimiter either.
const STRONG_RULE = /(?:^|\s)(\*\*|__)([^*_]+)\1$/;
const EM_RULE = /(?:^|\s)(\*|_)([^*_]+)\1$/;
const CODE_RULE = /(?:^|\s)`([^`]+)`$/;

const HEADING_RULE = /^(#{1,6})\s$/;
const BLOCKQUOTE_RULE = /^\s*>\s$/;
const BULLET_LIST_RULE = /^\s*([-+*])\s$/;
const ORDERED_LIST_RULE = /^\s*(\d+)\.\s$/;
const HORIZONTAL_RULE_RULE = /^(?:---|\*\*\*)$/;

/**
 * A "**bold**"/"*italic*"/"`code`"-style shortcut: strips the typed delimiters and applies "markType"
 * to the text between them.
 *
 * @param {RegExp} regexp - Its last capture group is the text to mark; earlier groups (e.g. the
 *   matched delimiter) are just for structure.
 * @param {import('prosemirror-model').MarkType} markType
 * @returns {InputRule}
 */
function markInputRule(regexp, markType) {
  return new InputRule(regexp, (state, match, start, end) => {
    const { tr } = state;
    const fullMatch = match[0];
    const content = match[match.length - 1];

    const delimiterStart = start + fullMatch.search(/\S/);
    const textStart = start + fullMatch.indexOf(content);
    const textEnd = textStart + content.length;

    if (textEnd < end) {
      tr.delete(textEnd, end);
    }
    if (textStart > delimiterStart) {
      tr.delete(delimiterStart, textStart);
    }

    const markEnd = delimiterStart + content.length;
    tr.addMark(delimiterStart, markEnd, markType.create());
    tr.removeStoredMark(markType);
    return tr;
  });
}

/**
 * "---" or "***" on an otherwise empty line becomes a horizontal rule.
 */
function horizontalRuleInputRule(nodeType) {
  return new InputRule(HORIZONTAL_RULE_RULE, (state, match, start, end) => (
    state.tr.replaceWith(start, end, nodeType.create())
  ));
}

/**
 * This schema's own markdown-style shortcuts — "**bold**", "*italic*", "`code`" for whichever
 * marks it defines, plus "# ", "> ", "- "/"* "/"+ " and "---" for whichever block nodes it defines.
 * A "plain" scheme naturally keeps only the mark shortcuts, since it has no block nodes to switch into.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {Array<InputRule>}
 */
export function buildInputRules(schema) {
  const rules = [];

  if (schema.marks.strong) {
    rules.push(markInputRule(STRONG_RULE, schema.marks.strong));
  }
  if (schema.marks.em) {
    rules.push(markInputRule(EM_RULE, schema.marks.em));
  }
  if (schema.marks.code) {
    rules.push(markInputRule(CODE_RULE, schema.marks.code));
  }
  if (schema.nodes.heading) {
    rules.push(textblockTypeInputRule(HEADING_RULE, schema.nodes.heading, (match) => ({ level: match[1].length })));
  }
  if (schema.nodes.blockquote) {
    rules.push(wrappingInputRule(BLOCKQUOTE_RULE, schema.nodes.blockquote));
  }
  if (schema.nodes.bullet_list) {
    rules.push(wrappingInputRule(BULLET_LIST_RULE, schema.nodes.bullet_list));
  }
  if (schema.nodes.ordered_list) {
    rules.push(wrappingInputRule(
      ORDERED_LIST_RULE,
      schema.nodes.ordered_list,
      (match) => ({ order: +match[1] }),
      // "2. " right after an existing ordered list continues it (order N+1) instead of starting a
      // new nested one — matches prosemirror's own example-setup behavior for this rule.
      (match, node) => node.childCount + node.attrs.order === +match[1],
    ));
  }
  if (schema.nodes.horizontal_rule) {
    rules.push(horizontalRuleInputRule(schema.nodes.horizontal_rule));
  }

  return rules;
}

/**
 * The ready-to-use plugin — one of mountEditor()'s own plugins (youla-editrix.js).
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Plugin}
 */
export function textInputRules(schema) {
  return inputRules({ rules: buildInputRules(schema) });
}
