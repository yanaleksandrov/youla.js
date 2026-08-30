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

## Comments

Follow these rules whenever you write or modify code comments:

* Keep comments concise and add them **only when they provide useful information that cannot be understood directly from the code**.
* Do not add comments that simply restate what the code does.
* Comments starting with `\\` **must always be single-line comments**. Never split them across multiple lines.
* DocBlock descriptions must be concise and limited to **2–3 lines maximum**.
* Avoid verbose explanations inside comments and DocBlocks.
* Prefer clear code over explanatory comments whenever possible.
