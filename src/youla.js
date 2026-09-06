// Core directives: u-each, u-html, u-prop, u-show, u-text.
import './scripts/directives/u-each';
import './scripts/directives/u-html';
import './scripts/directives/u-prop';
import './scripts/directives/u-show';
import './scripts/directives/u-text';

// Methods available to all Youla.js expressions.
import './scripts/methods/$dispatch';

// Core object exposing Youla.js's public API.
import { Youla } from './scripts/index';

window.Youla = Youla;

window.Youla.start();
