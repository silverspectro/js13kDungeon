"use strict";

/* -------- Global const -------- */

var MAX_CLOCK_TIME = 60 * 30;

var STATE_DEFAULT  = 1,   // 0x 00000001
    STATE_PLAYER   = 2,   // 0x 00000010
    STATE_WALL     = 4,   // 0x 00000100
    STATE_DYNAMITE = 8,   // 0x 00001000
    STATE_RHUM     = 16,  // 0x 00010000
    STATE_MONEY    = 32,  // 0x 00100000
    STATE_BOUM     = 64;  // 0x 01000000

var bonusMapState = [STATE_RHUM, STATE_MONEY];

var MOVE_UP = "up",
  MOVE_DOWN = "down",
  MOVE_RIGHT = "right",
  MOVE_LEFT = "left";

// REQUEST = client -> server event
var GAME_REQUEST_CREATE = "gr_create",
    GAME_REQUEST_LIST = "gr_list",
    GAME_REQUEST_JOIN = "gr_join",
    GAME_REQUEST_START = "gr_start";

var PLAY_REQUEST_MOVE = "pr_move",
    PLAY_REQUEST_APPLY = "pr_apply";

// EVENT = server -> client event
// GAME event main payload is game.toJSON
var GAME_EVENT_CREATE = "ge_create",
    GAME_EVENT_LIST = "ge_list",
    GAME_EVENT_EDIT = "ge_update",
    GAME_EVENT_START = "ge_start",
    GAME_EVENT_FINISH = "ge_finish";

// DUNGEON event main payload is dungeon.toJSON
var DUNGEON_EVENT_JOIN = "de_join",
    DUNGEON_EVENT_LEAVE = "de_leave",
    DUNGEON_EVENT_WIN = "de_win",
    DUNGEON_EVENT_LOST = "de_lost";

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
