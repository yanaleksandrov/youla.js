// Air Datepicker — modern JS calendar built on ES6 with native CSS variables.
// License: MIT <https://opensource.org/licenses/MIT>
// @version 3.6.0
// @source  https://github.com/t1m0n/air-datepicker
// @author  Copyright (c) Timofey Marochkin
import AirDatepicker from 'air-datepicker';

document.addEventListener('youla:init', ()=> {

  /**
   * Initializes AirDatepicker on the element, tearing down and rebuilding on every reactive
   * refresh so structural options (range, view, ...) always apply cleanly.
   *
   * @since 1.0
   */
  Youla.directive('pickadate', (el, output) => {
    const options = output && typeof output === 'object' ? output : {};

    if (el._x_pickadate) {
      el._x_pickadate.destroy();
    }

    el._x_pickadate = new AirDatepicker(el, {
      range: false,
      inline: false,
      multipleDatesSeparator: ' — ',
      // "locale" must be omitted (not undefined) — AirDatepicker's locale merge breaks on explicit undefined.
      ...(window.youla?.datepicker ? { locale: window.youla.datepicker } : {}),
      firstDay: window.youla?.weekStart || 0,
      dateFormat: window.youla?.dateFormat || 'yyyy-MM-dd',
      container: el.closest('div'),
      view: 'days',
      ...options,
    });
  });
});
