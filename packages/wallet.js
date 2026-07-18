const extension = {
  title: "Result Wallet",
  name: "wallet",
  language: "en",
  coverUri:
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSU4nAnbbxZxXJDztWToVevSchBQ2vGpcK6QdlbEJV-IA&s=10",
  baseUrl: "https://www.topik.go.kr",

  _cache: {},

  async _getCookieString() {
    const cookies = await CookieManager.get(this.baseUrl);
    return Object.entries(cookies)
      .map(([k, c]) => `${k}=${c.value}`)
      .join("; ");
  },

  async _updateCookiesFromResponse(res) {
    let setCookies = [];
    if (typeof res.headers.getSetCookie === "function") {
      setCookies = res.headers.getSetCookie();
    } else {
      const raw = res.headers.get("set-cookie");
      if (raw) {
        // split only on a comma that precedes a new "name=" token,
        // not on commas inside Expires= dates
        setCookies = raw.split(/,(?=\s*[^=;,]+=)/);
      }
    }
    for (const cookieStr of setCookies) {
      const [nameValue] = cookieStr.split(";");
      const [name, ...rest] = nameValue.trim().split("=");
      const value = rest.join("=");
      if (name && value) {
        await CookieManager.set(this.baseUrl, {
          name: name.trim(),
          value: value.trim(),
          domain: "topik.go.kr",
          path: "/",
        });
      }
    }
  },

  async _req(url, opts = {}, redirectCount = 0) {
    if (redirectCount > 10) throw new Error("Too many redirects");
    const cookieString = await this._getCookieString();
    const res = await fetch(url, {
      ...opts,
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        Referer: `${this.baseUrl}/TWMYPG/TWMYPG0060-001.do`,
        Origin: this.baseUrl,
        Cookie: cookieString,
        ...(opts.headers || {}),
      },
    });
    await this._updateCookiesFromResponse(res);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (location) {
        const redirectUrl = location.startsWith("http")
          ? location
          : this.baseUrl + location;
        return this._req(redirectUrl, opts, redirectCount + 1);
      }
    }
    return res;
  },

  async _fetchOpertnOptions(examType) {
    const res = await this._req(
      `${this.baseUrl}/TWMYPG/TWMYPG0060GetTestSessions.do`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `examType=${examType}`,
      },
    );
    return res.json();
  },

  _extractScoreFromHtml(html) {
    try {
      const tableMatch = html.match(
        /<table[^>]*class="basic_table"[^>]*>([\s\S]*?)<\/table>/i,
      );
      if (!tableMatch) return null;
      const tbodyMatch = tableMatch[0].match(
        /<tbody[^>]*>([\s\S]*?)<\/tbody>/i,
      );
      if (!tbodyMatch) return null;
      const trMatch = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
      if (!trMatch) return null;
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let m;
      while ((m = tdRegex.exec(trMatch[1])) !== null) {
        cells.push(m[1].replace(/<[^>]*>/g, "").trim());
      }
      if (cells.length < 12) return null;
      const [validityStart, validityEnd] = cells[9]
        .split("~")
        .map((s) => s.trim().replace(/\s+/g, ""));
      const [outputStart, outputEnd] = cells[10]
        .split("~")
        .map((s) => s.trim().replace(/\s+/g, ""));
      return {
        category: cells[0],
        session: cells[1],
        level: cells[2],
        examineeNo: cells[3],
        country: cells[4],
        center: cells[5],
        totalScore: cells[6],
        average: cells[7],
        acceptance: cells[8],
        validity: { start: validityStart || "?", end: validityEnd || "?" },
        outputPeriod: { start: outputStart || "?", end: outputEnd || "?" },
      };
    } catch (e) {
      return null;
    }
  },

  async items(page = 1, query = "", filters = "{}") {
    if (page > 1) return { items: [], hasNextPage: false };
    return {
      items: [
        {
          title: "Topik Results",
          coverUri:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxRNj53CuYWyYXTn6P0GP6WcL_w5ukqeq6wAAAScvxVw&s=10",
          sourceItemId: "topik-result",
          sourceId: this.name,
        },
      ],
      hasNextPage: false,
    };
  },

  async _fetchScoreForConfig(config) {
    const sessions = await this._fetchOpertnOptions(config.examType);
    sessions.sort((a, b) => b.opertnId.localeCompare(a.opertnId));

    for (const session of sessions) {
      const opertnId = session.opertnId;
      const searchRes = await this._req(
        `${this.baseUrl}/TWMYPG/TWMYPG0060-001.do`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            examType: config.examType,
            opertnTme: opertnId,
            opertnId,
            exmneNo: config.exmneNo,
            brthdy: config.brthdy,
            gubun: "001",
            drm: "Y",
            ozrFileName: "",
            odiFileName: "",
            odiCnt: "1",
            param: "",
            basehref: this.baseUrl,
            EffectiveDate: "",
          }).toString(),
        },
      );
      const searchHtml = await searchRes.text();
      const fnPrintMatch = searchHtml.match(
        /fnPrint\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/,
      );
      if (!fnPrintMatch) continue;

      const scoreData = this._extractScoreFromHtml(searchHtml);
      if (!scoreData) continue;

      const printInfo = {
        opertnId: fnPrintMatch[1],
        exmneNo: fnPrintMatch[2],
        grad: fnPrintMatch[3],
        issuEndPrintDt: fnPrintMatch[4],
      };
      return { scoreData, printInfo };
    }
    return null;
  },

  async detail(sourceItemId, settingsJson) {
    const userSettings = JSON.parse(settingsJson || "{}");

    const configs = (userSettings.exam_numbers ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      // FIX: filter out malformed entries (no digits after prefix, bad prefix)
      .filter((no) => /^[EePp]/.test(no) && no.slice(1).length > 0)
      .map((no) => {
        const dob = userSettings.dob ?? "";
        const parts = dob.split("/");
        let brthdy = "";
        if (parts.length === 3) {
          const [mm, dd, yyyy] = parts;
          if (mm && dd && yyyy && yyyy.length === 4) {
            brthdy = `${yyyy}${dd.padStart(2, "0")}${mm.padStart(2, "0")}`;
          }
        }
        return {
          exmneNo: no.slice(1),
          examType: no[0]?.toUpperCase() === "E" ? "IBT" : "PBT",
          brthdy,
        };
      });

    await CookieManager.clearAll();
    await CookieManager.set(this.baseUrl, {
      name: "timezone",
      value: "Asia/Seoul",
      domain: "topik.go.kr",
      path: "/",
    });
    await this._req(`${this.baseUrl}/TWMAIN/TWMAIN0010.do`);
    await this._req(`${this.baseUrl}/TWMYPG/TWMYPG0060-001.do`);

    const results = [];
    for (const config of configs) {
      const r = await this._fetchScoreForConfig(config);
      if (r) results.push({ config, ...r });
    }

    // FIX: genres is now always defined before use — no more TDZ crash
    // when results is empty
    const genres = results.length
      ? Array.from(new Set(["TOPIK", ...results.map((r) => r.scoreData.level)]))
      : ["TOPIK"];

    if (results.length === 0) {
      return {
        sourceId: this.name,
        sourceItemId,
        title: "Topik Results",
        coverUri:
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxRNj53CuYWyYXTn6P0GP6WcL_w5ukqeq6wAAAScvxVw&s=10",
        contentType: "video",
        meta: {
          author: "Abror",
          description: `There will be your topik results listed here. If not showing up wait 1 day then hit "Refresh" from "top 3 dots menu".`,
          genres: JSON.stringify(genres),
          status: "completed",
        },
        blocks: [],
      };
    }

    // cache all results for future getLink() calls
    this._cache[sourceItemId] = results;

    return {
      sourceId: this.name,
      sourceItemId,
      title: "Topik Results",
      coverUri:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxRNj53CuYWyYXTn6P0GP6WcL_w5ukqeq6wAAAScvxVw&s=10",
      contentType: "video",
      meta: {
        author: "Abror",
        description: `There will be your topik results listed here. If not showing up wait 1 day then hit "Refresh" from "top 3 dots menu".`,
        genres: JSON.stringify(genres),
        status: "completed",
      },
      blocks: results.map((r, i) => ({
        sourceBlockId: `${sourceItemId}-${i}`,
        title: `${r.config.exmneNo} · ${r.scoreData.level} · ${r.scoreData.totalScore}/${r.scoreData.average} (${r.scoreData.acceptance})`,
        date: r.scoreData.validity.start,
        link: null,
        linkType: "none",
      })),
    };
  },

  async getLink(sourceBlockId) {
    return null;
  },

  async search() {
    return { fields: [] };
  },

  async settings() {
    return {
      fields: [
        {
          name: "exam_numbers",
          type: "string",
          label: "Exam Numbers",
          description:
            "Enter your exam codes with trailing comma. eg: P00700808082,P123002083,P123232. P means physical exam, while E means remote exam",
        },
        {
          name: "dob",
          type: "string",
          label: "Your date of birth",
          description:
            "We need your date of birth to fetch your exam results. topik.go.kr security wont allow unless. eg: 01/01/2000",
        },
      ],
    };
  },
};
