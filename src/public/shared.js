"use strict";

/* -------- Global const -------- */

var MAX_CLOCK_TIME = 60 * 30;

var STATE_DEFAULT = 1, // 0x 00000001
  STATE_PLAYER = 2, // 0x 00000010
  STATE_WALL = 4, // 0x 00000100
  STATE_DYNAMITE = 8, // 0x 00001000
  STATE_RHUM = 16, // 0x 00100000
  STATE_MONEY = 32; // 0x 01000000

var bonusMapState = [STATE_RHUM, STATE_MONEY];

var MOVE_UP = "up",
  MOVE_DOWN = "down",
  MOVE_RIGHT = "right",
  MOVE_LEFT = "left";

var GAME_EVENT_CREATE = "ge_create",
  GAME_EVENT_CREATED = "ge_created",
  GAME_EVENT_LIST = "ge_list",
  GAME_EVENT_LISTED = "ge_listed",
  GAME_EVENT_JOIN = "ge_join",
  // GAME_EVENT_JOINED = "ge_joined",
  // GAME_EVENT_EDIT = "ge_edit",
  GAME_EVENT_EDITED = "pe_update", // for now, GAME_EVENT_EDITED === PLAY_EVENT_UPDATE to make ui management easier
  // GAME_EVENT_SETUP = "ge_setup",
  GAME_EVENT_START = "ge_start",
  GAME_EVENT_STARTED = "ge_started",
  GAME_EVENT_FINISHED = "ge_finished";
  // GAME_EVENT_PLAYER_FINISHED = "ge_pfinished";

  var PLAY_EVENT_MOVE = "pe_move",
    PLAY_EVENT_APPLY = "pe_apply",
    PLAY_EVENT_UPDATE = "pe_update",
    PLAY_EVENT_WIN = "pe_win",
    PLAY_EVENT_LOST = "pe_lost";

/// @TODO
// var P_MOD_EVERY_ONE_FOR_HIMSELF = "pm_e4h",
//   P_MOD_TWO_BY_DUNGEON = "pm_2bd",
//   P_MOD_VERSUS = "pm_ver";

var G_STATUS_SETUP = "gs_setup",
  G_STATUS_RUNNING = "gs_running",
  G_STATUS_FINISHED = "gs_finished";

var D_STATUS_SETUP = "ds_setup",
  D_STATUS_READY = "ds_ready",
  D_STATUS_PLAYING = "ds_playing",
  D_STATUS_WON = "ds_won",
  D_STATUS_LOST = "ds_lost";


/* -------- Global const end -------- */


/* -------- General Functions -------- */

/**
 * Find element by id in an array
 * @param {Array} array
 * @param {id} id
 * @return {element|undefined} 
 */
function find(array, id) {
  var index = findIndex(array, id);
  return (index !== undefined) ? array[index] : index;
}

/**
 * Find element index by id
 * @param {Array} array
 * @param {id} id
 * @return {Number|undefined} 
 */
function findIndex(array, id) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].id === id) return i;
  }
  return undefined;
}

/* -------- End General Functions -------- */



/* -------- Area Class -------- */

/**
 * Area Class
 * 
 * @param {Int} columns
 * @param {Int} rows
 * 
 * @notice Please be carefull with indexes x et y are inversed according common sens in states storage object
 */
function Area(columns, rows) {
  this.reset(columns, rows);
}

Area.prototype = {
  reset: function (columns, rows) {
    this.columns = columns || 0;
    this.rows = rows || 0;
    this.states = [];
    for(var row = 0; row < this.rows; row++) {
      this.states.push([]);
      for(var column = 0; column < this.columns; column++) {
        this.states[row].push({state: STATE_DEFAULT});
      }
    }
  },
  getState: function (x, y) {
    return this.states[y][x].state;
  },
  setState: function (x, y, state) {
    this.states[y][x].state = state;
  },
  toJSON: function() {
    return {
      columns: this.columns,
      rows: this.rows,
      states: this.states,
    }
  }
}

/* -------- End Area Class -------- */



/* -------- Config Class -------- */

/**
 * Config Class
 * @param {Config} Config
 */
function Config(config) {
  this.fromJSON(config);
}

Config.prototype = {
  // override if given; initialize with default value if not given and not defined 
  fromJSON: function (config) {
    config = config || {};
    this.dynamiteFeedback = config.dynamiteFeedback || (this.dynamiteFeedback || 3);
    this.dynamiteCost = config.dynamiteCost || (this.dynamiteCost || 15);
    this.wallCost = config.wallCost || (this.wallCost || 5);
    this.timeLimit = config.timeLimit || (this.timeLimit || 5);
    this.timeLimitMalus = config.timeLimitMalus || (this.timeLimitMalus || 1);
    this.bonusInterval = config.bonusInterval || (this.bonusInterval || 5);
    this.rhumBonusValue = config.rhumBonusValue || (this.rhumBonusValue || 10);
    this.moneyBonusValue = config.moneyBonusValue || (this.moneyBonusValue || 15);
    this.areaColumns = config.areaColumns || (this.areaColumns || 11);
    this.areaRows = config.areaRows || (this.areaRows || 15);
  },
  toJSON: function () {
    return {
      dynamiteFeedback: this.dynamiteFeedback,
      dynamiteCost: this.dynamiteCost,
      wallCost: this.wallCost,
      timeLimit: this.timeLimit,
      timeLimitMalus: this.timeLimitMalus,
      bonusInterval: this.bonusInterval,
      rhumBonusValue: this.rhumBonusValue,
      moneyBonusValue: this.moneyBonusValue,
      areaColumns: this.areaColumns,
      areaRows: this.areaRows,
    }
  }
}

/* -------- End Area Class -------- */