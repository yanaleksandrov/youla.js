# Project Documentation and Commenting Instructions

When writing or updating project documentation, follow these rules strictly.

## Documentation

* Write in a professional style that is clear and easy to understand for a mid-level developer.
* Do not describe implementation details unless they are necessary for practical usage.
* Focus on how features, APIs, functions, properties, and instructions are used in real-world projects.
* Do not add unnecessary theoretical explanations or internal implementation details.
* Anything related to syntax, properties, functions, parameters, or usage instructions **must be presented in a table**.
* Put the most important warnings in a Markdown blockquote (`>`).
* Use **no more than one blockquote per page**.
* If there are multiple warnings, combine them into a single blockquote.
* When an example requires `v-data="{}"`, always use the shorthand form `v-data` instead.

When documenting a feature, provide a **short, high-level description of its purpose and main capabilities**.

Keep the description concise — usually **1–2 paragraphs**. Do not try to document every detail of the implementation or every possible interaction.

Do not describe:

* implementation details;
* classes, methods, constructors, or architecture;
* internal logic or state management;
* DOM structure or event handlers;
* UI layout or visual details;
* step-by-step user interactions;
* detailed user scenarios;
* minor behavioral details;
* dimensions, positioning, or other visual specifics.

Do not explain in detail how the interface works. Simply describe **what the feature is for and what its key capabilities are**, so its purpose and scope can be understood quickly.

If the feature has options or configuration parameters, **do not describe them in detail in the main text**. Options and their details are the responsibility of the options table.

Avoid unnecessary wording and technical details. If a detail does not help explain the feature's main purpose or a key capability, leave it out.

#### Desired level of detail

> The `v-filler` directive turns a text input into a color or image picker. It supports HEX, RGB, and HSL colors, transparency, custom color palettes, and image settings with CSS filters.

This is the preferred level of detail: **short, focused, and high-level, without describing the UI, implementation, or secondary details.**

## Comments

Follow these rules whenever you write or modify code comments:

* Keep comments concise and add them **only when they provide useful information that cannot be understood directly from the code**.
* Do not add comments that simply restate what the code does.
* Inline comments starting with `\\` **must always be single-line comments**. Never split them across multiple lines.
* DocBlock comments should be implemented using `/*` and descriptions must be concise and limited to **2–3 lines maximum** with `@param` and etc.
* Avoid verbose explanations inside comments and DocBlocks.
* Prefer clear code over explanatory comments whenever possible.
* CSS comments should be concise and short — no more than one line.
* The library is evolving, so the descriptions may contain functions, behaviors, or elements that no longer exist. The comments should be kept up to date.
  * Don't add comments to the HTML.