/**
 * Toolbox > "Page" panel's meta control (authors/discussion/visibility/status/slug/published-at) —
 * fixed, single-instance state, not routed through getValue()/setValue() (controls/base.js).
 *
 * @param {Object} options
 * @param {Object[]} options.statuses
 * @param {Object[]} options.visibilities
 * @param {Object[]} options.discussions
 * @param {Object[]} options.authors - `{ name, email }` entries; at least one must stay selected in "selectedAuthors".
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

    // At least one entry always stays in here — enforced by authorOption() below, not by validation.
    selectedAuthors: authors[0] ? [authors[0].name] : [],
    authors,

    slug: '',

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
    /**
     * v-bind="e.authorSummary(name)" on each selected author's "x" icon (the summary shows one
     * removable chip per entry in "selectedAuthors" instead of plain text) — removes that author
     * directly, without opening the dropdown. ".stop.prevent" keeps the click from also toggling
     * the <details> open, since the icon sits inside its <summary>.
     */
    authorSummary(name) {
      return {
        '@click.stop.prevent'() {
          if (this.selectedAuthors.length > 1) {
            this.selectedAuthors = this.selectedAuthors.filter((n) => n !== name);
          }
        },
      };
    },
    /**
     * v-bind="e.authorOption(a)" for each `v-each="a in authors"` entry. Authors allows multiple
     * (toggled on click, no checkbox input), so — unlike statusOption()/visibilityOption()/
     * discussionOption() below — this doesn't close the details on click, and refuses to remove
     * the last remaining author (removing one is otherwise also available directly from the
     * summary's chips via authorSummary() above).
     */
    authorOption(a) {
      return {
        // "checked" (not "active") — editrix.scss gives it the same hover highlight but, unlike
        // "active", doesn't set pointer-events: none; unlike a single-select radio row, several
        // entries here can be highlighted at once and each must stay clickable to remove it again.
        ':class'() {
          return this.selectedAuthors.includes(a.name) && 'checked';
        },
        '@click'() {
          const isSelected = this.selectedAuthors.includes(a.name);

          if (isSelected && this.selectedAuthors.length > 1) {
            this.selectedAuthors = this.selectedAuthors.filter((name) => name !== a.name);
          } else if (!isSelected) {
            this.selectedAuthors = [...this.selectedAuthors, a.name];
          }
        },
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
