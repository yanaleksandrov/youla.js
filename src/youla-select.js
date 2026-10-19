/**
 * Slimselect is an advanced select dropdown.
 *
 * License: MIT <https://opensource.org/licenses/MIT>
 *
 * @version 2.12.1
 * @source  https://github.com/brianvoe/slim-select
 * @author	Brian Voelker
 */
import SlimSelect from 'slim-select';

window.SlimSelect = SlimSelect;

document.addEventListener('youla:init', ()=> {

  /**
   * Adapter for SlimSelect — turns `<option>`s (with optional data-image/data-icon/data-flag/
   * data-description) and optgroups into SlimSelect's data format.
   *
   * @see   https://github.com/brianvoe/slim-select
   * @since 1.0
   */
  Youla.directive('select', (el, output) => {
    const settings = { showSearch: false, hideSelected: false, closeOnSelect: true, contentPosition: 'fixed' };

    if (el.hasAttribute('multiple')) {
      settings.hideSelected  = true;
      settings.closeOnSelect = false;
    }

    const { events: userEvents = {}, ...options } = output && typeof output === 'object' ? output : {};
    const events = { ...userEvents };
    Object.assign(settings, options);

    if (typeof events.search === 'function') {
      const search = events.search;
      // Accept "{options: [...]}" or an array; an aborted request leaves the indicator until the next response.
      events.search = (...args) => Promise.resolve(search(...args)).then(
        response => Array.isArray(response) ? response : response?.options ?? [],
        error => error?.name === 'AbortError' ? new Promise(() => {}) : Promise.reject(error),
      );
    }

    // flush() re-runs the directive on every forced refresh — keep the instance unless its settings changed.
    const settingsKey = JSON.stringify(settings);
    if (el._x_slimSelect && el._x_slimSelectSettings === settingsKey) {
      // Functions don't survive JSON, so events are refreshed on the existing instance.
      Object.assign(el._x_slimSelect.events, events);
      return;
    }
    el._x_slimSelectSettings = settingsKey;

    // SlimSelect has no "update options" method, only a full rebuild — destroy before reading "el.options".
    el._x_slimSelect?.destroy();

    const data = Array.from(el.options).reduce((acc, option) => {
      const image       = option.getAttribute('data-image');
      const icon        = option.getAttribute('data-icon');
      const flag        = option.getAttribute('data-flag');
      const description = option.getAttribute('data-description') || '';

      const html = [
        flag && window.youla?.flagsUrl && `<svg><use xlink:href="${window.youla.flagsUrl}#${flag}"></use></svg>`,
        image && `<img src="${image}" alt />`,
        icon && `<i class="${icon}"></i>`,
        `<span class="ss-text">${option.text}${description && `<span class="ss-description">${description}</span>`}</span>`,
      ].join('');

      const optionData = {
        text: option.text,
        value: option.value,
        html,
        selected: option.selected,
        // SlimSelect recreates <option>s from this data — keep the markup default for native form reset.
        defaultSelected: option.defaultSelected,
        display: true,
        disabled: false,
        mandatory: false,
        placeholder: false,
        class: '',
        style: '',
        data: {},
      };

      if (option.parentElement.tagName === 'OPTGROUP') {
        const label = option.parentElement.getAttribute('label');
        let group   = acc.find(item => item.label === label);
        if (!group) {
          group = { label, options: [] };
          acc.push(group);
        }
        group.options.push(optionData);
      } else {
        acc.push(optionData);
      }
      return acc;
    }, []);

    try {
      const selectedValues = () => [...el.selectedOptions].map(o => o.value).join('\n');
      const initialValue   = selectedValues();

      // The constructor rebuilds the <option>s and always emits a bubbling "change" — drop it while the value stays the same.
      el.dispatchEvent = event => (event.type === 'change' && selectedValues() === initialValue)
        || EventTarget.prototype.dispatchEvent.call(el, event);

      let slim;
      try {
        slim = el._x_slimSelect = new SlimSelect({ settings, select: el, data, events });
      } finally {
        delete el.dispatchEvent;
      }

      const form = el.form;

      if (form) {
        // "reset" fires before the browser restores values, so sync on the next tick; native reset emits no "change".
        const onReset = () => setTimeout(() => slim.setSelected([...el.selectedOptions].map(o => o.value), false));
        const destroy = slim.destroy.bind(slim);

        form.addEventListener('reset', onReset);
        slim.destroy = () => {
          form.removeEventListener('reset', onReset);
          destroy();
        };
      }
    } catch {
      console.error('Youla.js: "SlimSelect" is not defined — u-select requires SlimSelect to be loaded.');
    }
  });
});
