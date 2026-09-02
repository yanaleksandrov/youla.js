/**
 * Toolbox > "Page" panel's meta control (authors/discussion/visibility/status/published-at) — a
 * fixed, single-instance control (not a name-keyed setting), so its own state and bindings live here
 * rather than going through getValue()/setValue() (controls/base.js). "statuses"/"visibilities"/
 * "discussions"/"authors" come from backend data (youla-editrix.js's readBackendData()).
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderMeta() {
  return cloneTemplateFragment('editrix-control-meta');
}

/**
 * @param {Object} options
 * @param {Object[]} options.statuses
 * @param {Object[]} options.visibilities
 * @param {Object[]} options.discussions
 * @param {Object[]} options.authors
 */
export function createMetaControl({ statuses, visibilities, discussions, authors }) {
  return {
    status: 'published',
    statuses,
    // "scheduled" is set automatically by publishedAtInput() below rather than picked directly, but stays in "statuses" so statusSummary() still finds its label.
    selectableStatuses: statuses.filter((stat) => stat.value !== 'scheduled'),
    // Drives both the publish time and, via publishedAtInput() below, whether "status" is published or scheduled.
    publishedAt: '2025-03-15T11:44',
    // Independent of "status" above — public (default)/protected/private, matching WordPress's Status/Visibility split.
    visibility: 'public',
    visibilities,
    password: '',
    // Named "discussionStatus" (not "discussion") to avoid shadowing the `v-each="discussion in discussions"` loop variable used in discussionOption() below.
    discussionStatus: discussions[0]?.value || '',
    discussions,

    author: 'John Doe',
    authors,

    statusSummary: {
      'v-text'() {
        return this.statuses.find((stat) => stat.value === this.status)?.label || this.status;
      },
    },
    // Two-way binding for the "Published At" input, plus flipping "status" to/from "scheduled" based on whether the date is in the future.
    publishedAtInput: {
      ':value'() {
        return this.publishedAt;
      },
      '@input'(e) {
        this.publishedAt = e.target.value;

        if (this.publishedAt && new Date(this.publishedAt) > new Date()) {
          this.status = 'scheduled';
        } else if (this.status === 'scheduled') {
          this.status = 'published';
        }
      },
    },
    // One entry per `v-each="stat in statuses"` — a plain object still sees "stat" in scope.
    statusOption: {
      '@click': "$el.closest('details').open = false",
      ':class': "status === stat.value && 'active'",
    },
    // Same shape as statusSummary() above.
    visibilitySummary: {
      'v-text'() {
        return this.visibilities.find((vision) => vision.value === this.visibility)?.label || this.visibility;
      },
    },
    // Same shape as statusOption() above.
    visibilityOption: {
      '@click': "$el.closest('details').open = false",
      ':class': "visibility === vision.value && 'active'",
    },
    authorSummary: {
      'v-text'() {
        return this.author;
      },
    },
    // Authors aren't looped (v-each) in the markup, so click/active-state is parameterized by name: v-bind="e.authorOption('John Doe')"
    authorOption(name) {
      return {
        '@click': `$el.closest('details').open = false`,
        ':class': `author === '${name}' && 'active'`,
      };
    },
    discussionSummary: {
      'v-text'() {
        return this.discussionStatus;
      },
    },
    discussionOption: {
      '@click': "$el.closest('details').open = false",
      ':class': "discussionStatus === discussion.value && 'active'",
    },
  };
}
