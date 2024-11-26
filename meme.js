const fs = require("fs");
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const printLogo = require("./src/logo");
const header = require("./src/header");
const log = require("./src/logger");
const user_agents = require("./config/userAgents");
const settings = require("./config/config");
const { loadData, sleep, getRandomElement } = require("./utils");
const FormData = require("form-data");

class MemesWar {
  constructor() {
    this.headers = header;
    this.log = log;
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

  async getUserInfo(telegramInitData) {
    const url = "https://memes-war.memecore.com/api/user";
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };
    let retries = 3;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, { headers });
        if (response.status === 200 && response.data.data) {
          const userData = response.data.data.user;
          const { honorPoints, warbondTokens, honorPointRank, inputReferralCode } = userData;

          if (!inputReferralCode) {
            try {
              await axios.put("https://memes-war.memecore.com/api/user/referral/YTT9ZV", {}, { headers });
            } catch (referralError) {
              this.log(`Unable to enter referral code: ${referralError.message}`, "error");
            }
          }

          return { success: true, data: userData };
        } else {
          return { success: false, error: "Invalid response format" };
        }
      } catch (error) {
        if (retries < 3 && error.status === 500) {
          this.log(`Unable to get user information, trying again...${retries + 1}/3`);
          retries++;
          await sleep(1);
          await getUserInfo(telegramInitData);
        } else return { success: false, error: error.message };
      }
    }
  }

  async checkTreasuryRewards(telegramInitData) {
    const url = "https://memes-war.memecore.com/api/quest/treasury/rewards";
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.get(url, { headers });
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async claimTreasuryRewards(telegramInitData) {
    const url = "https://memes-war.memecore.com/api/quest/treasury";
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.post(url, {}, { headers });
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createGuild(telegramInitData, userInfoResult) {
    const url = "https://memes-war.memecore.com/api/raid";
    const avatarPath = path.join(__dirname, "/images/avatar.jpg");

    // const thumbnailBuffer = fs.readFileSync(avatarPath);
    // const thumbnailBase64 = thumbnailBuffer.toString("base64");
    // const image = await Jimp.read(avatarPath);
    // const thumbnailBase64 = image.getBuffer();
    // console.log(image);

    const formData = new FormData();
    const imageBuffer = fs.readFileSync(avatarPath);
    formData.append("thumbnail", imageBuffer, {
      filename: "avatar.jpg",
      contentType: "image/jpeg",
    });
    formData.append("name", userInfoResult.nickname);
    formData.append("ticker", userInfoResult.nickname);

    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
      "Content-Type": "multipart/form-data",
      ...formData.getHeaders(),
    };

    // const data = {
    //   name: userInfoResult.nickname,
    //   ticker: userInfoResult.nickname,
    //   thumbnail: "",
    // };

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

  async getGuildTarget(telegramInitData) {
    const url = "https://memes-war.memecore.com/api/raid";
    const headers = {
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

  async playGame(telegramInitData, target) {
    const { guildId } = target;
    if (!guildId) return;
    const url = "https://memes-war.memecore.com/api/raid";
    const headers = {
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

  async processTreasury(telegramInitData) {
    const checkResult = await this.checkTreasuryRewards(telegramInitData);
    if (!checkResult.success) {
      this.log(`Unable to check $War.Bond: ${checkResult.error}`, "error");
      return;
    }

    const { leftSecondsUntilTreasury, rewards } = checkResult.data;

    if (leftSecondsUntilTreasury === 0) {
      this.log("Claiming $War.Bond...", "info");
      const claimResult = await this.claimTreasuryRewards(telegramInitData);

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

  async checkCheckInStatus(telegramInitData) {
    const url = "https://memes-war.memecore.com/api/quest/check-in";
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.get(url, { headers });
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async performCheckIn(telegramInitData) {
    const url = "https://memes-war.memecore.com/api/quest/check-in";
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.post(url, {}, { headers });
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processGames(telegramInitData, guildId) {
    let amount = 0;
    try {
      while (amount < settings.AMOUNT_ATTACK) {
        const guildStatus = await this.checkGuildStatus(telegramInitData, guildId);
        await sleep(2);
        if (guildStatus.success) {
          this.log(`Guild ${guildStatus.data.name}: ${guildStatus.data.warbondTokens} $War.Bond`, "custom");
          if (guildStatus.data.warbondTokens < 2000000) {
            this.log(`Not enough ${guildStatus.data.warbondTokens} warbond tokens guild to guild raid`, "warning");
            return;
          }

          this.log(`Game ${amount + 1} | Starting find target...`);
          const target = await this.getGuildTarget(telegramInitData);
          await sleep(2);
          if (target.success) {
            this.log(`Starting attack ${target.data.name} | rank:${target.data.warbondRank}...`);
            await sleep(5);
            await this.playGame(telegramInitData, target.data);
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

  async processCheckIn(telegramInitData) {
    const checkResult = await this.checkCheckInStatus(telegramInitData);
    if (!checkResult.success) {
      this.log(`Unable to check check-in status: ${checkResult.error}`, "error");
      return;
    }

    const { checkInRewards } = checkResult.data;
    const claimableReward = checkInRewards.find((reward) => reward.status === "CLAIMABLE");

    if (claimableReward) {
      this.log("Proceeding with check-in...", "info");
      const checkInResult = await this.performCheckIn(telegramInitData);

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

  async checkGuildStatus(telegramInitData, guildId) {
    const url = `https://memes-war.memecore.com/api/guild/${guildId}`;
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.get(url, { headers });
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkFavoriteGuilds(telegramInitData) {
    const url = "https://memes-war.memecore.com/api/guild/list/favorite?start=0&count=10";
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.get(url, { headers });
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async favoriteGuild(telegramInitData, guildId) {
    const url = "https://memes-war.memecore.com/api/guild/favorite";
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.post(url, { guildId }, { headers });
      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async transferWarbondToGuild(telegramInitData, guildId, warbondCount) {
    const url = "https://memes-war.memecore.com/api/guild/warbond";
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.post(url, { guildId, warbondCount }, { headers });
      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processGuildOperations(telegramInitData) {
    try {
      const userInfoResult = await this.getUserInfo(telegramInitData);
      if (!userInfoResult.success) {
        this.log(`Unable to retrieve user information: ${userInfoResult.error}`, "error");
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
      // console.log(userInfoResult, listGuilds);
      for (const elementGuildID of listGuilds) {
        await sleep(2);
        if (warbondTokens <= MIN_WARBOND_THRESHOLD) {
          this.log(`Insufficient $War.Bond balance (${warbondTokens}) to transfer`, "warning");
          return;
        }

        const guildStatus = await this.checkGuildStatus(telegramInitData, elementGuildID);
        if (guildStatus.success) {
          this.log(`Guild ${guildStatus.data.name}: ${guildStatus.data.warbondTokens} $War.Bond`, "custom");
        }
        await sleep(1);
        if (elementGuildID === settings.GUILD_BONUS) {
          warbondTokens = Math.round(warbondTokens * (bonus / 100));
          const remainder = warbondTokens % 1000;
          if (remainder !== 0) {
            warbondTokens += 1000 - remainder;
          }

          if (warbondTokens < MIN_WARBOND_THRESHOLD) continue;
        } else if (guildStatus?.data?.warbondTokens < 200000 && elementGuildID !== settings.GUILD_BONUS) {
          // warbondTokens = 200000;
        }

        const favoriteGuilds = await this.checkFavoriteGuilds(telegramInitData);
        if (favoriteGuilds.success) {
          const isGuildFavorited = favoriteGuilds.data.guilds.some((guild) => guild.guildId === elementGuildID);
          if (!isGuildFavorited) {
            this.log("Adding guild to favorites...", "info");
            await this.favoriteGuild(telegramInitData, elementGuildID);
          }
        }
        await sleep(1);
        this.log(`Transferring ${warbondTokens} $War.Bond to guild...`, "info");
        const transferResult = await this.transferWarbondToGuild(telegramInitData, elementGuildID, warbondTokens);
        if (transferResult.success) {
          this.log(`Successfully transferred ${warbondTokens} $War.Bond`, "success");
          warbondTokens = initWarbondTokens - warbondTokens;
        } else {
          this.log(`Unable to transfer $War.Bond: ${transferResult.error}`, "error");
        }
      }
      process.exit(0);
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
    }
  }

  async getQuests(telegramInitData) {
    try {
      const [dailyResponse, singleResponse] = await Promise.all([
        axios.get("https://memes-war.memecore.com/api/quest/daily/list", {
          headers: { ...this.headers, cookie: `telegramInitData=${telegramInitData}` },
        }),
        axios.get("https://memes-war.memecore.com/api/quest/general/list", {
          headers: { ...this.headers, cookie: `telegramInitData=${telegramInitData}` },
        }),
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

  async submitQuestProgress(telegramInitData, questType, questId) {
    const url = `https://memes-war.memecore.com/api/quest/${questType}/${questId}/progress`;
    const headers = {
      ...this.headers,
      cookie: `telegramInitData=${telegramInitData}`,
    };

    try {
      const response = await axios.post(url, {}, { headers });
      if (response.status === 200 && response.data.data) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: "Invalid response format" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processQuests(telegramInitData) {
    const questsResult = await this.getQuests(telegramInitData);
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
      this.log(`Completing quest ${quest.title}`, "info");

      let result = await this.submitQuestProgress(telegramInitData, quest.questType, quest.id);
      if (!result.success || result.data.status !== "VERIFY") {
        this.log(`Unable to complete quest ${quest.title}: ${result.error || "Invalid status"}`, "error");
        continue;
      }

      await sleep(3);

      result = await this.submitQuestProgress(telegramInitData, quest.questType, quest.id);
      if (!result.success || result.data.status !== "CLAIM") {
        this.log(`Unable to complete quest ${quest.title}: ${result.error || "Invalid status"}`, "error");
        continue;
      }

      await sleep(3);

      result = await this.submitQuestProgress(telegramInitData, quest.questType, quest.id);
      if (!result.success || result.data.status !== "DONE") {
        this.log(`Unable to complete quest ${quest.title}: ${result.error || "Invalid status"}`, "error");
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

      this.log(`Successfully completed quest ${quest.title} | Rewards: ${rewards}`, "success");
    }
  }

  async main() {
    console.log("JOIN : (https://t.me/D4rkCipherX)".yellow);
    const dataFile = path.join(__dirname, "data.txt");
    const data = fs.readFileSync(dataFile, "utf8").replace(/\r/g, "").split("\n").filter(Boolean);

    while (true) {
      for (let i = 0; i < data.length; i++) {
        const initData = data[i];
        const userData = JSON.parse(decodeURIComponent(initData.split("user=")[1].split("&")[0]));
        const userId = userData.id;
        const firstName = userData.first_name || "";
        const lastName = userData.last_name || "";
        const username = firstName + " " + lastName;
        this.session_name = userId;
        console.log(`========== Account ${i + 1} | ${username} ==========`);
        await this.#set_headers();
        const telegramInitData = encodeURIComponent(encodeURI(decodeURIComponent(initData)));

        // console.log(telegramInitData);
        // process.exit(0);
        const userInfoResult = await this.getUserInfo(telegramInitData);
        if (userInfoResult.success) {
          const { honorPoints, warbondTokens, honorPointRank, guildId } = userInfoResult.data;
          this.log(`Honor Points: ${honorPoints}`, "success");
          this.log(`Warbond Tokens: ${warbondTokens}`, "success");
          this.log(`Honor Point Rank: ${honorPointRank}`, "success");
          await sleep(2);
          await this.processCheckIn(telegramInitData);
          await sleep(2);
          await this.processTreasury(telegramInitData);
          if (settings.AUTO_TASK) {
            await sleep(2);
            await this.processQuests(telegramInitData);
          }

          // if (!guildId) {
          //   await this.createGuild(telegramInitData, userInfoResult.data);
          // }
          // process.exit(0);

          await sleep(2);
          await this.processGuildOperations(telegramInitData);

          if (settings.AUTO_PLAY_GAME && guildId) {
            await sleep(2);
            await this.processGames(telegramInitData, guildId);
          }
        } else {
          this.log(`Unable to retrieve user information: ${userInfoResult.error}`, "error");
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      await this.countdown(settings.TIME_SLEEP * 60);
    }
  }
}

const client = new MemesWar();
client.main().catch((err) => {
  client.log(err.message, "error");
  process.exit(1);
});
