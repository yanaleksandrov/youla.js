// Core directives: v-each, v-html, v-prop, v-show, v-text.
import './scripts/directives/v-each';
import './scripts/directives/v-html';
import './scripts/directives/v-prop';
import './scripts/directives/v-show';
import './scripts/directives/v-text';

// Methods available to all Youla.js expressions.
import './scripts/methods/$dispatch';

// Core object exposing Youla.js's public API.
import { Youla } from './scripts/index';

window.Youla = Youla;

window.Youla.start();
