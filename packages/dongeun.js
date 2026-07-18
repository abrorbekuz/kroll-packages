const extension = {
  title: "Dongeun Korean",
  name: "dongeun",
  language: "ko",
  baseUrl: "http://127.0.0.1:3000",
  coverUri:
    "https://avatars.mds.yandex.net/get-altay/14402637/2a00000193da469556c3856ce124111b6f6c/L_height",

  async items(page = 1, query = "", filters = "{}") {
    try {
      const params = new URLSearchParams({
        _page: page,
        _per_page: 10,
      });
      if (query) params.set("title:contains", query);

      const res = await fetch(`${this.baseUrl}/levels?${params}`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data ?? []);
      return {
        items: list.map((level) => ({
          title: level.title,
          coverUri: level.coverUri,
          sourceItemId: String(level.id),
          sourceId: this.name,
        })),
        hasNextPage: Array.isArray(json) ? false : json.next !== null,
      };
    } catch (e) {
      console.error("items() failed:", e);
      return { items: [], hasNextPage: false };
    }
  },

  async detail(levelId, settingsJson) {
    const res = await fetch(`${this.baseUrl}/lessons?levelId=${levelId}`);
    const json = await res.json();
    const lessons = json.data ?? json; // v1 wraps in data, v0 returns array

    const levelRes = await fetch(`${this.baseUrl}/levels/${levelId}`);
    const level = await levelRes.json();

    const blocks = lessons.map((lesson) => ({
      sourceBlockId: String(lesson.id),
      title: lesson.title,
      date: "2024/3/1",
      link: lesson.link,
      linkType: lesson.type,
    }));

    return {
      sourceId: this.name,
      sourceItemId: String(level.id),
      title: level.title,
      coverUri: level.coverUri,
      contentType: "video",
      meta: {
        author: "Dongeun",
        description: `Sejong Korean ${level.title}`,
        genres: JSON.stringify(["Korean", "Language Learning"]),
        status: "completed",
      },
      blocks,
    };
  },

  async getLink(sourceBlockId) {
    console.log("fetch:block server", sourceBlockId);
    const res = await fetch(`${this.baseUrl}/lessons/${sourceBlockId}`);
    const lesson = await res.json();
    return lesson.link ?? null;
  },

  async search() {
    return { fields: [] };
  },

  async settings() {
    return { fields: [] };
  },
};
