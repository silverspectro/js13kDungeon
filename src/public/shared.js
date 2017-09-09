"use strict";

/* -------- Global const -------- */

var STATE_DEFAULT  = 1;   // 0x 00000001
var STATE_PLAYER   = 2;   // 0x 00000010
var STATE_WALL     = 4;   // 0x 00000100
var STATE_DYNAMITE = 8;   // 0x 00001000
var STATE_RHUM     = 16;  // 0x 00010000
var STATE_MONEY    = 32;  // 0x 00100000
var STATE_BOUM     = 64;  // 0x 01000000

var bonusMapState = [STATE_RHUM, STATE_MONEY];

var MOVE_UP         = "up";
var MOVE_DOWN       = "down";
var MOVE_RIGHT      = "right";
var MOVE_LEFT       = "left";


/* -------- Global const end -------- */


/* -------- General Functions -------- */

/**
 * Remove an element from an array
 * @param {array} array
 * @param {element} element
 */
function remove(array, element) {
  array.splice(array.indexOf(element), 1);
}

/**
 * Find element by id in an array
 * @param {Array} array
 * @param {id} id
 * @return {element|undefined} 
 */
function find(array, id) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].id === id) return array[i];
  }
  return undefined;
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


/* -------- Game Class -------- */

/**
 * Game Class
 * @param {socket} socket
 */
function Game(socket, options) {
  this.room = socket;
  this.id = this.room.id;
  this.dungeons = [];
  this.started = false;
  this.time = 0;
  this.options = options || [
    STATE_WALL,
    STATE_DYNAMITE,
  ];
}

Game.prototype = {
  stop: function () {
    this.started = false;
  },
  start: function () {
    if (!this.started) {
      this.started = true;
    }
  },
  applyModifiers: function (key, dungeon) {
    return dungeon.config[key] + dungeon.modifiers[key];
  },
  removeDungeon: function (dungeonId) {
    var dungeonIndex = findIndex(this.dungeons, dungeonId);
    if (dungeonIndex >= 0) {
      this.dungeons.splice(dungeonIndex, 1);
    }
  },
  addDungeon: function (dungeon) {
    var refDungeon = find(this.dungeons, dungeon.id);
    if (!refDungeon) this.dungeons.push(dungeon);
    else {
      console.warn(dungeon.id + ' already exists in this game.');
    }
  },
  checkReady: function () {
    if (!this.started) {
      for (var i = 0; i < this.dungeons.length; i++) {
        if (this.dungeons[i].player.ready === false) return false;
      }
      // all dungeons are ready
      this.start();
      return true;
    }
    return false;
  },
  updateGame: function (game) {
    this.options = game.options;
    this.updateDungeons(game.dungeons);
  },
  /// @TODO review this function completly
  updateDungeons: function (dungeons) {
    var self = this;
    var maxIndex = Math.max(Math.max(self.dungeons.length - 1, dungeons.length - 1), 0);
    var dungeonsToAdd = [];

    function treatDungeons(index) {

      if (index < 0) {
        return;
      }

      var dungeon = dungeons[index];
      var refDungeon = dungeon ? find(self.dungeons, dungeon.id) : undefined;

      if (refDungeon && dungeon && refDungeon.id === dungeon.id) {
        refDungeon.area = dungeon.area;
        refDungeon.life = dungeon.life;
        refDungeon.money = dungeon.money;
        refDungeon.player = dungeon.player;
      } else if (!refDungeon && dungeon) {
        self.dungeons.push(dungeon);
      } else if (self.dungeons[index] && !dungeon && !find(dungeons, self.dungeons[index].id)) {
        var deletedDungeon = self.dungeons.splice(index, 1)[0];
        self.dungeonsUI.splice(index, 1);
      }

      treatDungeons(index--);
    }

    treatDungeons(maxIndex);
  },

  toJSON: function () {
    return {
      id: this.id,
      time: this.time,
      started: this.started,
      dungeons: this.dungeons.map(function (dungeon) {
        return dungeon.toJSON ? dungeon.toJSON() : dungeon;
      }),
      options: this.options,
    }
  }
}

/* -------- End Game Class -------- */



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
