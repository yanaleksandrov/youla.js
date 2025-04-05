/**
 * The Directives
 *
 * Now that the core is all set up, we can register X directives like v-text or
 * v-html that form the basis of how X adds behavior to an app's static markup.
 */
import './scripts/directives/v-bind';
import './scripts/directives/v-each';
import './scripts/directives/v-hide';
import './scripts/directives/v-html';
import './scripts/directives/v-prop';
import './scripts/directives/v-show';
import './scripts/directives/v-text';

/**
 * The Methods
 *
 * These are the methods that are magically available to all the Youla.js expressions, within your web app.
 */
import './scripts/methods/$ajax';
import './scripts/methods/$dispatch';

/**
 * Let's build X together. For starters, we'll import X's core.
 * This is the object that will expose all of X's public API.
 */
import { Youla } from './scripts/index';

window.Youla = Youla;

window.Youla.start();
