// Air Datepicker — modern JS calendar built on ES6 with native CSS variables.
// License: MIT <https://opensource.org/licenses/MIT>
// @version 3.6.0
// @source  https://github.com/t1m0n/air-datepicker
// @author  Copyright (c) Timofey Marochkin
import AirDatepicker from 'air-datepicker';

const VIEWPORT_GAP = 8;

const ISO_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?)?)?$/;
const ISO_TIME = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

const pad = (value, length = 2) => String(value).padStart(length, '0');

/**
 * Formats a date like native inputs do, from local components so the day never shifts to UTC.
 */
const toIso = (date, { onlyTimepicker, timepicker, minView }) => {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const year = pad(date.getFullYear(), 4);
  const month = `${year}-${pad(date.getMonth() + 1)}`;
  const day = `${month}-${pad(date.getDate())}`;

  if (onlyTimepicker) return time;
  if (timepicker) return `${day}T${time}`;
  if (minView === 'years') return year;
  if (minView === 'months') return month;

  return day;
};

/**
 * Parses comma-separated ISO values (dates, months, years or "HH:mm" for today).
 * Returns null when any part is not ISO.
 */
const parseIso = (value) => {
  const dates = [];

  for (const part of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    const time = part.match(ISO_TIME);
    let date;

    if (time) {
      date = new Date();
      date.setHours(+time[1], +time[2], 0, 0);
    } else {
      const [, year, month = 1, day = 1, hours = 0, minutes = 0] = part.match(ISO_DATE) ?? [];

      if (!year) return null;

      date = new Date(+year, month - 1, +day, +hours, +minutes);

      // Rejects overflowing values such as "2026-02-31".
      if (date.getMonth() !== month - 1 || date.getDate() !== +day) return null;
    }

    if (isNaN(date)) return null;

    dates.push(date);
  }

  return dates;
};

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

    // The visible field shows the locale format; the form submits ISO from the hidden one.
    const hidden = document.createElement('input');
    const name = el.getAttribute('name');
    const form = el.getAttribute('form');
    const initial = el.value.trim();
    const parsed = parseIso(initial);

    hidden.type = 'hidden';
    name !== null && hidden.setAttribute('name', name);
    form !== null && hidden.setAttribute('form', form);
    el.removeAttribute('name');
    el.after(hidden);

    if (!parsed) {
      console.warn(`u-pickadate: "${initial}" is not an ISO value, it is submitted as is.`);
    }

    // Assigned after construction; "position" may run earlier when "visible" is set.
    let dp;
    let listening = false;

    const reposition = () => dp?.visible && dp.setPosition();

    const listen = (on) => {
      if (listening === on) return;
      listening = on;
      const method = on ? 'addEventListener' : 'removeEventListener';
      window[method]('resize', reposition);
      window[method]('scroll', reposition, { capture: true, passive: true });
    };

    /**
     * Aligns the calendar to the field frame (label with its icons), flipping above it when there is no room below.
     * Returns nothing so AirDatepicker finishes hiding on its own.
     */
    const position = ({ $datepicker, $target, isViewChange }) => {
      const opts = dp?.opts ?? options;

      if (opts.isMobile) {
        listen(false);
        $datepicker.style.left = '50%';
        $datepicker.style.top = '50%';
        $datepicker.style.removeProperty('width');
        delete $datepicker.dataset.placement;
        return;
      }

      listen(true);

      // The new view is rendered after this call, so measure its height on the next frame.
      if (isViewChange) {
        requestAnimationFrame(reposition);
        return;
      }

      const anchor = ($target.closest('label') ?? $target).getBoundingClientRect();
      const offset = opts.positionOffset ?? 4;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      $datepicker.style.width = `${anchor.width}px`;

      const width = $datepicker.offsetWidth;
      const height = $datepicker.offsetHeight;

      let left = anchor.left;

      if (width > anchor.width && left + width > viewportWidth) {
        left = anchor.right - width;
      }

      if (left < 0 || left + width > viewportWidth) {
        left = Math.max(VIEWPORT_GAP, Math.min(left, viewportWidth - width - VIEWPORT_GAP));
      }

      let placement = 'bottom';
      let top = anchor.bottom + offset;

      if (top + height > viewportHeight && anchor.top - offset - height >= 0) {
        placement = 'top';
        top = anchor.top - offset - height;
      }

      const parent = $datepicker.offsetParent;

      if (!parent || parent === document.body) {
        left += window.scrollX;
        top += window.scrollY;
      } else {
        const rect = parent.getBoundingClientRect();
        left += parent.scrollLeft - rect.left;
        top += parent.scrollTop - rect.top;
      }

      $datepicker.style.left = `${left}px`;
      $datepicker.style.top = `${top}px`;
      $datepicker.dataset.placement = placement;
    };

    dp = el._x_pickadate = new AirDatepicker(el, {
      range: false,
      inline: false,
      multipleDatesSeparator: ' — ',
      // "locale" must be omitted (not undefined) — AirDatepicker's locale merge breaks on explicit undefined.
      ...(window.youla?.datepicker ? { locale: window.youla.datepicker } : {}),
      firstDay: window.youla?.weekStart || 0,
      dateFormat: window.youla?.dateFormat || 'yyyy-MM-dd',
      container: el.closest('div'),
      view: 'days',
      position,
      positionOffset: 4,
      ...(parsed?.length && options.selectedDates === undefined ? { selectedDates: parsed } : {}),
      ...options,
      altField: hidden,
      // A function, not a string: tokens only match between separators, and "T" is the timestamp token.
      // For "range" without "multipleDates" the library passes only the first date, so read them all from the instance.
      altFieldDateFormat: (dates) => (dp?.selectedDates ?? [].concat(dates)).map((date) => toIso(date, dp?.opts ?? options)).join(','),
      onHide(isFinished) {
        listen(false);
        options.onHide?.(isFinished);
      },
    });

    const monthsGenitive = window.youla?.datepicker?.monthsGenitive;

    // Genitive months only for formats with both "MMMM" and a day ("19 октября 2026"); formats stay strings so time is still appended.
    if (monthsGenitive?.length === 12) {
      const formatDate = dp.formatDate.bind(dp);

      dp.formatDate = (date, format) => {
        if (typeof format !== 'string' || !/(^|[^M])MMMM([^M]|$)/.test(format) || !/(^|[^d])dd?([^d]|$)/.test(format)) {
          return formatDate(date, format);
        }

        const months = dp.locale.months;
        dp.locale.months = monthsGenitive;

        try {
          return formatDate(date, format);
        } finally {
          dp.locale.months = months;
        }
      };
    }

    // The library applies initial dates asynchronously; render them now so both fields are ready.
    if (dp.selectedDates.length) {
      dp._setInputValue();
    } else if (!parsed) {
      hidden.value = initial;
    }

    let synced = hidden.value;
    let resetting = false;

    const initialDates = [...dp.selectedDates];
    const initialHidden = hidden.value;

    // The library fires a non-bubbling "change" on the field after every write, so the hidden value is final here.
    const sync = () => {
      if (resetting) return;

      if (!el.value && hidden.value) {
        dp.clear();
        return;
      }

      if (hidden.value === synced) return;

      synced = hidden.value;
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    };

    el.addEventListener('input', sync);
    el.addEventListener('change', sync);

    // "reset" fires before the browser restores values, and a hidden field's value isn't restored at all; native reset emits no "change".
    const resetForm = el.form;
    const onReset = () => setTimeout(() => {
      if (dp.isDestroyed) return;

      resetting = true;
      dp.selectedDates.length && dp.clear({ silent: true });
      initialDates.length && dp.selectDate(initialDates.map((date) => new Date(date)), { silent: true });

      // Runs after the library's own deferred write of both fields.
      setTimeout(() => {
        if (dp.isDestroyed) return;

        if (initialDates.length) {
          dp._setInputValue();
        } else {
          el.value = initial;
          hidden.value = initialHidden;
        }

        synced = hidden.value;
        resetting = false;
      });
    });

    resetForm?.addEventListener('reset', onReset);

    const destroy = dp.destroy;

    dp.destroy = () => {
      if (dp.isDestroyed) return;

      const value = hidden.value;

      listen(false);
      el.removeEventListener('input', sync);
      el.removeEventListener('change', sync);
      resetForm?.removeEventListener('reset', onReset);
      destroy();

      name !== null && el.setAttribute('name', name);
      form !== null && el.setAttribute('form', form);
      el.value = value;
      hidden.remove();
    };
  });
});
