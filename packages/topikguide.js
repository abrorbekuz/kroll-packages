const extension = {
  title: "TOPIK Guide Mock Tests",
  name: "topikguide",
  language: "ko",
  coverUri:
    "https://jaem.io/wp-content/uploads/2025/04/Free-TOPIK-Mock-Tests-image.jpg",
  baseUrl: "https://www.topikguide.com/topik-mock-tests/",

  async _scrape() {
    const res = await fetch(this.baseUrl);
    const html = await res.text();

    const topik1 = [];
    const topik2 = [];

    // Regex that:
    // 1. matches <a ... href="...Mock-Test.html" ...>
    // 2. skips everything until the <span class="...tcb-button-text...">
    // 3. captures the plain text inside that span
    const linkRegex =
      /<a[^>]*href="([^"]*Mock-Test\.html)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*\btcb-button-text\b[^"]*"[^>]*>([^<]+)<\/span>/gi;

    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const href = m[1];
      const title = m[2].trim();

      if (!title) continue;

      if (href.includes("TOPIK-II-") || title.includes("TOPIK II")) {
        topik2.push({ title, href });
      } else if (href.includes("TOPIK-I-") || title.includes("TOPIK I")) {
        topik1.push({ title, href });
      }
    }

    console.log(
      `Found ${topik1.length} TOPIK I tests, ${topik2.length} TOPIK II tests`,
    );
    return { topik1, topik2 };
  },

  async items(page = 1, query = "", filters = "{}") {
    if (page > 1) return { items: [], hasNextPage: false };
    return {
      items: [
        {
          title: "TOPIK I",
          coverUri: this.coverUri,
          sourceItemId: "topik-1",
          sourceId: this.name,
        },
        {
          title: "TOPIK II",
          coverUri: this.coverUri,
          sourceItemId: "topik-2",
          sourceId: this.name,
        },
      ],
      hasNextPage: false,
    };
  },

  async detail(sourceItemId, settingsJson) {
    console.log("fetch:detail ", sourceItemId);
    const { topik1, topik2 } = await this._scrape();
    const isLevel1 = sourceItemId === "topik-1";
    const lessons = isLevel1 ? topik1 : topik2;
    const level = isLevel1 ? "I" : "II";

    const blocks = lessons.map((lesson, i) => ({
      sourceBlockId: `${sourceItemId}-${i}`,
      title: lesson.title,
      date: "2024/3/1",
      link: lesson.href,
      linkType: "webview",
      webInject:
        "(function() { var header = document.querySelector('header.site-header'); if (header) header.remove(); var footer = document.querySelector('footer'); if (footer) footer.remove();})();",
    }));

    return {
      sourceId: this.name,
      sourceItemId,
      title: `TOPIK ${level} Mock Tests`,
      coverUri: this.coverUri,
      contentType: "video",
      meta: {
        author: "TOPIK Guide",
        description: `Official TOPIK ${level} mock tests from past exams`,
        genres: JSON.stringify(["Korean", "TOPIK", "Language Learning"]),
        status: "completed",
      },
      blocks,
    };
  },

  async getLink(sourceBlockId) {
    console.log("fetch:block ", sourceBlockId);
    const { topik1, topik2 } = await this._scrape();
    const isLevel1 = sourceBlockId.startsWith("topik-1");
    const lessons = isLevel1 ? topik1 : topik2;
    const index = parseInt(sourceBlockId.split("-").pop());
    return lessons[index]?.href ?? null;
  },

  async search() {
    return { fields: [] };
  },

  async settings() {
    return { fields: [] };
  },
};
