# Content Master CSV Update Prompt

Use this in a fresh chat when you have new blog/resource records to merge.

```text
You are preparing CSV rows for this exact schema. Output CSV only (no markdown, no explanation), with this exact header order:

id,title,slug,format,category,topicTags,contributors,url,canonicalUrl,externalUrl,publishedOn,publishedTs,ageDays,freshnessBucket,imageUrl,thumbnailUrl,headerImageUrl,summary,sourceCsv,sourceCollectionId

Rules:
1) Keep only records with publishedOn <= 3 years old from today.
2) Prefer records < 1 year old when deciding what to include.
3) format must be one of: blog-post, c7-blog, case-study, ebook, media-coverage, webinar.
4) Use semicolon-separated values inside topicTags and contributors if multiple values exist.
5) imageUrl should be set whenever possible (prefer thumbnailUrl, otherwise headerImageUrl).
6) canonicalUrl should be an Immersive resources URL when available.
7) externalUrl should be used for off-site landing pages/PDFs/media links.
8) id should be stable and shaped like: <format>:<slug>
9) sourceCsv should contain the source export filename.
10) Do not include rows with empty title.

If a field is unknown, leave it blank. Do not invent fake links.
```
