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
  var MAX_CLOCK_TIME =  60 * 30;
  /**
   * Game Class
   * @param {socket} socket
   */
  function Game(socket, isServer, options) {
    this.isServer = !!isServer;
    this.room = socket;
    this.id = this.room.id;
    this.dungeons = [];
    this.dungeonsUI = [];
    this.clock = false;
    this.started = false;
    this.time = 0;
    this.timeOffset = 0;
    this.options = options || [
      'Wall',
      'Trap',
    ];
  }

  Game.prototype = {
    destroy: function() {
      if (this.isServer) {
        clearInterval(this.clock);
        this.started = false;
      }
    },
    start: function() {
      if (this.isServer && !this.started) {
        this.started = new Date().now;
        this.broadcast('start');
        this.clock = setInterval(this.checkClock.bind(this), 1000);
      }
    },
    checkClock: function() {
      var self = this;
      this.time++;

      // check if a timer exceed the max time
      // just in case to not overload the server in case
      // a 'disconnect' event get lost
      if (this.time > MAX_CLOCK_TIME) {
        clearInterval(this.clock);
        this.broadcast('game-lost', {
          message: "Lost - OUT OF TIME",
        });
        
      }

      this.reduceLifeOnClock(this.time);
      // @TODO
      // Check clock time to reduce life
      // client can't unready the party
      this.broadcast('update', self.toJSON());
    },
    reduceLifeOnClock: function(time) {
      var self = this;
      this.dungeons.forEach(function (dungeon) {
        dungeon.lastUpdateTime++;
        console.log(parseInt(dungeon.config.timeLimit), time - self.timeOffset);
        if (dungeon.lastUpdateTime >= parseInt(dungeon.config.timeLimit) * Math.max(Math.ceil((time - self.timeOffset) / 10), 1)) {
          console.log('passed');
          dungeon.life -= self.applyModifiers('timeLimitMalus', dungeon);
          dungeon.modifiers.timeLimitMalus++;
        }
        if (dungeon.lastUpdateTime < dungeon.config.timeLimit) {
          self.timeOffset = time;
          dungeon.modifiers.timeLimitMalus = 0;
        }
        if (dungeon.life <= 0 && !dungeon.player.lost && self.isServer) {
          self.room.to(dungeon.id).emit('game-lost', {
            message: "Lost - OUT OF TIME",
          });
          dungeon.play.lost = true;
        }
      });
    },
    applyModifiers: function(key, dungeon) {
      return dungeon.config[key] + dungeon.modifiers[key];
    },
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
    checkReady: function() {
      if (!this.started && this.isServer) {
        var isReady = false;
        for (var i = 0; i < this.dungeons.length; i++) {
          isReady = this.dungeons[i].player.ready;
          if (isReady === false) break;
        }
        if (isReady) this.start();
      }
    },
    updateGame: function(game) {
      this.options = game.options;
      this.updateDungeons(game.dungeons);
      this.checkReady();
    },
    updateDungeons: function(dungeons) {
      var self = this;
      var index = Math.max(Math.max(self.dungeons.length - 1, dungeons.length - 1), 0);
      var dungeonsToAdd = [];
      function treatDungeons() {
        var dungeon = dungeons[index];
        var refIndex = dungeon ? findIndex(self.dungeons, dungeon.id) : undefined;
        var refDungeon = refIndex >= 0 ? self.dungeons[refIndex] : undefined;
        // console.log(dungeon, refIndex, refDungeon);
        if (refDungeon && dungeon && refDungeon.id === dungeon.id) {
          refDungeon.area = dungeon.area;
          refDungeon.life = dungeon.life;
          refDungeon.money = dungeon.money;
          refDungeon.player = dungeon.player;
        } else if (!refDungeon && dungeon) {
          self.dungeons.push(dungeon);
          if (!self.isServer) self.addDungeonUI(dungeon);
        } else if (self.dungeons[index] && !dungeon && !find(dungeons, self.dungeons[index].id)) {
          var deletedDungeon = self.dungeons.splice(index, 1)[0];
          self.dungeonsUI.splice(index, 1);
          if (!self.isServer) self.deleteDungeonUI(deletedDungeon.id);
        }
        index--;

        if (index < 0) {
          return;
        } else {
          treatDungeons();
        }
      }
      treatDungeons();
      if (!self.isServer) self.updateUI();
    },
    deleteDungeonUI: function(dungeonId) {
      var dungeonUI = document.getElementById(dungeonId);
      document.getElementsByTagName('main')[0].removeChild(dungeonUI);
    },
    applyOptionEvent: function(event) {
      var selectedSquare = event.target;
      var dungeonId = selectedSquare.getAttribute('data-dungeon-id');
      var x = parseInt(selectedSquare.getAttribute('data-area-x'), 10);
      var y = parseInt(selectedSquare.getAttribute('data-area-y'), 10);
      var dungeon = find(this.dungeons, dungeonId);
      this.broadcast('apply-option', {
        dungeonId: dungeonId,
        opponentId: this.id,
        option: ' ' + this.selectedOption.toLowerCase(),
        x: x,
        y: y,
      });
    },
    addDungeonUI: function(dungeon) {
      var self = this;
      var uiDungeon = {
        id: dungeon.id,
        area: [],
      };

      // initialize the UI elements

      var areaContainer = createUIElement('div', {
        class: 'area-container',
        id: dungeon.id,
      });
      var dungeonName = createUIElement('h1', {
        class: 'dungeon-name',
      });
      var area = createUIElement('div', {
        class: 'area',
      });
      var lifeContainer = createUIElement('div', {
        class: 'life-container',
      });
      var lifeBar = createUIElement('div', {
        class: 'life-bar',
      });
      var lifeCount = createUIElement('p', {
        class: 'life-count',
      });
      var moneyCount = createUIElement('p', {
        class: 'money-count',
      });
      var readyButton = createUIElement('div', {
        class: 'ready',
        'data-dungeon-id': dungeon.id,
      }, {
        click: function(event) {
          var dungeonId = event.target.getAttribute('data-dungeon-id');
          if (dungeonId === self.id) self.broadcast('ready', dungeonId);
        },
      });

      // Create the area DOM squares
      // and associate it to the new uiDungeon
      // for update loop and performance

      dungeon.area.forEach(function (row, rowIndex) {
        var areaRow = [];
        row.forEach(function (squareState, columnIndex) {
          var square = createUIElement('div', {
            class: squareState,
            'data-area-x': rowIndex,
            'data-area-y': columnIndex,
            'data-dungeon-id': dungeon.id,
          }, {
            click: self.applyOptionEvent.bind(self),
          });
          area.appendChild(square);
          areaRow.push(square);
        });
        uiDungeon.area.push(areaRow);
      });

      // append the elements to the DOM
      lifeContainer.appendChild(lifeBar);
      lifeContainer.appendChild(lifeCount);
      lifeContainer.appendChild(moneyCount);
      
      areaContainer.appendChild(dungeonName);
      areaContainer.appendChild(lifeContainer);
      areaContainer.appendChild(readyButton);
      areaContainer.appendChild(area);

      document.getElementsByTagName('main')[0].appendChild(areaContainer);
      
      // map the element to the uiDungeon
      uiDungeon.lifeBar = lifeBar;
      uiDungeon.lifeCount = lifeCount;
      uiDungeon.moneyCount = moneyCount;
      uiDungeon.readyButton = readyButton;
      this.dungeonsUI.push(uiDungeon);
    },
    updateUI: function(game) {
      var self = this;
      this.dungeons.forEach(function (dungeon, index) {
        const dungeonUI = find(self.dungeonsUI, dungeon.id);
        // update lifeBar height
        applyStyleOn(self.dungeonsUI[index].lifeBar, {
          height: dungeon.life + '%',
        });

        // update life count
        dungeonUI.lifeCount.innerHTML = dungeon.life;
        
        // update money count
        dungeonUI.moneyCount.innerHTML = dungeon.money;

        // ready button
        var otherUi = find(self.dungeonsUI, dungeon.id);
        if (dungeon.player.ready) {
          otherUi.readyButton.classList.add('btn-ready');
        } else {
          otherUi.readyButton.classList.remove('btn-ready');
        }

        // update area state
        dungeon.area.forEach(function (row, rowIndex) {
          row.forEach(function (column, columnIndex) {
            applyAttributesOn(dungeonUI.area[rowIndex][columnIndex], {
              class: column.state,
            });
            applyStyleOn(dungeonUI.area[rowIndex][columnIndex], column.style);
          });
        });
      });
    },
    broadcast: function(eventName, data) {
      if (this.isServer) this.room.broadcast.to(this.room.id).emit(eventName, data);
      this.room.emit(eventName, data);
    },
    toJSON: function() {
      return {
        id: this.id,
        time: this.time,
        started: this.started,
        dungeons: this.dungeons.map(function(dungeon) {
          return dungeon.toJSON ? dungeon.toJSON() : dungeon;
        }),
        options: this.options,
      }
    }
  }

/* -------- End Game Class -------- */