## Task
- Add Google-fetch-only keyword timeout and per-keyword checkpointing so completed keywords are not lost.

## Plan
- Split Google retrieval from downstream website crawl/email processing.
- Timeout and skip only the Google fetch stage for each keyword, then continue to the next keyword.
- Persist each completed keyword immediately and verify the API plus Docker build.
