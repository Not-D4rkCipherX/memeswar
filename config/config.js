require("dotenv").config();
const { _isArray } = require("../utils.js");

const settings = {
  TIME_SLEEP: process.env.TIME_SLEEP ? parseInt(process.env.TIME_SLEEP) : 8,
  MAX_THEADS: process.env.MAX_THEADS ? parseInt(process.env.MAX_THEADS) : 10,
  AMOUNT_ATTACK: process.env.AMOUNT_ATTACK ? parseInt(process.env.AMOUNT_ATTACK) : 10,
  SKIP_TASKS: process.env.SKIP_TASKS ? JSON.parse(process.env.SKIP_TASKS.replace(/'/g, '"')) : [],
  LEADERS: process.env.LEADERS ? JSON.parse(process.env.LEADERS.replace(/'/g, '"')) : ["floki", "ant", "cz", "pepe", "elon", "wif"],
  MEMBERS: process.env.MEMBERS ? JSON.parse(process.env.MEMBERS.replace(/'/g, '"')) : ["archer", "police", "solder", "ninja"],
  AUTO_TASK: process.env.AUTO_TASK ? process.env.AUTO_TASK.toLowerCase() === "true" : false,
  AUTO_CREATE_USER_AGENT: process.env.AUTO_CREATE_USER_AGENT ? process.env.AUTO_CREATE_USER_AGENT.toLowerCase() === "true" : false,
  AUTO_JOIN_GUILD: process.env.AUTO_JOIN_GUILD ? process.env.AUTO_JOIN_GUILD.toLowerCase() === "true" : false,
  GUILD_BONUS: "",
  AUTO_PLAY_GAME: process.env.AUTO_PLAY_GAME ? process.env.AUTO_PLAY_GAME.toLowerCase() === "true" : false,
  CONNECT_WALLET: process.env.CONNECT_WALLET ? process.env.CONNECT_WALLET.toLowerCase() === "true" : false,
  TRANSFER_WARBOND_TO_MAIN_GUILD: process.env.TRANSFER_WARBOND_TO_MAIN_GUILD ? process.env.TRANSFER_WARBOND_TO_MAIN_GUILD.toLowerCase() === "true" : false,
  BONUS: process.env.BONUS ? parseInt(process.env.BONUS) : 50,
  ID_MAIN_GUILD: process.env.ID_MAIN_GUILD ? process.env.ID_MAIN_GUILD : "",
  DELAY_BETWEEN_REQUESTS: process.env.DELAY_BETWEEN_REQUESTS && _isArray(process.env.DELAY_BETWEEN_REQUESTS) ? JSON.parse(process.env.DELAY_BETWEEN_REQUESTS) : [1, 5],
  DELAY_START_BOT: process.env.DELAY_START_BOT && _isArray(process.env.DELAY_START_BOT) ? JSON.parse(process.env.DELAY_START_BOT) : [1, 15],
  DELAY_MINI_GAME_EGG: process.env.DELAY_MINI_GAME_EGG && _isArray(process.env.DELAY_MINI_GAME_EGG) ? JSON.parse(process.env.DELAY_MINI_GAME_EGG) : [3, 5],
};

module.exports = settings;
