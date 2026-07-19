const extension = {
  title: "Muhammadqodir Yulchiyev",
  name: "mqodir",
  language: "uz",
  baseUrl: "https://t.me/STUDENTKADIR",
  coverUri: "https://uknow.tail6e7192.ts.net/author.jpg",
  baseApiUrl: "https://my-json-server.typicode.com/abrorbekuz/kroll",

  async items(page = 1, query = "", filters = "{}") {
    try {
      const params = new URLSearchParams({
        _page: page,
        _per_page: 10,
      });
      if (query) params.set("title:contains", query);

      const res = await fetch(`${this.baseApiUrl}/lessons?${params}`);
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
    const res = await fetch(`${this.baseApiUrl}/lessons?lessonId=${levelId}`);
    const json = await res.json();
    const lessons = json.data ?? json; // v1 wraps in data, v0 returns array

    const levelRes = await fetch(`${this.baseApiUrl}/lessons/${levelId}`);
    const level = await levelRes.json();

    const blocks = lessons.map((lesson) => ({
      sourceBlockId: String(lesson.id),
      title: lesson.title,
      date: "2023/7/14",
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
        author: "Muhammadqodir Yulchiyev",
        description: `Lessons of Muhammadqodir Yulchiyev. Achivements: Topik 6 on 2025, Korean Exchange Student program winner ! Currently majoring in computer science Korean University with full scolarship. Video lessons given to us with his own volition. Contact: telegram - @yulchiyev1`,
        genres: JSON.stringify([
          "Korean",
          "Language Learning",
          "Uzbek lessons",
        ]),
        status: "completed",
      },
      blocks,
    };
  },

  async getLink(sourceBlockId) {
    console.log("fetch:block server", sourceBlockId);
    const res = await fetch(`${this.baseApiUrl}/lessons/${sourceBlockId}`);
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
