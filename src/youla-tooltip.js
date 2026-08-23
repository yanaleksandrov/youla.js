import { TooltipInstance, PLACEMENTS, TRIGGERS } from './scripts/tooltip';

document.addEventListener('youla:init', ()=> {

  /**
   * Shows "output" as a tooltip anchored to the element. Position and trigger come
   * from the directive's modifiers, delay from a bare one like `.500ms`; content is
   * trusted HTML (see v-html).
   *
   * @since 1.0
   */
  Youla.directive('tooltip', (el, output, { modifiers, duration }) => {
    const placement = modifiers.find(m => PLACEMENTS.includes(m)) || 'auto';
    const trigger   = modifiers.find(m => TRIGGERS.includes(m)) || 'hover';

    const delay   = duration?.unit === 'ms' ? duration.value : 250;
    const content = output == null ? '' : String(output);

    const instance = el._x_tooltip;
    if (!instance) {
      el._x_tooltip = new TooltipInstance(el, content, placement, trigger, delay);
      return;
    }

    instance.updateContent(content);
    instance.updatePlacement(placement);
    instance.updateTrigger(trigger);
    instance.updateDelay(delay);
  });
});
