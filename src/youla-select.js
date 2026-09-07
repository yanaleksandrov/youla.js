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
    const settings = { showSearch: false, hideSelected: false, closeOnSelect: true };

    if (el.hasAttribute('multiple')) {
      settings.hideSelected  = true;
      settings.closeOnSelect = false;
    }

    Object.assign(settings, output && typeof output === 'object' ? output : {});

    // A reactive update (options changed) tears down the previous instance first — SlimSelect
    // has no "update options" method of its own, only a full rebuild — so this rebuilds from
    // "el.options"'s current, restored (post-destroy) state rather than whatever it looked like
    // mid-render.
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
      el._x_slimSelect = new SlimSelect({ settings, select: el, data });
    } catch {
      console.error('Youla.js: "SlimSelect" is not defined — u-select requires SlimSelect to be loaded.');
    }
  });
});
