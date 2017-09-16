"use strict";

/* -------- Global const -------- */

var MAX_CLOCK_TIME = 60 * 30;

// CS : Cell Stats
var CS_DEFAULT  = 1,   // 0x 00000001
    CS_PLAYER   = 2,   // 0x 00000010
    CS_WALL     = 4,   // 0x 00000100
    CS_DYNAMITE = 8,   // 0x 00001000
    CS_RHUM     = 16,  // 0x 00010000
    CS_MONEY    = 32,  // 0x 00100000
    CS_BOUM     = 64;  // 0x 01000000

var bonusMapState = [CS_RHUM, CS_MONEY];

var MOVE_UP = "up",
  MOVE_DOWN = "down",
  MOVE_RIGHT = "right",
  MOVE_LEFT = "left";

// GR : Game Request 
// REQUEST = client -> server event
var GR_CREATE = "gr_create",
    GR_LIST = "gr_list",
    GR_JOIN = "gr_join",
    GR_START = "gr_start";

// PR : Play Request
var PR_MOVE = "pr_move",
    PR_APPLY = "pr_apply";

// GE : Game Event
// EVENT = server -> client event
// GAME event main payload is game.toJSON
var GE_CREATE = "ge_create",
    GE_LIST = "ge_list",
    GE_EDIT = "ge_update",
    GE_START = "ge_start",
    GE_FINISH = "ge_finish";

// DE : Dungeon Event
// DUNGEON event main payload is dungeon.toJSON
var DE_JOIN = "de_join",
    DE_LEAVE = "de_leave",
    DE_WIN = "de_win",
    DE_LOST = "de_lost";

// GS : Game Status
var GS_SETUP = "gs_setup",
    GS_RUNNING = "gs_running",
    GS_FINISHED = "gs_finished";

// DS : Dungeon Status
var DS_SETUP = "ds_setup",
    DS_READY = "ds_ready",
    DS_PLAYING = "ds_playing",
    DS_WON = "ds_won",
    DS_LOST = "ds_lost";


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
