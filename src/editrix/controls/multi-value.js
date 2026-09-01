/**
 * "Multi-value" controls — a setting whose value is itself an object with a few named parts
 * (Elementor's own url/media/box_shadow controls work the same way). There's no wrapper factory
 * of their own here (unlike a data control's text()/select()/...): a compound control's wrapper
 * is just `field(name, title, tooltip, { type: 'url', default: {...} })` like any other, and its
 * parts are base.js's part()/partNumber()/partSwitch() — see controls/render.js's url()/media()
 * renderers.
 *
 * Value shapes, for reference:
 *   url:   { url: '', is_external: false, nofollow: false }
 *   media: { url: '', alt: '' } — stands in for Elementor's media-library picker with a plain URL
 *          field + live preview, per this project's current media handling; swapping in a real
 *          picker later only means replacing the input's markup, not this shape.
 *
 * The rest of the list (image_dimensions, icon, icons, text_shadow, box_shadow) are the same
 * pattern — a field() wrapper plus part()/partNumber()/partSwitch() calls — once this one's reviewed.
 */
export function createMultiValueControls() {
  return {};
}
