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

/* -------- End General Functions -------- */

/* -------- Game Class -------- */

	/**
	 * Game Class
	 * @param {socket} socket
	 */
	function Game(socket) {
		this.room = socket;
		this.id = this.room.id;
		this.dungeons = [];
	}

	Game.prototype = {
    removeDungeon: function(dungeonId) {
      var dungeon = find(this.dungeons, dungeonId);
      if (dungeon) var index = this.dungeons.indexOf(dungeon);
      if (index >= 0) {
        this.dungeons.splice(index, 1);
      }
    },
    addDungeon: function(dungeon) {
      var refDungeon = find(this.dungeons, dungeon.id);
      if (!refDungeon) this.dungeons.push(dungeon);
      else {
        console.warn(dungeon.id + 'already exist in thsi game');
      }
    },
		updateGame: function(game) {
      this.updateDungeons(game.dungeons);
    },
    updateDungeons: function(dungeons) {
      var self = this;
			var index = Math.max(Math.max(self.dungeons.length - 1, dungeons.length - 1), 0);
			function treatDungeons() {
				var dungeon = dungeons[index];
				var refIndex = self.dungeons.indexOf(dungeon);
				var refDungeon = self.dungeons[index];
				if (refDungeon && dungeon && refDungeon.id === dungeon.id) {
					refDungeon.area = dungeon.area;
					refDungeon.life = dungeon.life;
					refDungeon.money = dungeon.money;
				} else if (!refDungeon && dungeon) {
					self.dungeons.push(dungeon);
				} else if (refDungeon && !dungeon) {
					self.dungeons.splice(refIndex, 1);
				}
				index--;

				if (index <= 0) {
					return;
				} else if (index >= dungeons.length || index >= self.dungeons.length) {
					treatDungeons();
				}
      }
      treatDungeons();
    },
    broadcast: function(eventName, data) {
      this.room.broadcast.to(this.room.id).emit(eventName, data);
      this.room.emit(eventName, data);
    },
    toJSON: function() {
      return {
        id: this.id,
        dungeons: this.dungeons.map(function(dungeon) {
          return dungeon.toJSON();
        })
      }
    }
	}

/* -------- End Game Class -------- */