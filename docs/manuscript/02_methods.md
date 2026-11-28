# Methods

We followed three paths through the pinned source tree: the recursive JSON content loader, the locale-specific render loop and the output writer. In the documented model, the reader discovers page files below `src/content/pages/`, and uses the `slug` field from each record as the logical identity. The build iterates configured locales and renders their output paths. Some outputs, including sitemap and feeds, are emitted as root-level singletons.

The migration and validation guides were used to classify the repository's checks. In particular, link and redirect checks concern artifacts that can be inspected before deploy. Network checks and browser runs are separate invocations with different prerequisites.
