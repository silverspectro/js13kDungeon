"use strict";

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

/**
 * Apply style to an elements
 * @param {DOMElement} element 
 * @param {Object} style 
 */
function applyStyleOn(element, style) {
  for (var key in style) {
    element.style[key] = style[key];
  }
};

/**
 * Apply attributes to an elements
 * @param {DOMElement} element 
 * @param {Object} attributes 
 */
function applyAttributesOn(element, attributes) {
  for (var key in attributes) {
    element.setAttribute(key, attributes[key]);
  }
};

function createUIElement(type, attributes, events) {
  var element = document.createElement(type);
  attributes = attributes || {};
  events = events || {};

  applyAttributesOn(element, attributes);

  for (var event in events) {
    element.addEventListener(event, events[event]);
  }

  return element;
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
    'Wall',
    'Trap',
  ];
}

Game.prototype = {
  stop: function () {
    this.started = false;
  },
  start: function () {
    if (!this.started) {
      this.started = new Date().now;
    }
  },
  applyModifiers: function (key, dungeon) {
    return dungeon.config[key] + dungeon.modifiers[key];
  },
  removeDungeon: function (dungeonId) {
    var dungeonIndex = findIndex(this.dungeons, dungeonId);
    if (dungeonIndex) { this.dungeons.splice(index, 1); }
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
      var isReady = false;
      for (var i = 0; i < this.dungeons.length; i++) {
        isReady = this.dungeons[i].player.ready;
        if (isReady === false) break;
      }
      if (isReady) this.start();
    }
  },
  updateGame: function (game) {
    this.options = game.options;
    this.updateDungeons(game.dungeons);
    this.checkReady();
  },
  /// @TODO review this function completly
  updateDungeons: function (dungeons) {
    var self = this;
    var maxIndex = Math.max(Math.max(self.dungeons.length - 1, dungeons.length - 1), 0);
    var dungeonsToAdd = [];

    function treatDungeons(index) {
      
      if (index < 0) { return; } 

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
