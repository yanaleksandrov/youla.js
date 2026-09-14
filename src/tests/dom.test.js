import { describe, it, expect, afterEach } from 'vitest';
import { isNode, hasDirective, closestDirective, domWalk } from '../scripts/dom';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isNode', () => {
  it('returns true for a DOM element', () => {
    expect(isNode(document.createElement('div'))).toBe(true);
  });

  it('returns true for a text node', () => {
    expect(isNode(document.createTextNode('x'))).toBe(true);
  });

  it('returns false for a plain object', () => {
    expect(isNode({})).toBe(false);
  });

  it('returns false for null/undefined/primitives', () => {
    expect(isNode(null)).toBe(false);
    expect(isNode(undefined)).toBe(false);
    expect(isNode(5)).toBe(false);
    expect(isNode('div')).toBe(false);
  });

  it('returns false for an object that merely has a similarly-named property', () => {
    expect(isNode({ nodeType: 'not-a-number' })).toBe(false);
  });
});

describe('hasDirective', () => {
  it('matches an attribute with no modifiers', () => {
    const el = document.createElement('div');
    el.setAttribute('u-data', '{}');
    expect(hasDirective(el, 'u-data')).toBe(true);
  });

  it('matches an attribute with modifiers', () => {
    const el = document.createElement('div');
    el.setAttribute('u-data.local.30d', '{}');
    expect(hasDirective(el, 'u-data')).toBe(true);
  });

  it('returns false when the directive is absent', () => {
    const el = document.createElement('div');
    expect(hasDirective(el, 'u-data')).toBe(false);
  });

  it('does not match a different directive name that happens to share a prefix', () => {
    const el = document.createElement('div');
    el.setAttribute('u-datax', '{}');
    expect(hasDirective(el, 'u-data')).toBe(false);
  });
});

describe('closestDirective', () => {
  it('finds the directive on the element itself', () => {
    document.body.innerHTML = '<div id="a" u-data="{}"></div>';
    const el = document.getElementById('a');
    expect(closestDirective(el, 'u-data')).toBe(el);
  });

  it('finds the directive on an ancestor', () => {
    document.body.innerHTML = '<div id="outer" u-data="{}"><div id="inner"></div></div>';
    const inner = document.getElementById('inner');
    expect(closestDirective(inner, 'u-data')).toBe(document.getElementById('outer'));
  });

  it('returns null when no ancestor carries the directive', () => {
    document.body.innerHTML = '<div id="a"><div id="b"></div></div>';
    expect(closestDirective(document.getElementById('b'), 'u-data')).toBeNull();
  });

  it('returns null when starting from null', () => {
    expect(closestDirective(null, 'u-data')).toBeNull();
  });
});

describe('domWalk', () => {
  it('visits the root element itself', () => {
    document.body.innerHTML = '<div id="root"></div>';
    const visited = [];
    domWalk(document.getElementById('root'), (el) => visited.push(el.id));
    expect(visited).toEqual(['root']);
  });

  it('visits every descendant depth-first', () => {
    document.body.innerHTML = '<div id="root"><div id="a"><div id="b"></div></div><div id="c"></div></div>';
    const visited = [];
    domWalk(document.getElementById('root'), (el) => visited.push(el.id));
    expect(visited).toEqual(['root', 'a', 'b', 'c']);
  });

  it('stops at a nested u-data boundary, skipping its subtree entirely', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="nested" u-data="{}"><div id="hidden"></div></div>
        <div id="after"></div>
      </div>
    `;
    const visited = [];
    domWalk(document.getElementById('root'), (el) => visited.push(el.id));
    expect(visited).toContain('root');
    expect(visited).toContain('after');
    expect(visited).not.toContain('nested');
    expect(visited).not.toContain('hidden');
  });

  it('treats a u-each template as a leaf, not descending into its children', () => {
    document.body.innerHTML = `
      <ul id="root">
        <li id="tpl" u-each="i in 3"><span id="inner">x</span></li>
      </ul>
    `;
    const visited = [];
    domWalk(document.getElementById('root'), (el) => visited.push(el.id));
    expect(visited).toContain('tpl');
    expect(visited).not.toContain('inner');
  });

  it('snapshots children before visiting, so DOM mutation during the walk does not break traversal', () => {
    document.body.innerHTML = '<div id="root"><div id="a"></div><div id="b"></div></div>';
    const visited = [];
    domWalk(document.getElementById('root'), (el) => {
      visited.push(el.id);
      if (el.id === 'a') {
        const injected = document.createElement('div');
        injected.id = 'injected';
        el.after(injected);
      }
    });
    expect(visited).toEqual(['root', 'a', 'b']);
  });

  it('walks into a same-origin iframe\'s own body', () => {
    document.body.innerHTML = '<iframe id="frame"></iframe>';
    const iframe = document.getElementById('frame');
    iframe.contentDocument.body.innerHTML = '<div id="inside"></div>';

    const visited = [];
    domWalk(iframe, (el) => visited.push(el.id || el.tagName));
    expect(visited).toContain('inside');
  });
});
