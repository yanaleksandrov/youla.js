/**
 * The Directives
 *
 * Now that the core is all set up, we can register Youla.js directives like v-text or
 * v-html that form the basis of how Youla.js adds behavior to an app's static markup.
 */
import './scripts/directives/v-each';
import './scripts/directives/v-html';
import './scripts/directives/v-prop';
import './scripts/directives/v-show';
import './scripts/directives/v-text';

/**
 * The Methods
 *
 * These are the methods that are magically available to all the Youla.js expressions, within your web app.
 */
import './scripts/methods/$dispatch';

/**
 * Let's build Youla.js together. For starters, we'll import Youla.js's core.
 * This is the object that will expose all of Youla.js's public API.
 */
import { Youla } from './scripts/index';

window.Youla = Youla;

window.Youla.start();
