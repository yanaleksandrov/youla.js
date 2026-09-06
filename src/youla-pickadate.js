/**
 * Air Datepicker is a modern JavaScript calendar written on ES6 with the use of CSS native variables.
 *
 * License: MIT <https://opensource.org/licenses/MIT>
 *
 * @version 3.5.3
 * @source  https://github.com/t1m0n/air-datepicker
 * @author	Copyright (c) Timofey Marochkin
 */
import AirDatepicker from 'air-datepicker';

window.AirDatepicker = AirDatepicker;

document.addEventListener('youla:init', ()=> {

  /**
   * Initializes an AirDatepicker instance on the element; re-run (see refresh()'s dependency
   * tracking) whenever a data property its options expression reads changes, tearing down and
   * rebuilding the instance so even structural options (range, view, ...) apply cleanly.
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
      // "locale" must be omitted, not passed as undefined — AirDatepicker's own locale merge
      // (deep-clones the default via JSON.stringify/parse) breaks on an explicit undefined.
      ...(window.expansa?.datepicker ? { locale: window.expansa.datepicker } : {}),
      firstDay: window.expansa?.weekStart || 0,
      dateFormat: window.expansa?.dateFormat || 'yyyy-MM-dd',
      container: el.closest('div'),
      view: 'days',
      ...options,
    });
  });
});
