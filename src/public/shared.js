"use strict";

/* -------- Global const -------- */

var MAX_CLOCK_TIME = 60 * 30;

var STD  = 1,   // 0x 00000001
    SPL   = 2,   // 0x 00000010
    SWL     = 4,   // 0x 00000100
    STDY = 8,   // 0x 00001000
    STRH     = 16,  // 0x 00010000
    STMO    = 32,  // 0x 00100000
    STBM     = 64;  // 0x 01000000

var bonusMapState = [STRH, STMO];

var MUP = "up",
  MDW = "down",
  MRH = "right",
  MLT = "left";

var GECD = "ge_create",
  GECDD = "ge_created",
  GELD = "ge_list",
  GELDED = "ge_listed",
  GEEDT = "pe_update", // for now, GEEDT === PEEU to make ui management easier
  GESTD = "ge_start",
  GESTDED = "ge_started",
  GEFD = "ge_finished",
  GELV = "ge_leave",
  GEJN = "ge_join";

  var PEMV = "pe_move",
    PEAP = "pe_apply",
    PEEU = "pe_update",
    PLAY_EVENT_WIN = "pe_win",
    PELS = "pe_lost";

var G_STATUS_SETUP = "gs_setup",
  G_STATUS_RUNNING = "gs_running",
  G_STATUS_FINISHED = "gs_finished";

var D_STATUS_SETUP = "ds_setup",
  D_STATUS_READY = "ds_ready",
  D_STATUS_PLAYING = "ds_playing",
  DSW = "ds_won",
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
