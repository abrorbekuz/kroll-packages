const extension = {
  title: "Kocw",
  name: "kocw",
  language: "ko",
  baseUrl: "http://www.kocw.net",
  coverUri: "https://kocw.net/home/images/favicon.ico",
  cdn_url: "http://kocw-n.xst.kinxcdn.com",

  _parseCourseList(html) {
    const items = [];
    const courseRegex =
      /<li>[\s\S]*?<a href="\/home\/cview\.do\?cid=([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<strong[^>]*>\s*<a[^>]+>([^<]+)<\/a>/g;
    let m;

    while ((m = courseRegex.exec(html)) !== null) {
      items.push({
        title: m[3].trim(),
        coverUri: m[2].startsWith("http") ? m[2] : this.baseUrl + m[2],
        sourceItemId: m[1],
        sourceId: this.name,
      });
    }

    return items;
  },

  async _getVideoUrl(lectureId) {
    try {
      const res = await fetch(
        `${this.baseUrl}/home/search/searchLectureLoc.do`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "lectureId=" + lectureId,
        },
      );
      const data = await res.text();

      const match = data.match(/"location":"([^"]+)"/);
      if (match?.[1]) {
        const loc = match[1];
        // strip [vod][4] prefix, build full CDN url
        const path = loc.replace(/^\[vod\]\[\d+\]\//, "");

        return `${this.cdn_url}/kocw-n/_definst_/mp4:${path}/manifest.mpd`;
      }

      const altMatch = data.match(/"mp4Loc":"([^"]+)"/);
      if (altMatch?.[1]) return atob(altMatch[1]);

      return null;
    } catch (e) {
      console.error("Failed to get video URL:", e);
      return null;
    }
  },

  async items(page = 1, query = "", filters = "{}") {
    const filters_obj =
      typeof filters === "string" ? JSON.parse(filters) : filters;

    const field = filters_obj.field ?? "znAll";
    const language = filters_obj.language ?? "";
    const year = filters_obj.year ?? "";

    let url;
    if (query) {
      const params = new URLSearchParams({
        query,
        open_top_select: field,
        language_code: language,
        term_yr: year,
        iStartCount: String((page - 1) * 10),
      });
      url = `${this.baseUrl}/home/search/search.do?${params.toString()}`;
    } else {
      url = `${this.baseUrl}/home/search/univCoursesAll.do?page=${page}`;
    }

    console.log("fetch:items", page, url);
    const res = await fetch(url);
    const html = await res.text();

    return {
      items: this._parseCourseList(html),
      hasNextPage: html.includes(`page=${page + 1}`),
    };
  },

  async detail(cId, settingsJson) {
    console.log("fetch:detail ", cId);
    const res = await fetch(`${this.baseUrl}/home/cview.do?cid=${cId}`);
    const html = await res.text();

    // sourceItemId
    const cidMatch = html.match(/var cid\s*=\s*'([^']+)'/);
    const sourceItemId = cidMatch?.[1] ?? cId;

    // title
    const titleMatch = html.match(
      /class="detailTitle"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/s,
    );
    const title = titleMatch?.[1]?.trim() ?? "";

    // coverUri
    const coverMatch = html.match(
      /src="(\/home\/common\/contents\/thumbnail\/[^"]+\.jpg)"/,
    );
    const coverUri = coverMatch ? `http://www.kocw.net${coverMatch[1]}` : "";

    // author + description
    const authorMatch = html.match(
      /<ul class="detailTitInfo">.*?<li>([^<]+)<\/li>/s,
    );
    const author = authorMatch?.[1]?.trim() ?? "";

    const descMatch = html.match(/class="datailViewInfo"\s*>([^<]+)<\/div>/);
    const description = descMatch?.[1]?.trim() ?? "";

    // genres
    const genres = [];
    const syllabusMatch = html.match(/class="btnStyle02">([^<]+)<\/a>/);
    if (syllabusMatch) genres.push(syllabusMatch[1].trim());
    const categoryMatch = html.match(/<dt>주제분류<\/dt>\s*<dd>([^<]+)<\/dd>/);
    if (categoryMatch) {
      categoryMatch[1]
        .split(" &gt;")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((g) => genres.push(g));
    }

    // date from semester
    const dateMatch = html.match(
      /<dt>강의학기<\/dt>\s*<dd>(\d+)년\s*(\d+)학기<\/dd>/,
    );
    const date = dateMatch
      ? `${dateMatch[1]}/${dateMatch[2] === "1" ? "3" : "9"}/1`
      : null;

    // blocks — videos
    const blocks = [];
    const trRe = /<tr[\s\S]*?<\/tr>/g;
    let tr;
    while ((tr = trRe.exec(html)) !== null) {
      const isVideo = tr[0].includes("ico_video");
      const isPdf = tr[0].includes("ico_pdf");

      if (isVideo) {
        const m = tr[0].match(
          /onclick="f_play\('[^']+','[^']+','(\d+)',\d+,'([^']+)'/,
        );
        const urlM = tr[0].match(/f_mv_url\('([^']+)'\)/);
        if (m) {
          const link = await this._getVideoUrl(m[1]);
          blocks.push({
            sourceBlockId: urlM?.[1] ?? m[1],
            title: m[2].trim(),
            date,
            link,
            linkType: "video",
          });
        }
      } else if (isPdf) {
        const m = tr[0].match(/f_vewLec\('([^']+)','[^']+','(\d+)',\d+,\d+/);
        const urlM = tr[0].match(/f_mv_url\('([^']+)'\)/);
        const titleM = tr[0].match(/onclick="f_vewLec[^>]*>\s*([^<]+)<\/a>/);
        if (m)
          blocks.push({
            sourceBlockId: urlM?.[1] ?? m[2],
            title: titleM?.[1]?.trim() ?? "강의자료",
            date,
            link: m[1],
            linkType: "pdf",
          });
      }
    }

    return {
      sourceId: this.name,
      sourceItemId,
      title,
      coverUri,
      contentType: "video",
      meta: {
        author,
        description,
        genres: JSON.stringify(genres),
        status: "completed",
      },
      blocks,
    };
  },

  async getLink(sourceBlockId) {
    console.log("fetch:block ", sourceBlockId);
    return await this._getVideoUrl(sourceBlockId);
  },

  async search() {
    return {
      fields: [
        {
          type: "dropdown",
          label: "search by",
          key: "field",
          options: [
            { label: "All", value: "znAll" },
            { label: "Course Title", value: "znTitle" },
            { label: "Instructor", value: "znCreator" },
            { label: "Provider Institution", value: "znPublisher" },
          ],
        },
        {
          type: "dropdown",
          label: "language",
          key: "language",
          options: [
            { label: "All", value: "" },
            { label: "Korean", value: "KO" },
            { label: "English", value: "EN" },
          ],
        },
        {
          type: "dropdown",
          label: "year",
          key: "year",
          options: [
            { label: "All", value: "" },
            { label: "2026", value: "2026" },
            { label: "2025", value: "2025" },
            { label: "2024", value: "2024" },
            { label: "2023", value: "2023" },
            { label: "2022", value: "2022" },
            { label: "2021", value: "2021" },
            { label: "2020", value: "2020" },
            { label: "2019", value: "2019" },
            { label: "2018", value: "2018" },
          ],
        },
      ],
    };
  },

  async settings() {
    return { fields: [] };
  },
};
