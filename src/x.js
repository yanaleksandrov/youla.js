/**
 * Let's build X together. For starters, we'll import X's core.
 * This is the object that will expose all of X's public API.
 */
import { x } from './scripts/index';

window.x = x;

/**
 * A client-side properties storage system.
 * X.js watch property changes and overwrites them to the repositories.
 */
import './scripts/storage';

/**
 * The Directives
 *
 * Now that the core is all set up, we can register X directives like v-text or
 * v-html that form the basis of how X adds behavior to an app's static markup.
 */
import './scripts/directives/v-each';
import './scripts/directives/v-bind';
import './scripts/directives/v-html';
import './scripts/directives/v-text';
import './scripts/directives/v-show';
import './scripts/directives/v-hide';
import './scripts/directives/v-prop';
//import './scripts/directives/v-ref';

/**
 * The Methods
 *
 * These are the methods that are magically available to all the X.js expressions, within your web app.
 */
import './scripts/methods/$ajax';
import './scripts/methods/$store';
import './scripts/methods/$dispatch';

// experimental directives & methods for grafema project
import './scripts/directives/v-grafema';
import './scripts/methods/$grafema';

// plugin editor
import './plugins/editor/directives/v-editor';
import './plugins/editor/directives/v-drag';

window.x.start();
