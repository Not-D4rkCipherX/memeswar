const fs = require("fs");
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const { HttpsProxyAgent } = require("https-proxy-agent");
const header = require("./src/header");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const user_agents = require("./config/userAgents");
const settings = require("./config/config");
const { loadData, sleep, updateEnv, getRandomNumber, getRandomElement } = require("./utils");

class MemesWar {
  constructor(queryId, accountIndex, proxy) {
    this.headers = header;
    this.proxyList = loadData("proxy.txt");
    this.queryId = queryId;
    this.accountIndex = accountIndex;
    this.proxy = proxy;
    this.proxyIp = "Unknown IP";
    this.session_name = null;
    this.session_user_agents = this.#load_session_data();
    this.skipTasks = settings.SKIP_TASKS;
  }

  #load_session_data() {
    try {
      const filePath = path.join(__dirname, "session_user_agents.json");
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      } else {
        throw error;
      }
    }
  }

  #get_random_user_agent() {
    const randomIndex = Math.floor(Math.random() * user_agents.length);
    return user_agents[randomIndex];
  }

  #get_user_agent() {
    if (this.session_user_agents[this.session_name]) {
      return this.session_user_agents[this.session_name];
    }

    this.log(`Tạo user agent...`);
    const newUserAgent = this.#get_random_user_agent();
    this.session_user_agents[this.session_name] = newUserAgent;
    this.#save_session_data(this.session_user_agents);
    return newUserAgent;
  }

  #save_session_data(session_user_agents) {
    const filePath = path.join(__dirname, "session_user_agents.json");
    fs.writeFileSync(filePath, JSON.stringify(session_user_agents, null, 2));
  }

  #get_platform(userAgent) {
    const platformPatterns = [
      { pattern: /iPhone/i, platform: "ios" },
      { pattern: /Android/i, platform: "android" },
      { pattern: /iPad/i, platform: "ios" },
    ];

    for (const { pattern, platform } of platformPatterns) {
      if (pattern.test(userAgent)) {
        return platform;
      }
    }

    return "Unknown";
  }

  async #set_headers() {
    const platform = this.#get_platform(this.#get_user_agent());
    this.headers["sec-ch-ua"] = `"Not)A;Brand";v="99", "${platform} WebView";v="127", "Chromium";v="127"`;
    this.headers["sec-ch-ua-platform"] = platform;
    this.headers["User-Agent"] = this.#get_user_agent();
  }

  createUserAgent() {
    try {
      const telegramauth = this.queryId;
      const userData = JSON.parse(decodeURIComponent(telegramauth.split("user=")[1].split("&")[0]));
      this.session_name = userData.id;
      this.#get_user_agent();
    } catch (error) {
      this.log(`Kiểm tra lại query_id, hoặc thay query)id mới: ${error.message}`);
    }
  }

  log = (msg, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const logFormat = `${timestamp} | ${type.toLocaleUpperCase()}| [Tài khoản ${this.accountIndex + 1}][${this.proxyIp}] | ${msg}`;

    switch (type) {
      case "success":
        console.log(logFormat.green);
        break;
      case "custom":
        console.log(logFormat.magenta);
        break;
      case "error":
        console.log(logFormat.red);
        break;
      case "warning":
        console.log(logFormat.yellow);
        break;
      default:
        console.log(logFormat.blue);
    }
  };

  async countdown(seconds) {
    for (let i = seconds; i > 0; i--) {
      const timestamp = new Date().toLocaleTimeString();
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`[${timestamp}] [*] Waiting ${i} seconds to continue...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
  }

  async checkProxyIP(proxy) {
    try {
      const proxyAgent = new HttpsProxyAgent(proxy);
      const response = await axios.get("https://api.ipify.org?format=json", {
        httpsAgent: proxyAgent,
      });
      if (response.status === 200) {
        return response.data.ip;
      } else {
        throw new Error(`Unable to check proxy IP. Status code: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error checking proxy IP: ${error.message}`);
    }
  }

  getAxiosConfig(proxyUrl) {
    return {
      headers: this.headers,
      httpsAgent: new HttpsProxyAgent(proxyUrl),
    };
  }

  async getUserInfo(telegramInitData, proxyUrl) {
    const url = "https://memes-war.memecore.com/api/user";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };
    let retries = 3;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, config);
        if (response.status === 200 && response.data.data) {
          const userData = response.data.data.user;

          if (!userData.inputReferralCode) {
            try {
              await axios.put("https://memes-war.memecore.com/api/user/referral/YTT9ZV", {}, config);
            } catch (referralError) {
              this.log(`Unable to enter referral code: ${referralError.message}`, "error");
            }
          }
          return { success: true, data: userData };
        } else {
          return { success: false, error: "Invalid response format" };
        }
      } catch (error) {
        // console.log(telegramInitData, retries, error.status);
        if (retries < 3 && error.status === 500) {
          this.log(`Không thể lấy thông tin user, đang thử lại...${retries + 1}/3`);
          retries++;
          await sleep(1);
          await getUserInfo(telegramInitData, proxyUrl);
        } else return { success: false, error: error.message };
      }
    }
  }

  async checkTreasuryRewards(telegramInitData, proxyUrl) {
    const url = "https://memes-war.memecore.com/api/quest/treasury/rewards";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.get(url, config);
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async claimTreasuryRewards(telegramInitData, proxyUrl) {
    const url = "https://memes-war.memecore.com/api/quest/treasury";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.post(url, {}, config);
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createGuild(telegramInitData, userInfoResult, proxyUrl) {
    const avatarUrl = "https://d2j6dbq0eux0bg.cloudfront.net/images/66610504/2636936256.jpg";
    const url = "https://memes-war.memecore.com/api/guild";
    const headers = {
      ...this.getAxiosConfig(proxyUrl),
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
      "Content-Type": "multipart/form-data",
    };
    const name = userInfoResult.nickname;
    const nickname = userInfoResult.nickname;
    const response = await fetch(avatarUrl);
    const blob = await response.blob();
    // console.log(blob);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("ticker", nickname);
    formData.append("thumbnail", blob, "avatar.jpg");

    try {
      const response = await axios.post(url, formData, { headers });
      if (response.status === 200 && response.data.data) {
        const { name } = response.data.data;
        this.log(`Created guild ${name} success!`, "success");
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      console.error(error);
      this.log(`Can't create guild: ${error.message} `, "error");
      return { success: false, error: error.message };
    }
  }

  async getGuildTarget(telegramInitData, proxyUrl) {
    const url = "https://memes-war.memecore.com/api/raid";
    const headers = {
      ...this.getAxiosConfig(proxyUrl),
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
      "content-type": "application/json",
      Referer: "https://memes-war.memecore.com/raid/select",
    };

    try {
      const response = await axios.get(url, { headers });
      if (response.status === 200 && response.data.data) {
        const lowestRankItem = response.data.data.reduce((prev, current) => (prev.warbondRank > current.warbondRank ? prev : current));
        return { success: true, data: lowestRankItem };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async playGame(telegramInitData, target, proxyUrl) {
    const { guildId } = target;
    if (!guildId) return;
    const url = "https://memes-war.memecore.com/api/raid";
    const headers = {
      ...this.getAxiosConfig(proxyUrl),
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
      "Content-Type": `multipart/form-data`,
    };
    const leader = getRandomElement(settings.LEADERS);
    const members = getRandomElement(settings.MEMBERS);

    const data = {
      leader: leader,
      member: members,
      target: guildId.toString(),
    };

    try {
      const response = await axios.postForm(url, data, { headers });

      if (response.status === 200 && response.data.data) {
        const { isWin, moveWarbond, warbondPortion } = response.data.data;
        if (isWin) {
          this.log(`You win! | Receive coin: ${moveWarbond} | Receive portion ${warbondPortion} `, "success");
        } else {
          this.log(`You lost! | Lose coin: ${moveWarbond} | Lose portion ${warbondPortion} `, "warning");
        }
        await sleep(2);
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      this.log(`Can't play game: ${error.message} `, "error");
      return { success: false, error: error.message };
    }
  }

  async processTreasury(telegramInitData, proxyUrl) {
    const checkResult = await this.checkTreasuryRewards(telegramInitData, proxyUrl);
    if (!checkResult.success) {
      this.log(`Unable to check $War.Bond: ${checkResult.error}`, "error");
      return;
    }

    const { leftSecondsUntilTreasury, rewards } = checkResult.data;

    if (leftSecondsUntilTreasury === 0) {
      this.log("Claiming $War.Bond...", "info");
      const claimResult = await this.claimTreasuryRewards(telegramInitData, proxyUrl);

      if (claimResult.success) {
        const rewardAmount = claimResult.data.rewards[0].rewardAmount;
        this.log(`Successfully claimed ${rewardAmount} $War.Bond`, "success");
        this.log(`Time to wait for the next claim: ${claimResult.data.leftSecondsUntilTreasury} seconds`, "info");
      } else {
        this.log(`Unable to claim $War.Bond: ${claimResult.error}`, "error");
      }
    } else {
      this.log(`Not yet time to claim $War.Bond (remaining ${leftSecondsUntilTreasury} seconds)`, "warning");
    }
  }

  async checkCheckInStatus(telegramInitData, proxyUrl) {
    const url = "https://memes-war.memecore.com/api/quest/check-in";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.get(url, config);
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async performCheckIn(telegramInitData, proxyUrl) {
    const url = "https://memes-war.memecore.com/api/quest/check-in";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.post(url, {}, config);
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processGames(telegramInitData, guildId, proxyUrl) {
    let amount = 0;
    try {
      while (amount < settings.AMOUNT_ATTACK) {
        const guildStatus = await this.checkGuildStatus(telegramInitData, proxyUrl, guildId);
        await sleep(1);
        if (guildStatus.success) {
          this.log(`Guild ${guildStatus.data.name}: ${guildStatus.data.warbondTokens} $War.Bond`, "custom");
          if (guildStatus.data.warbondTokens < 2000000) {
            this.log(`Not enough ${guildStatus.data.warbondTokens} warbond tokens guild to guild raid`, "warning");
            return;
          }

          this.log(`Game ${amount + 1} | Starting find target...`);
          const target = await this.getGuildTarget(telegramInitData, proxyUrl);
          await sleep(2);
          if (target.success) {
            this.log(`Starting attack ${target.data.name} | rank:${target.data.warbondRank}...`);
            await sleep(5);
            await this.playGame(telegramInitData, target.data, proxyUrl);
          } else {
            this.log(`Can't not find target: ${target.error}...`, "warning");
          }
        }
        amount++;
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processCheckIn(telegramInitData, proxyUrl) {
    const checkResult = await this.checkCheckInStatus(telegramInitData, proxyUrl);
    if (!checkResult.success) {
      this.log(`Unable to check check-in status: ${checkResult.error}`, "error");
      return;
    }

    const { checkInRewards } = checkResult.data;
    const claimableReward = checkInRewards.find((reward) => reward.status === "CLAIMABLE");

    if (claimableReward) {
      this.log("Proceeding with check-in...", "info");
      const checkInResult = await this.performCheckIn(telegramInitData, proxyUrl);

      if (checkInResult.success) {
        const { currentConsecutiveCheckIn, rewards } = checkInResult.data;
        const rewardText = rewards
          .map((reward) => {
            if (reward.rewardType === "WARBOND") {
              return `${reward.rewardAmount} $War.Bond`;
            } else if (reward.rewardType === "HONOR_POINT") {
              return `${reward.rewardAmount} Honor Points`;
            }
            return `${reward.rewardAmount} ${reward.rewardType}`;
          })
          .join(" + ");

        this.log(`Check-in successful for day ${currentConsecutiveCheckIn} | Rewards: ${rewardText}`, "success");
      } else {
        this.log(`Check-in failed: ${checkInResult.error}`, "error");
      }
    } else {
      this.log("Already checked in today", "warning");
    }
  }

  async checkGuildStatus(telegramInitData, proxyUrl, guildId) {
    const url = `https://memes-war.memecore.com/api/guild/${guildId}`;
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.get(url, config);
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkFavoriteGuilds(telegramInitData, proxyUrl) {
    const url = "https://memes-war.memecore.com/api/guild/list/favorite?start=0&count=10";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.get(url, config);
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async favoriteGuild(telegramInitData, proxyUrl, guildId) {
    const url = "https://memes-war.memecore.com/api/guild/favorite";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.post(url, { guildId }, config);
      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async transferWarbondToGuild(telegramInitData, proxyUrl, guildId, warbondCount) {
    const url = "https://memes-war.memecore.com/api/guild/warbond";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.post(url, { guildId, warbondCount: parseInt(warbondCount) }, config);
      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processGuildOperations(telegramInitData, proxyUrl) {
    try {
      const userInfoResult = await this.getUserInfo(telegramInitData, proxyUrl);
      if (!userInfoResult.success) {
        this.log(`Unable to retrieve user information: ${userInfoResult.error}`, "warning");
        return;
      }
      const TARGET_GUILD_ID = settings.ID_MAIN_GUILD !== settings.GUILD_BONUS ? [settings.GUILD_BONUS, settings.ID_MAIN_GUILD] : [settings.ID_MAIN_GUILD];
      const listGuilds = [...TARGET_GUILD_ID];
      let bonus = Math.floor(Math.min(100, settings.BONUS));
      bonus = bonus < 5 ? 5 : bonus;
      const MIN_WARBOND_THRESHOLD = 1000;
      let initWarbondTokens = parseInt(userInfoResult.data.warbondTokens);
      let warbondTokens = initWarbondTokens;

      const { guildId } = userInfoResult.data;
      if (guildId && !listGuilds.includes(guildId) && !settings.TRANSFER_WARBOND_TO_MAIN_GUILD) listGuilds.push(guildId);

      for (const guildID of listGuilds) {
        await sleep(2);
        if (warbondTokens <= MIN_WARBOND_THRESHOLD) {
          this.log(`Insufficient $War.Bond balance (${warbondTokens}) to transfer`, "warning");
          return;
        }

        const guildStatus = await this.checkGuildStatus(telegramInitData, proxyUrl, guildID);
        if (guildStatus.success) {
          this.log(`Guild ${guildStatus.data.name}: ${guildStatus.data.warbondTokens} $War.Bond`, "custom");
        }
        await sleep(1);
        if (guildID === settings.GUILD_BONUS) {
          warbondTokens = Math.round(warbondTokens * (bonus / 100));
          const remainder = warbondTokens % 1000;
          if (remainder !== 0) {
            warbondTokens += 1000 - remainder;
          }

          if (warbondTokens < MIN_WARBOND_THRESHOLD) continue;
        } else if (guildStatus?.data?.warbondTokens < 200000 && guildID !== settings.GUILD_BONUS) {
          // warbondTokens = 200000;
        }

        const favoriteGuilds = await this.checkFavoriteGuilds(telegramInitData, proxyUrl);
        if (favoriteGuilds.success) {
          const isGuildFavorited = favoriteGuilds.data.guilds.some((guild) => guild.guildId === guildID);
          if (!isGuildFavorited) {
            this.log("Adding guild to favorites...", "info");
            await this.favoriteGuild(telegramInitData, proxyUrl, guildID);
          }
        }
        await sleep(1);
        this.log(`Transferring ${warbondTokens} $War.Bond to guild...`, "info");
        const transferResult = await this.transferWarbondToGuild(telegramInitData, proxyUrl, guildID, warbondTokens.toString());
        if (transferResult.success) {
          this.log(`Successfully transferred ${warbondTokens} $War.Bond`, "success");
          warbondTokens = initWarbondTokens - warbondTokens;
        } else {
          this.log(`Unable to transfer $War.Bond: ${transferResult.error}`, "error");
        }
      }
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
    }
  }

  async getQuests(telegramInitData, proxyUrl) {
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const [dailyResponse, singleResponse] = await Promise.all([
        axios.get("https://memes-war.memecore.com/api/quest/daily/list", config),
        axios.get("https://memes-war.memecore.com/api/quest/general/list", config),
      ]);

      if (dailyResponse.status === 200 && singleResponse.status === 200) {
        const dailyQuests = dailyResponse.data.data.quests.map((quest) => ({ ...quest, questType: "daily" }));
        const singleQuests = singleResponse.data.data.quests.map((quest) => ({ ...quest, questType: "general" }));

        return { success: true, data: [...dailyQuests, ...singleQuests] };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async submitQuestProgress(telegramInitData, proxyUrl, questType, questId) {
    const url = `https://memes-war.memecore.com/api/quest/${questType}/${questId}/progress`;
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.post(url, {}, config);
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processQuests(telegramInitData, proxyUrl) {
    const questsResult = await this.getQuests(telegramInitData, proxyUrl);
    if (!questsResult.success) {
      this.log(`Unable to retrieve quest list: ${questsResult.error}`, "error");
      return;
    }

    const pendingQuests = questsResult.data.filter((quest) => !settings.SKIP_TASKS.includes(quest.id) && quest.status === "GO");
    if (pendingQuests.length === 0) {
      this.log("No quests to complete", "warning");
      return;
    }

    for (const quest of pendingQuests) {
      this.log(`Completing quest ${quest.id}|${quest.title}`, "info");

      let result = await this.submitQuestProgress(telegramInitData, proxyUrl, quest.questType, quest.id);
      if (!result.success || result.data.status !== "VERIFY") {
        this.log(`Unable to complete quest ${quest.id}|${quest.title}: ${result.error || "Invalid status"}`, "error");
        continue;
      }

      await sleep(3);

      result = await this.submitQuestProgress(telegramInitData, proxyUrl, quest.questType, quest.id);
      if (!result.success || result.data.status !== "CLAIM") {
        this.log(`Unable to complete quest ${quest.id}|${quest.title}: ${result.error || "Invalid status"}`, "error");
        continue;
      }

      await sleep(5);

      result = await this.submitQuestProgress(telegramInitData, proxyUrl, quest.questType, quest.id);
      if (!result.success || result.data.status !== "DONE") {
        this.log(`Unable to complete quest ${quest.id}|${quest.title}: ${result.error || "Invalid status"}`, "error");
        continue;
      }

      const rewards = result.data.rewards
        .map((reward) => {
          if (reward.rewardType === "WARBOND") {
            return `${reward.rewardAmount} $War.Bond`;
          }
          return `${reward.rewardAmount} ${reward.rewardType}`;
        })
        .join(" + ");

      this.log(`Successfully completed quest ${quest.id}|${quest.title} | Rewards: ${rewards}`, "success");
    }
  }

  async checkPreorder(telegramInitData, proxyUrl) {
    const url = "https://memes-war.memecore.com/api/user/my/preorder";
    const config = {
      ...this.getAxiosConfig(proxyUrl),
      headers: {
        ...this.headers,
        cookie: `telegramInitData=${telegramInitData}`,
      },
    };

    try {
      const response = await axios.get(url, config);
      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async runAccount() {
    const initData = this.queryId;
    const userData = JSON.parse(decodeURIComponent(initData.split("user=")[1].split("&")[0]));
    const firstName = userData.first_name || "";
    const lastName = userData.last_name || "";
    const username = firstName + " " + lastName;
    const userId = userData.id;
    this.session_name = userId;
    let proxyUrl = this.proxy;
    const timesleep = getRandomNumber(settings.DELAY_START_BOT[0], settings.DELAY_START_BOT[1]);
    console.log(`=========Tài khoản ${this.accountIndex + 1} | ${username}| Nghỉ ${timesleep} trước khi bắt đầu=============`.green);
    this.#set_headers();
    const telegramInitData = encodeURIComponent(encodeURI(decodeURIComponent(initData)));
    await sleep(timesleep);
    try {
      this.proxyIp = await this.checkProxyIP(proxyUrl);
    } catch (error) {
      this.log(`Error checking proxy IP: ${error.message}`, "error");
      return;
    }

    // console.log(telegramInitData);
    // process.exit(0);
    try {
      const userInfoResult = await this.getUserInfo(telegramInitData, proxyUrl);
      if (userInfoResult.success) {
        const { honorPoints, warbondTokens, honorPointRank, guildId } = userInfoResult.data;
        this.log(`Honor Points: ${honorPoints}`, "success");
        this.log(`Warbond Tokens: ${warbondTokens}`, "success");
        this.log(`Honor Point Rank: ${honorPointRank}`, "success");

        // if (!guildId) {
        //   await this.createGuild(telegramInitData, userInfoResult.data, proxyUrl);
        // }
        // process.exit(0);

        await sleep(3);
        await this.processCheckIn(telegramInitData, proxyUrl);
        await sleep(3);
        await this.processTreasury(telegramInitData, proxyUrl);
        if (settings.AUTO_TASK) {
          await sleep(3);
          await this.processQuests(telegramInitData, proxyUrl);
        }
        await sleep(3);
        await this.processGuildOperations(telegramInitData, proxyUrl);

        if (settings.AUTO_PLAY_GAME && guildId) {
          await sleep(2);
          await this.processGames(telegramInitData, guildId, proxyUrl);
        }
      } else {
        this.log(`Unable to retrieve user information: ${userInfoResult.error}`, "error");
      }
    } catch (error) {
      this.log(`Error processing account ${firstName}: ${error.message}`, "error");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function runWorker(workerData) {
  const { queryId, accountIndex, proxy } = workerData;
  const to = new MemesWar(queryId, accountIndex, proxy);
  try {
    await Promise.race([to.runAccount(), new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 60 * 60 * 1000))]);
    parentPort.postMessage({
      accountIndex,
    });
  } catch (error) {
    parentPort.postMessage({ accountIndex, error: error.message });
  }
}

async function main() {
  const queryIds = loadData("data.txt");
  const proxies = loadData("proxy.txt");
  // const agents = #load_session_data();

  if (queryIds.length > proxies.length) {
    console.log("Số lượng proxy và data phải bằng nhau.".red);
    console.log(`Data: ${queryIds.length}`);
    console.log(`Proxy: ${proxies.length}`);
    process.exit(1);
  }
  console.log("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)".yellow);
  let maxThreads = settings.MAX_THEADS;

  queryIds.map((val, i) => new MemesWar(val, i, proxies[i]).createUserAgent());

  sleep(1);
  while (true) {
    let currentIndex = 0;
    const errors = [];

    while (currentIndex < queryIds.length) {
      const workerPromises = [];
      const batchSize = Math.min(maxThreads, queryIds.length - currentIndex);
      for (let i = 0; i < batchSize; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            queryId: queryIds[currentIndex],
            accountIndex: currentIndex,
            proxy: proxies[currentIndex % proxies.length],
          },
        });

        workerPromises.push(
          new Promise((resolve) => {
            worker.on("message", (message) => {
              if (message.error) {
                errors.push(`Tài khoản ${message.accountIndex}: ${message.error}`);
              }
              // console.log(`Tài khoản ${message.accountIndex}: ${message.error}`);
              resolve();
            });
            worker.on("error", (error) => {
              errors.push(`Lỗi worker cho tài khoản ${currentIndex}: ${error.message}`);
              // console.log(`Lỗi worker cho tài khoản ${currentIndex}: ${error.message}`);
              resolve();
            });
            worker.on("exit", (code) => {
              if (code !== 0) {
                errors.push(`Worker cho tài khoản ${currentIndex} thoát với mã: ${code}`);
              }
              resolve();
            });
          })
        );

        currentIndex++;
      }

      await Promise.all(workerPromises);

      if (errors.length > 0) {
        errors.length = 0;
      }

      if (currentIndex < queryIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    const to = new MemesWar(null, 0, proxies[0]);
    await sleep(3);
    console.log("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)".yellow);
    console.log(`=============Hoàn thành tất cả tài khoản=============`.magenta);
    await to.countdown(settings.TIME_SLEEP * 60);
  }
}

if (isMainThread) {
  main().catch((error) => {
    console.log("Lỗi rồi:", error);
    process.exit(1);
  });
} else {
  runWorker(workerData);
}
