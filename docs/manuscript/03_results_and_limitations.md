# Results and limitations

The source location has editorial value, since it groups related JSON records while allowing the loader to discover them recursively. Slug identity controls route placement, so moving a source JSON record between content-area directories preserves the route when its slug remains unchanged. Changing that slug changes the output path and warrants an explicit migration entry.

The output writer serves a different role from the metadata producer. It assembles render output into the root tree served by GitHub Pages. Sitemap, redirect and Markdown link checks verify different surfaces. A successful local gate constrains the candidate artifacts. It does not observe the state of the live site, the route caches of other services or a search engine's indexing decisions.
